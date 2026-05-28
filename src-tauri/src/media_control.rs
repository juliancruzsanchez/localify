#[derive(Debug, Clone)]
pub struct TrackMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub elapsed_ms: u64,
    pub artwork_file: Option<String>,
}

#[derive(Debug, Clone)]
pub enum MediaControlUpdate {
    TrackChanged(TrackMetadata),
    Paused(u64),
    Resumed(u64),
    Stopped,
    Seeked(u64),
}

// ─── No-op implementation (non-macOS) ──────────────────────────────────────

#[cfg(not(target_os = "macos"))]
mod platform {
    use crossbeam_channel::{Receiver, Sender};
    use crate::audio::engine::PlayerCommand;
    use super::MediaControlUpdate;

    pub struct MediaControlHandle;

    impl MediaControlHandle {
        pub fn new(
            _cmd_tx: Sender<PlayerCommand>,
            _update_rx: Receiver<MediaControlUpdate>,
            _app_handle: tauri::AppHandle,
        ) -> Self {
            Self
        }
    }
}

// ─── macOS implementation ─────────────────────────────────────────────────

#[cfg(target_os = "macos")]
#[link(name = "MediaPlayer", kind = "framework")]
extern "C" {}

#[cfg(target_os = "macos")]
mod platform {
    use crossbeam_channel::{Receiver, Sender};
    use std::path::Path;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, Ordering};
    use objc2::rc::Retained;
    use objc2::msg_send;
    use objc2::extern_class;
    use objc2::extern_methods;
    use objc2_foundation::{
        NSDictionary, NSNumber, NSObject, NSString, NSSize,
    };
    use block2::RcBlock;
    use tauri::Emitter;
    use crate::audio::engine::PlayerCommand;
    use super::{MediaControlUpdate, TrackMetadata};

    // MPNowPlayingPlaybackState constants (macOS 10.12.2+)
    const MP_STATE_PLAYING: u64 = 1;
    const MP_STATE_PAUSED:  u64 = 2;
    const MP_STATE_STOPPED: u64 = 3;

    // ── MediaPlayer class declarations ─────────────────────────────────────

    extern_class!(
        #[unsafe(super(NSObject))]
        pub struct MPNowPlayingInfoCenter;
    );
    impl MPNowPlayingInfoCenter {
        extern_methods!(
            #[unsafe(method(defaultCenter))]
            pub fn defaultCenter() -> Retained<MPNowPlayingInfoCenter>;

            #[unsafe(method(setNowPlayingInfo:))]
            pub fn setNowPlayingInfo(&self, info: Option<&NSDictionary>);

            // Required on macOS 10.12.2+ for Control Center to show the widget.
            #[unsafe(method(setPlaybackState:))]
            pub fn setPlaybackState(&self, state: u64);
        );
    }

    extern_class!(
        #[unsafe(super(NSObject))]
        pub struct MPRemoteCommandCenter;
    );
    impl MPRemoteCommandCenter {
        extern_methods!(
            #[unsafe(method(sharedCommandCenter))]
            pub fn sharedCommandCenter() -> Retained<MPRemoteCommandCenter>;

            #[unsafe(method(playCommand))]
            pub fn playCommand(&self) -> Retained<MPRemoteCommand>;

            #[unsafe(method(pauseCommand))]
            pub fn pauseCommand(&self) -> Retained<MPRemoteCommand>;

            #[unsafe(method(nextTrackCommand))]
            pub fn nextTrackCommand(&self) -> Retained<MPRemoteCommand>;

            #[unsafe(method(previousTrackCommand))]
            pub fn previousTrackCommand(&self) -> Retained<MPRemoteCommand>;

            #[unsafe(method(changePlaybackPositionCommand))]
            pub fn changePlaybackPositionCommand(&self) -> Retained<MPRemoteCommand>;

            #[unsafe(method(togglePlayPauseCommand))]
            pub fn togglePlayPauseCommand(&self) -> Retained<MPRemoteCommand>;
        );
    }

    extern_class!(
        #[unsafe(super(NSObject))]
        pub struct MPRemoteCommand;
    );
    impl MPRemoteCommand {
        extern_methods!(
            #[unsafe(method(setEnabled:))]
            pub fn setEnabled(&self, enabled: bool);
        );
    }

    extern_class!(
        #[unsafe(super(NSObject))]
        pub struct MPMediaItemArtwork;
    );

    // ── Remote command setup ───────────────────────────────────────────────

    fn setup_remote_commands(
        cmd_tx: Sender<PlayerCommand>,
        app_handle: tauri::AppHandle,
        is_playing: Arc<AtomicBool>,
    ) {
        let center = MPRemoteCommandCenter::sharedCommandCenter();

        // ── Play ───────────────────────────────────────────────────────────
        let play_cmd = center.playCommand();
        play_cmd.setEnabled(true);
        let tx = cmd_tx.clone();
        let block = Box::into_raw(Box::new(RcBlock::new(move |_: *mut NSObject| -> i64 {
            tx.send(PlayerCommand::Resume).ok();
            0
        })));
        unsafe {
            let _: () = msg_send![&*play_cmd, addTargetWithHandler: &**block];
        }

        // ── Pause ──────────────────────────────────────────────────────────
        let pause_cmd = center.pauseCommand();
        pause_cmd.setEnabled(true);
        let tx = cmd_tx.clone();
        let block = Box::into_raw(Box::new(RcBlock::new(move |_: *mut NSObject| -> i64 {
            tx.send(PlayerCommand::Pause).ok();
            0
        })));
        unsafe {
            let _: () = msg_send![&*pause_cmd, addTargetWithHandler: &**block];
        }

        // ── Toggle play/pause (headphone button) ───────────────────────────
        // Check the shared is_playing flag so we send the right command.
        let toggle_cmd = center.togglePlayPauseCommand();
        toggle_cmd.setEnabled(true);
        let tx = cmd_tx.clone();
        let flag = is_playing.clone();
        let block = Box::into_raw(Box::new(RcBlock::new(move |_: *mut NSObject| -> i64 {
            if flag.load(Ordering::Relaxed) {
                tx.send(PlayerCommand::Pause).ok();
            } else {
                tx.send(PlayerCommand::Resume).ok();
            }
            0
        })));
        unsafe {
            let _: () = msg_send![&*toggle_cmd, addTargetWithHandler: &**block];
        }

        // ── Next Track ─────────────────────────────────────────────────────
        let next_cmd = center.nextTrackCommand();
        next_cmd.setEnabled(true);
        let ah = app_handle.clone();
        let block = Box::into_raw(Box::new(RcBlock::new(move |_: *mut NSObject| -> i64 {
            let _ = ah.emit("next-track", ());
            0
        })));
        unsafe {
            let _: () = msg_send![&*next_cmd, addTargetWithHandler: &**block];
        }

        // ── Previous Track ─────────────────────────────────────────────────
        let prev_cmd = center.previousTrackCommand();
        prev_cmd.setEnabled(true);
        let ah = app_handle.clone();
        let block = Box::into_raw(Box::new(RcBlock::new(move |_: *mut NSObject| -> i64 {
            let _ = ah.emit("previous-track", ());
            0
        })));
        unsafe {
            let _: () = msg_send![&*prev_cmd, addTargetWithHandler: &**block];
        }

        // ── Seek ───────────────────────────────────────────────────────────
        let seek_cmd = center.changePlaybackPositionCommand();
        seek_cmd.setEnabled(true);
        let tx = cmd_tx;
        let block = Box::into_raw(Box::new(RcBlock::new(move |event: *mut NSObject| -> i64 {
            let pos: f64 = unsafe { msg_send![event, positionTime] };
            let ms = (pos * 1000.0) as u64;
            tx.send(PlayerCommand::Seek { position_ms: ms }).ok();
            0
        })));
        unsafe {
            let _: () = msg_send![&*seek_cmd, addTargetWithHandler: &**block];
        }
    }

    // ── NowPlaying helpers ─────────────────────────────────────────────────

    fn set_dict_value(dict: &NSObject, key: &NSString, value: &NSObject) {
        unsafe {
            let _: () = msg_send![dict, setObject: value, forKey: key];
        }
    }

    /// Build a complete NowPlaying dictionary including the playback rate.
    /// Always includes every field so that `setNowPlayingInfo` (which replaces
    /// the entire dictionary) never clears title/artist/album/artwork.
    fn build_now_playing_dict(info: &TrackMetadata, rate: f64) -> Retained<NSDictionary> {
        unsafe {
            let cls = objc2::runtime::AnyClass::get(c"NSMutableDictionary").unwrap();
            let dict: Retained<NSObject> = msg_send![cls, new];

            set_dict_value(
                &dict,
                &NSString::from_str("MPMediaItemPropertyTitle"),
                &NSString::from_str(&info.title),
            );
            set_dict_value(
                &dict,
                &NSString::from_str("MPMediaItemPropertyArtist"),
                &NSString::from_str(&info.artist),
            );
            set_dict_value(
                &dict,
                &NSString::from_str("MPMediaItemPropertyAlbumTitle"),
                &NSString::from_str(&info.album),
            );
            set_dict_value(
                &dict,
                &NSString::from_str("MPMediaItemPropertyPlaybackDuration"),
                &NSNumber::new_f64(info.duration_ms as f64 / 1000.0),
            );
            set_dict_value(
                &dict,
                &NSString::from_str("MPNowPlayingInfoPropertyElapsedPlaybackTime"),
                &NSNumber::new_f64(info.elapsed_ms as f64 / 1000.0),
            );
            set_dict_value(
                &dict,
                &NSString::from_str("MPNowPlayingInfoPropertyPlaybackRate"),
                &NSNumber::new_f64(rate),
            );

            if let Some(ref artwork_file) = info.artwork_file {
                let path = Path::new(artwork_file);
                if path.exists() {
                    if let Ok(data) = std::fs::read(path) {
                        if let Some(artwork) = create_media_item_artwork(&data) {
                            set_dict_value(
                                &dict,
                                &NSString::from_str("MPMediaItemPropertyArtwork"),
                                &*artwork,
                            );
                        }
                    }
                }
            }

            msg_send![&dict, copy]
        }
    }

    fn set_now_playing(info: &TrackMetadata, rate: f64, state: u64) {
        let dict   = build_now_playing_dict(info, rate);
        let center = MPNowPlayingInfoCenter::defaultCenter();
        center.setNowPlayingInfo(Some(&dict));
        center.setPlaybackState(state);
    }

    fn clear_now_playing() {
        let center = MPNowPlayingInfoCenter::defaultCenter();
        center.setNowPlayingInfo(None);
        center.setPlaybackState(MP_STATE_STOPPED);
    }

    fn create_media_item_artwork(
        image_data: &[u8],
    ) -> Option<Retained<MPMediaItemArtwork>> {
        unsafe {
            let bytes = image_data.as_ptr();
            let len = image_data.len();
            let ns_data: Retained<NSObject> = msg_send![
                objc2::runtime::AnyClass::get(c"NSData").unwrap(),
                dataWithBytes: bytes,
                length: len,
            ];
            let ns_image_cls = objc2::runtime::AnyClass::get(c"NSImage")?;
            let image: *mut NSObject = msg_send![ns_image_cls, alloc];
            let image: *mut NSObject = msg_send![image, initWithData: &*ns_data];
            if image.is_null() {
                return None;
            }
            let artwork_cls = objc2::runtime::AnyClass::get(c"MPMediaItemArtwork")?;
            let artwork: *mut NSObject = msg_send![artwork_cls, alloc];
            let size = NSSize::new(300.0, 300.0);
            let art_block = Box::into_raw(Box::new(RcBlock::new(
                move |_: NSSize| -> *mut NSObject { image },
            )));
            let artwork: *mut MPMediaItemArtwork = msg_send![
                artwork,
                initWithBoundsSize: size,
                requestHandler: &**art_block,
            ];
            if artwork.is_null() {
                return None;
            }
            Some(unsafe { Retained::from_raw(artwork).unwrap_unchecked() })
        }
    }

    // ── MediaControlHandle ─────────────────────────────────────────────────

    pub struct MediaControlHandle {
        _thread: std::thread::JoinHandle<()>,
    }

    impl MediaControlHandle {
        pub fn new(
            cmd_tx: Sender<PlayerCommand>,
            update_rx: Receiver<MediaControlUpdate>,
            app_handle: tauri::AppHandle,
        ) -> Self {
            // Shared flag: togglePlayPauseCommand reads it to decide Pause vs Resume.
            let is_playing = Arc::new(AtomicBool::new(false));
            setup_remote_commands(cmd_tx, app_handle, is_playing.clone());

            let handle = std::thread::spawn(move || {
                // Track the current metadata so every update can rebuild the full
                // NowPlaying dict — setNowPlayingInfo replaces (not merges) the dict.
                let mut current_info: Option<TrackMetadata> = None;

                for update in &update_rx {
                    match update {
                        MediaControlUpdate::TrackChanged(info) => {
                            is_playing.store(true, Ordering::Relaxed);
                            set_now_playing(&info, 1.0, MP_STATE_PLAYING);
                            current_info = Some(info);
                        }
                        MediaControlUpdate::Paused(elapsed) => {
                            is_playing.store(false, Ordering::Relaxed);
                            if let Some(ref mut i) = current_info {
                                i.elapsed_ms = elapsed;
                                set_now_playing(i, 0.0, MP_STATE_PAUSED);
                            }
                        }
                        MediaControlUpdate::Resumed(elapsed) => {
                            is_playing.store(true, Ordering::Relaxed);
                            if let Some(ref mut i) = current_info {
                                i.elapsed_ms = elapsed;
                                set_now_playing(i, 1.0, MP_STATE_PLAYING);
                            }
                        }
                        MediaControlUpdate::Stopped => {
                            is_playing.store(false, Ordering::Relaxed);
                            clear_now_playing();
                            current_info = None;
                        }
                        MediaControlUpdate::Seeked(elapsed) => {
                            if let Some(ref mut i) = current_info {
                                i.elapsed_ms = elapsed;
                                let (rate, state) = if is_playing.load(Ordering::Relaxed) {
                                    (1.0, MP_STATE_PLAYING)
                                } else {
                                    (0.0, MP_STATE_PAUSED)
                                };
                                set_now_playing(i, rate, state);
                            }
                        }
                    }
                }
                clear_now_playing();
            });

            Self { _thread: handle }
        }
    }
}

pub use platform::MediaControlHandle;

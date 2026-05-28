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
    ) {
        let center = MPRemoteCommandCenter::sharedCommandCenter();

        // ── Play ───────────────────────────────────────────────────────────
        center.playCommand().setEnabled(true);
        let tx = cmd_tx.clone();
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

        // ── Toggle play/pause (headphone button) ────────────────────────────
        let toggle_cmd = center.togglePlayPauseCommand();
        toggle_cmd.setEnabled(true);
        let tx = cmd_tx.clone();
        let block = Box::into_raw(Box::new(RcBlock::new(move |_: *mut NSObject| -> i64 {
            tx.send(PlayerCommand::Pause).ok();
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

    // ── NowPlaying update helpers ──────────────────────────────────────────

    fn set_dict_value(dict: &NSObject, key: &NSString, value: &NSObject) {
        unsafe {
            let _: () = msg_send![dict, setObject: value, forKey: key];
        }
    }

    fn build_now_playing_dict(info: &TrackMetadata) -> Retained<NSDictionary> {
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
                &NSNumber::new_f64(1.0),
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

    fn update_now_playing(info: &TrackMetadata) {
        let dict = build_now_playing_dict(info);
        let center = MPNowPlayingInfoCenter::defaultCenter();
        center.setNowPlayingInfo(Some(&dict));
    }

    fn update_playback_rate(rate: f64, elapsed_ms: u64) {
        unsafe {
            let cls = objc2::runtime::AnyClass::get(c"NSMutableDictionary").unwrap();
            let dict: Retained<NSObject> = msg_send![cls, new];
            set_dict_value(
                &dict,
                &NSString::from_str("MPNowPlayingInfoPropertyPlaybackRate"),
                &NSNumber::new_f64(rate),
            );
            set_dict_value(
                &dict,
                &NSString::from_str("MPNowPlayingInfoPropertyElapsedPlaybackTime"),
                &NSNumber::new_f64(elapsed_ms as f64 / 1000.0),
            );
            let dict: Retained<NSDictionary> = msg_send![&dict, copy];
            let center = MPNowPlayingInfoCenter::defaultCenter();
            center.setNowPlayingInfo(Some(&dict));
        }
    }

    fn clear_now_playing() {
        let center = MPNowPlayingInfoCenter::defaultCenter();
        center.setNowPlayingInfo(None);
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
            setup_remote_commands(cmd_tx, app_handle);

            let handle = std::thread::spawn(move || {
                for update in &update_rx {
                    match update {
                        MediaControlUpdate::TrackChanged(info) => {
                            update_now_playing(&info);
                        }
                        MediaControlUpdate::Paused(elapsed) => {
                            update_playback_rate(0.0, elapsed);
                        }
                        MediaControlUpdate::Resumed(elapsed) => {
                            update_playback_rate(1.0, elapsed);
                        }
                        MediaControlUpdate::Stopped => {
                            clear_now_playing();
                        }
                        MediaControlUpdate::Seeked(elapsed) => {
                            unsafe {
                                let center = MPNowPlayingInfoCenter::defaultCenter();
                                let cls =
                                    objc2::runtime::AnyClass::get(c"NSMutableDictionary")
                                        .unwrap();
                                let dict: Retained<NSObject> = msg_send![cls, new];
                                set_dict_value(
                                    &dict,
                                    &NSString::from_str(
                                        "MPNowPlayingInfoPropertyElapsedPlaybackTime",
                                    ),
                                    &NSNumber::new_f64(elapsed as f64 / 1000.0),
                                );
                                let dict: Retained<NSDictionary> = msg_send![&dict, copy];
                                center.setNowPlayingInfo(Some(&dict));
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

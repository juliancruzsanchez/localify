mod error;
mod state;
mod db;
mod audio;
mod scanner;
mod commands;
mod lastfm;
mod cast;
mod plugins;
mod media_control;

use std::sync::{Arc, Mutex};
use tauri::Manager;
use state::AppState;
use audio::engine::PlayerHandle;

use commands::library::{add_library_path, remove_library_path, get_library_paths, scan_library_cmd};
use commands::player::{
    play_track, pause, resume, seek, set_volume, stop_playback, get_player_state,
    get_audio_settings, set_eq_bands, set_crossfade,
};
use media_control::MediaControlHandle;
use commands::tracks::{get_tracks, get_track, reveal_in_folder};
use commands::albums::{get_albums, get_album, get_album_tracks};
use commands::artists::{get_artists, get_artist, get_artist_albums};
use commands::playlists::{
    get_playlists, get_playlist, create_playlist_cmd, update_playlist_cmd,
    delete_playlist_cmd, get_playlist_tracks_cmd, add_track_to_playlist_cmd,
    remove_track_from_playlist_cmd, reorder_playlist_track_cmd, set_playlist_cover_cmd,
};
use commands::search::search_library;
use commands::artwork::{get_artwork_path, get_cover_image};
use commands::home::{get_recently_played, get_genre_mixes};
use commands::liked::{like_track, unlike_track, get_liked_track_ids, get_liked_tracks, get_liked_genres};
use commands::lastfm::{lastfm_authenticate, lastfm_now_playing, lastfm_scrobble};
use commands::tags::{get_track_tags, update_track_tags};
use commands::audio_devices::{get_audio_output_devices, set_audio_output_device, get_selected_audio_device};
use commands::cast::{discover_cast_devices, get_cast_devices, cast_track, stop_cast, get_cast_session};
use commands::plugins::{
    plugin_list, plugin_install, plugin_uninstall,
    plugin_get_settings, plugin_save_settings,
    plugin_dispatch,
    plugin_audio_source_search, plugin_audio_source_browse_root,
    plugin_audio_source_browse_collection, plugin_audio_source_play,
};
use cast::CastState;
use plugins::registry::PluginRegistry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()
                .expect("Could not resolve app data directory");

            let conn = db::connection::open_db(&app_data_dir)
                .expect("Failed to open database");

            // Media control channel: audio engine → media control (NowPlaying updates)
            let (media_update_tx, media_update_rx) = crossbeam_channel::unbounded();

            let player = PlayerHandle::new(Some(media_update_tx));

            // Set up macOS media control (no-op on other platforms)
            let remote_cmd_tx = player.cmd_tx.clone();
            let media_control = MediaControlHandle::new(
                remote_cmd_tx,
                media_update_rx,
                app.handle().clone(),
            );

            let plugin_registry = PluginRegistry::new();
            let plugins_dir = app_data_dir.join("plugins");
            if let Err(e) = plugins::loader::load_plugins_from_dir(&plugins_dir, &plugin_registry) {
                log::warn!("[plugins] Error during startup load: {e}");
            }

            app.manage(AppState {
                db: Arc::new(Mutex::new(conn)),
                player,
                app_data_dir,
                cast: CastState::new(),
                plugins: plugin_registry,
                media_control: Some(media_control),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Library
            add_library_path,
            remove_library_path,
            get_library_paths,
            scan_library_cmd,
            // Player
            play_track,
            pause,
            resume,
            seek,
            set_volume,
            stop_playback,
            get_player_state,
            // Audio settings
            get_audio_settings,
            set_eq_bands,
            set_crossfade,
            // Tracks
            get_tracks,
            get_track,
            reveal_in_folder,
            // Albums
            get_albums,
            get_album,
            get_album_tracks,
            // Artists
            get_artists,
            get_artist,
            get_artist_albums,
            // Playlists
            get_playlists,
            get_playlist,
            create_playlist_cmd,
            update_playlist_cmd,
            delete_playlist_cmd,
            get_playlist_tracks_cmd,
            add_track_to_playlist_cmd,
            remove_track_from_playlist_cmd,
            reorder_playlist_track_cmd,
            set_playlist_cover_cmd,
            // Search
            search_library,
            // Artwork
            get_artwork_path,
            get_cover_image,
            // Home
            get_recently_played,
            get_genre_mixes,
            // Liked songs
            like_track,
            unlike_track,
            get_liked_track_ids,
            get_liked_tracks,
            get_liked_genres,
            // Last.fm
            lastfm_authenticate,
            lastfm_now_playing,
            lastfm_scrobble,
            // ID3 editor
            get_track_tags,
            update_track_tags,
            // Audio output devices
            get_audio_output_devices,
            set_audio_output_device,
            get_selected_audio_device,
            // Google Cast
            discover_cast_devices,
            get_cast_devices,
            cast_track,
            stop_cast,
            get_cast_session,
            // Plugins
            plugin_list,
            plugin_install,
            plugin_uninstall,
            plugin_get_settings,
            plugin_save_settings,
            plugin_dispatch,
            plugin_audio_source_search,
            plugin_audio_source_browse_root,
            plugin_audio_source_browse_collection,
            plugin_audio_source_play,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Localify");
}

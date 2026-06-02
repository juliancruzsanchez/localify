mod error;
mod state;
mod db;
mod audio;
mod scanner;
mod commands;
mod lastfm;
mod cast;
mod discord_rpc;
mod plugins;
mod media_control;
mod watcher;

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
use commands::tracks::{get_tracks, get_track, get_all_genres, reveal_in_folder};
use commands::albums::{get_albums, get_album, get_album_tracks};
use commands::artists::{get_artists, get_artist, get_artist_albums};
use commands::playlists::{
    get_playlists, get_playlist, create_playlist_cmd, update_playlist_cmd,
    delete_playlist_cmd, get_playlist_tracks_cmd, add_track_to_playlist_cmd,
    remove_track_from_playlist_cmd, reorder_playlist_track_cmd, set_playlist_cover_cmd,
    export_playlist_m3u8,
};
use commands::search::search_library;
use commands::artwork::{get_artwork_path, get_artwork_data_url, get_cover_image};
use commands::home::{get_recently_played, get_genre_mixes};
use commands::liked::{like_track, unlike_track, get_liked_track_ids, get_liked_tracks, get_liked_genres, export_liked_m3u8};
use commands::lastfm::{lastfm_authenticate, lastfm_now_playing, lastfm_scrobble, lastfm_get_recommendations, lastfm_get_similar_artists};
use commands::tags::{get_track_tags, update_track_tags};
use commands::audio_devices::{get_audio_output_devices, set_audio_output_device, get_selected_audio_device, db_load_device};
use commands::cast::{discover_cast_devices, get_cast_devices, cast_track, stop_cast, get_cast_session, cast_pause, cast_resume, cast_seek};
use commands::remote_stream::{remote_stream_start, remote_stream_stop, remote_stream_status};
use commands::discord_rpc::{discord_rpc_enable, discord_rpc_disable, discord_rpc_get_status};
use discord_rpc::DiscordRpcHandle;
use commands::ytdlp::{ytdlp_check, ytdlp_install, ytdlp_search, ytdlp_download};
use commands::ffmpeg::{ffmpeg_check, ffmpeg_install};
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
            *player.viz_app_handle.lock().unwrap() = Some(app.handle().clone());

            // Restore the persisted output device so the reconnect watcher can
            // begin monitoring it immediately after startup.
            if let Ok(Some(saved)) = db_load_device(&conn) {
                *player.selected_device.lock().unwrap() = Some(saved);
            }

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

            let db = Arc::new(Mutex::new(conn));

            let library_paths: Vec<String> = {
                let c = db.lock().unwrap();
                let mut stmt = c.prepare("SELECT path FROM library_paths").unwrap_or_else(|_| c.prepare("SELECT 1 WHERE 0").unwrap());
                stmt.query_map([], |row| row.get(0))
                    .map(|rows| rows.flatten().collect())
                    .unwrap_or_default()
            };

            let lib_watcher = watcher::LibraryWatcher::new(
                library_paths,
                db.clone(),
                app_data_dir.clone(),
                app.handle().clone(),
            );

            let cast_state = CastState::new();

            app.manage(AppState {
                db: db.clone(),
                player,
                app_data_dir: app_data_dir.clone(),
                cast: cast_state.clone(),
                plugins: plugin_registry,
                media_control: Some(media_control),
                watcher: Arc::new(Mutex::new(Some(lib_watcher))),
                discord_rpc: DiscordRpcHandle::new(),
            });

            // Auto-start the LAN file server so mobile / remote clients can
            // reach /stream/:id, /api/tracks, /api/library.json, etc. without
            // requiring the user to click "Start" in remote-streaming settings.
            tauri::async_runtime::spawn(async move {
                let (port, shutdown_tx) = cast::start_file_server(db, app_data_dir).await;
                *cast_state.server_port.lock().unwrap()     = port;
                *cast_state.server_shutdown.lock().unwrap() = Some(shutdown_tx);
                if let Some(ip) = cast::local_ip() {
                    log::info!("[remote-stream] serving on http://{}:{}", ip, port);
                } else {
                    log::info!("[remote-stream] serving on port {}", port);
                }
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
            get_all_genres,
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
            export_playlist_m3u8,
            // Search
            search_library,
            // Artwork
            get_artwork_path,
            get_artwork_data_url,
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
            export_liked_m3u8,
            // Last.fm
            lastfm_authenticate,
            lastfm_now_playing,
            lastfm_scrobble,
            lastfm_get_recommendations,
            lastfm_get_similar_artists,
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
            cast_pause,
            cast_resume,
            cast_seek,
            // Remote Streaming
            remote_stream_start,
            remote_stream_stop,
            remote_stream_status,
            // Discord Rich Presence
            discord_rpc_enable,
            discord_rpc_disable,
            discord_rpc_get_status,
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
            // yt-dlp integration
            ytdlp_check,
            ytdlp_install,
            ytdlp_search,
            ytdlp_download,
            ffmpeg_check,
            ffmpeg_install,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Localify");
}

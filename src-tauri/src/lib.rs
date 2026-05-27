mod error;
mod state;
mod db;
mod audio;
mod scanner;
mod commands;

use std::sync::{Arc, Mutex};
use tauri::Manager;
use state::AppState;
use audio::engine::PlayerHandle;

use commands::library::{add_library_path, remove_library_path, get_library_paths, scan_library_cmd};
use commands::player::{
    play_track, pause, resume, seek, set_volume, stop_playback, get_player_state,
    get_audio_settings, set_eq_bands, set_crossfade,
};
use commands::tracks::{get_tracks, get_track};
use commands::albums::{get_albums, get_album, get_album_tracks};
use commands::artists::{get_artists, get_artist, get_artist_albums};
use commands::playlists::{
    get_playlists, get_playlist, create_playlist_cmd, update_playlist_cmd,
    delete_playlist_cmd, get_playlist_tracks_cmd, add_track_to_playlist_cmd,
    remove_track_from_playlist_cmd, reorder_playlist_track_cmd,
};
use commands::search::search_library;
use commands::artwork::get_artwork_path;
use commands::home::get_recently_played;
use commands::liked::{like_track, unlike_track, get_liked_track_ids, get_liked_tracks, get_liked_genres};

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

            let player = PlayerHandle::new();

            app.manage(AppState {
                db: Arc::new(Mutex::new(conn)),
                player,
                app_data_dir,
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
            // Search
            search_library,
            // Artwork
            get_artwork_path,
            // Home
            get_recently_played,
            // Liked songs
            like_track,
            unlike_track,
            get_liked_track_ids,
            get_liked_tracks,
            get_liked_genres,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Localify");
}

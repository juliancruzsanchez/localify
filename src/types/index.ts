// Types matching Rust structs exactly

export interface Track {
  id: string;
  file_path: string;
  title: string;
  artist: string;
  album_artist: string | null;
  album_id: string | null;
  album_title: string | null;
  track_number: number | null;
  disc_number: number | null;
  year: number | null;
  genre: string | null;
  duration_secs: number;
  sample_rate: number | null;
  bit_depth: number | null;
  channels: number | null;
  bitrate_kbps: number | null;
  format: string;
  artwork_hash: string | null;
  play_count: number;
  last_played_at: number | null;
}

export interface Album {
  id: string;
  title: string;
  artist_id: string;
  artist_name: string;
  year: number | null;
  artwork_hash: string | null;
  track_count: number;
  duration_secs: number;
}

export interface Artist {
  id: string;
  name: string;
  artwork_hash: string | null;
  album_count: number;
  track_count: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  track_count: number;
  duration_secs: number;
  created_at: number;
  updated_at: number;
}

export interface PlaylistTrack {
  id: string;
  playlist_id: string;
  track_id: string;
  position: number;
  track: Track;
}

export interface LibraryPath {
  id: string;
  path: string;
}

export interface ScanResult {
  added: number;
  updated: number;
  removed: number;
  skipped: number;
  duration_ms: number;
  errors: string[];
}

export interface PlayerState {
  is_playing: boolean;
  volume: number;
  position_ms: number;
  duration_ms: number;
  current_track_id: string | null;
}

export interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
}

export type AppError =
  | { kind: "Database"; message: string }
  | { kind: "Io"; message: string }
  | { kind: "Audio"; message: string }
  | { kind: "Scan"; message: string }
  | { kind: "NotFound"; message: string }
  | { kind: "InvalidArgument"; message: string };

export type RepeatMode = "none" | "one" | "all";

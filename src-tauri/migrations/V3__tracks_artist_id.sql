ALTER TABLE tracks ADD COLUMN artist_id TEXT REFERENCES artists(id);
UPDATE tracks SET artist_id = (SELECT id FROM artists WHERE name = tracks.artist);
CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks(artist_id);

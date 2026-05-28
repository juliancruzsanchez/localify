CREATE TABLE IF NOT EXISTS plugin_settings (
    plugin_id  TEXT    NOT NULL PRIMARY KEY,
    settings   TEXT    NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

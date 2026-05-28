use rusqlite_migration::{Migrations, M};

pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../../migrations/V1__initial.sql")),
        M::up(include_str!("../../migrations/V2__liked_tracks.sql")),
        M::up(include_str!("../../migrations/V3__tracks_artist_id.sql")),
        M::up(include_str!("../../migrations/V4__playlist_cover.sql")),
        M::up(include_str!("../../migrations/V5__plugins.sql")),
    ])
}

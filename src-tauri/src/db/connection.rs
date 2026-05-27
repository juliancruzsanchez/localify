use std::path::Path;
use rusqlite::Connection;
use crate::error::Result;
use super::migrations::migrations;

pub fn open_db(app_data_dir: &Path) -> Result<Connection> {
    std::fs::create_dir_all(app_data_dir)?;
    let db_path = app_data_dir.join("library.db");
    let mut conn = Connection::open(&db_path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    migrations()
        .to_latest(&mut conn)
        .map_err(|e| crate::error::AppError::Database(e.to_string()))?;
    Ok(conn)
}

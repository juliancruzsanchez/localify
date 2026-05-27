use tauri::State;
use crate::db::search::{SearchResults, search};
use crate::error::Result;
use crate::state::AppState;

#[tauri::command]
pub async fn search_library(state: State<'_, AppState>, query: String) -> Result<SearchResults> {
    let conn = state.db.lock().unwrap();
    search(&conn, &query)
}

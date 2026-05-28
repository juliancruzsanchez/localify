use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use crossbeam_channel::{unbounded, Sender};
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Event, EventKind};
use tauri::Emitter;
use crate::scanner::scan::{ScanContext, scan_library};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "flac", "alac", "m4a", "wav", "aiff", "aif",
    "wv", "ape", "dsf", "dff", "ogg", "opus", "mp3", "aac",
];

fn has_supported_extension(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| SUPPORTED_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

enum WatcherMsg {
    FsEvent,
    UpdatePaths(Vec<String>),
    Shutdown,
}

pub struct LibraryWatcher {
    control_tx: Sender<WatcherMsg>,
}

impl LibraryWatcher {
    pub fn new(
        paths: Vec<String>,
        db: Arc<Mutex<rusqlite::Connection>>,
        app_data_dir: PathBuf,
        app_handle: tauri::AppHandle,
    ) -> Self {
        let (control_tx, control_rx) = unbounded::<WatcherMsg>();
        let (event_tx, event_rx) = unbounded::<notify::Result<Event>>();

        let control_tx_clone = control_tx.clone();
        let mut watcher: RecommendedWatcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
            if let Ok(event) = &res {
                let relevant = event.paths.iter().any(|p| has_supported_extension(p));
                let is_relevant_kind = matches!(
                    event.kind,
                    EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
                );
                if relevant && is_relevant_kind {
                    let _ = event_tx.send(res);
                    let _ = control_tx_clone.send(WatcherMsg::FsEvent);
                }
            }
        }).expect("failed to create watcher");

        for p in &paths {
            let path = PathBuf::from(p);
            if path.exists() {
                let _ = watcher.watch(&path, RecursiveMode::Recursive);
            }
        }

        std::thread::spawn(move || {
            let _watcher = watcher;
            let mut current_paths = paths;
            let mut last_event: Option<Instant> = None;
            let debounce = Duration::from_millis(2000);

            loop {
                let timeout = match last_event {
                    Some(t) => {
                        let elapsed = t.elapsed();
                        if elapsed >= debounce {
                            Duration::from_millis(0)
                        } else {
                            debounce - elapsed
                        }
                    }
                    None => Duration::from_secs(60),
                };

                match control_rx.recv_timeout(timeout) {
                    Ok(WatcherMsg::FsEvent) => {
                        while event_rx.try_recv().is_ok() {}
                        last_event = Some(Instant::now());
                    }
                    Ok(WatcherMsg::UpdatePaths(_new_paths)) => {
                        current_paths = _new_paths;
                        last_event = None;
                    }
                    Ok(WatcherMsg::Shutdown) => break,
                    Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                        if let Some(t) = last_event {
                            if t.elapsed() >= debounce {
                                last_event = None;
                                let _ = app_handle.emit("library:watcher-scan-started", ());
                                let paths_clone = current_paths.clone();
                                let app_handle_clone = app_handle.clone();
                                let db_clone = db.clone();
                                let app_data_dir_clone = app_data_dir.clone();
                                std::thread::spawn(move || {
                                    let rt = tokio::runtime::Builder::new_current_thread()
                                        .enable_all()
                                        .build()
                                        .expect("tokio rt");
                                    let result = rt.block_on(async move {
                                        let ctx = Arc::new(ScanContext {
                                            db: db_clone,
                                            app_data_dir: app_data_dir_clone,
                                            force_rescan: false,
                                        });
                                        scan_library(ctx, paths_clone, |_, _| {}).await
                                    });
                                    match result {
                                        Ok(r) => { let _ = app_handle_clone.emit("library:watcher-scan-finished", &r); }
                                        Err(e) => { log::warn!("[watcher] scan error: {e}"); }
                                    }
                                });
                            }
                        }
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Disconnected) => break,
                }
            }
        });

        LibraryWatcher { control_tx }
    }

    pub fn update_paths(&mut self, paths: Vec<String>) {
        let _ = self.control_tx.send(WatcherMsg::UpdatePaths(paths));
    }
}

impl Drop for LibraryWatcher {
    fn drop(&mut self) {
        let _ = self.control_tx.send(WatcherMsg::Shutdown);
    }
}

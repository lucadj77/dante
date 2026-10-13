mod files;

use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(files::WatcherState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            files::list_dir,
            files::read_text,
            files::write_text,
            files::rename_path,
            files::create_dir,
            files::path_exists,
            files::remove_path,
            files::watch_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

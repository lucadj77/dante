mod files;
mod pdf;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::WebviewWindowBuilder;

/// Folder name that makes a copy of Dante portable: when it sits next to the program,
/// settings and recent projects are kept there instead of in the user's profile, so the
/// whole folder can travel on a USB stick.
const PORTABLE_DATA: &str = "dante-data";

fn portable_data_dir() -> Option<PathBuf> {
    let dir = std::env::current_exe().ok()?.parent()?.join(PORTABLE_DATA);
    dir.is_dir().then_some(dir)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(files::WatcherState(Mutex::new(None)))
        // The window is created here rather than from the configuration, to choose where
        // the web view keeps its data.
        .setup(|app| {
            let config = app.config().app.windows.first().cloned().ok_or("no window configured")?;
            let mut window = WebviewWindowBuilder::from_config(app.handle(), &config)?;
            if let Some(dir) = portable_data_dir() {
                window = window.data_directory(dir);
            }
            window.build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            files::list_dir,
            files::read_text,
            files::write_text,
            files::rename_path,
            files::create_dir,
            files::path_exists,
            files::remove_path,
            files::read_bytes,
            files::open_with_system,
            files::import_files,
            files::watch_project,
            pdf::compile_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

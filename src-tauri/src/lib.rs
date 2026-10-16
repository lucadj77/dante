mod files;
mod pdf;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{App, Emitter, WebviewWindowBuilder};

/// Folder name that makes a copy of Dante portable: when it sits next to the program,
/// settings and recent projects are kept there instead of in the user's profile, so the
/// whole folder can travel on a USB stick.
const PORTABLE_DATA: &str = "dante-data";

fn portable_data_dir() -> Option<PathBuf> {
    let dir = std::env::current_exe().ok()?.parent()?.join(PORTABLE_DATA);
    dir.is_dir().then_some(dir)
}

/// The Mac menu bar, as Tauri makes it but for Cmd+W: the usual "Close Window" would leave
/// the app without a window, so the shortcut closes the pane beside the text instead
/// (the page receives it as the "close-pane" event). Elsewhere there is no menu bar and
/// the page sees Ctrl+W itself.
fn mac_menu(app: &App) -> tauri::Result<()> {
    let h = app.handle();
    let close_pane = MenuItem::with_id(h, "close-pane", "Close Pane", true, Some("CmdOrCtrl+W"))?;
    let app_menu = Submenu::with_items(
        h,
        "Dante",
        true,
        &[
            &PredefinedMenuItem::about(h, None, None)?,
            &PredefinedMenuItem::separator(h)?,
            &PredefinedMenuItem::services(h, None)?,
            &PredefinedMenuItem::separator(h)?,
            &PredefinedMenuItem::hide(h, None)?,
            &PredefinedMenuItem::hide_others(h, None)?,
            &PredefinedMenuItem::show_all(h, None)?,
            &PredefinedMenuItem::separator(h)?,
            &PredefinedMenuItem::quit(h, None)?,
        ],
    )?;
    let edit = Submenu::with_items(
        h,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(h, None)?,
            &PredefinedMenuItem::redo(h, None)?,
            &PredefinedMenuItem::separator(h)?,
            &PredefinedMenuItem::cut(h, None)?,
            &PredefinedMenuItem::copy(h, None)?,
            &PredefinedMenuItem::paste(h, None)?,
            &PredefinedMenuItem::select_all(h, None)?,
        ],
    )?;
    let view = Submenu::with_items(h, "View", true, &[&PredefinedMenuItem::fullscreen(h, None)?])?;
    let window = Submenu::with_items(
        h,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(h, None)?,
            &PredefinedMenuItem::maximize(h, None)?,
            &PredefinedMenuItem::separator(h)?,
            &close_pane,
        ],
    )?;
    app.set_menu(Menu::with_items(h, &[&app_menu, &edit, &view, &window])?)?;
    app.on_menu_event(|app, event| {
        if event.id() == "close-pane" {
            let _ = app.emit("close-pane", ());
        }
    });
    Ok(())
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
            if cfg!(target_os = "macos") {
                mac_menu(app)?;
            }
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
            files::write_bytes,
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

mod backup;
mod files;
mod pdf;
mod updates;
mod web;
pub mod webkit;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindowBuilder};

/// Folder name that makes a copy of Dante portable: when it sits next to the program,
/// settings and recent projects are kept there instead of in the user's profile, so the
/// whole folder can travel on a USB stick.
const PORTABLE_DATA: &str = "dante-data";

fn portable_data_dir() -> Option<PathBuf> {
    let dir = std::env::current_exe().ok()?.parent()?.join(PORTABLE_DATA);
    dir.is_dir().then_some(dir)
}

/// A project the system asked Dante to open, by double-clicking its launcher file (or its
/// folder, or "Open with"), waiting for the page to take it.
struct Opened(Mutex<Option<String>>);

/// The first argument naming something on disk: Windows and Linux pass the file that was
/// double-clicked this way. A relative path is read from `cwd`, the folder of the copy that
/// received it (a second copy hands over its arguments and its own folder).
fn path_argument(args: impl IntoIterator<Item = String>, cwd: &std::path::Path) -> Option<String> {
    args.into_iter()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .map(|a| cwd.join(a))
        .find(|p| p.exists())
        .map(|p| p.to_string_lossy().into_owned())
}

/// This copy's arguments, also when one is not valid Unicode.
fn own_arguments() -> Vec<String> {
    std::env::args_os().map(|a| a.to_string_lossy().into_owned()).collect()
}

/// Keeps `path` for the page and tells it, bringing the window to the front.
fn open_from_system(app: &AppHandle, path: String) {
    *app.state::<Opened>().0.lock().unwrap() = Some(path);
    let _ = app.emit("open-project", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// The path the system asked to open, if any; it is handed out once.
#[tauri::command]
fn opened_project(opened: State<Opened>) -> Option<String> {
    opened.0.lock().unwrap().take()
}

/// Makes the whole interface larger or smaller, as the zoom of a browser: menus, panels,
/// buttons and text together. False where the system cannot: on macOS 10.15 and older the
/// web view has no page zoom (WKWebView.pageZoom arrived with macOS 11) and asking would stop Dante.
#[tauri::command]
fn set_ui_zoom(window: tauri::WebviewWindow, factor: f64) -> bool {
    #[cfg(target_os = "macos")]
    if webkit::macos_10() {
        return false;
    }
    window.set_zoom(factor.clamp(0.5, 3.0)).is_ok()
}

/// How long the page has to write what is not saved yet before Dante quits anyway.
const QUIT_GRACE: std::time::Duration = std::time::Duration::from_secs(3);

/// Closing the window or choosing Quit: the page writes the text typed in the last moment
/// (autosave waits for a pause in typing), then calls `quit`. If the page does not answer,
/// as when it never started, Dante quits after a moment all the same.
fn quit_requested(app: &AppHandle) {
    let answered = app.state::<QuitAnswered>().0.clone();
    answered.store(false, Ordering::SeqCst);
    let _ = app.emit("quit-requested", ());
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(QUIT_GRACE);
        if !answered.load(Ordering::SeqCst) {
            app.exit(0);
        }
    });
}

/// Whether the page took the last request to quit, and so decides when to.
struct QuitAnswered(Arc<AtomicBool>);

/// The page is saving: Dante waits for `quit` (or for the writer to stay, if saving fails).
#[tauri::command]
fn quit_answered(answered: State<QuitAnswered>) {
    answered.0.store(true, Ordering::SeqCst);
}

/// The page has saved everything: Dante can quit.
#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

/// Whether this copy can update itself from the releases. Not while developing (the
/// program is not an installed bundle) nor in the portable copy, which the Windows installer
/// would replace with an installed one.
#[tauri::command]
fn updates_supported() -> bool {
    !cfg!(debug_assertions) && portable_data_dir().is_none()
}

/// The words of the Mac menu bar. The page sends them in the language of the interface, at
/// start and when that language changes; until then, and for a word it does not send, English.
type MenuLabels = std::collections::HashMap<String, String>;

fn label<'a>(labels: &'a MenuLabels, key: &str, english: &'a str) -> &'a str {
    labels.get(key).map(String::as_str).filter(|text| !text.is_empty()).unwrap_or(english)
}

/// The Mac menu bar, as Tauri makes it but for Cmd+W: the usual "Close Window" would leave
/// the app without a window, so the shortcut closes the pane beside the text instead, or
/// the project when no pane has the cursor (the page receives it as the "close-pane" event). Elsewhere there is no menu bar and
/// the page sees Ctrl+W itself.
fn mac_menu(h: &AppHandle, labels: &MenuLabels) -> tauri::Result<Menu<tauri::Wry>> {
    let l = |key: &str, english: &'static str| label(labels, key, english).to_string();
    let close_pane = MenuItem::with_id(h, "close-pane", l("close", "Close"), true, Some("CmdOrCtrl+W"))?;
    let app_menu = Submenu::with_items(
        h,
        "Dante",
        true,
        &[
            &PredefinedMenuItem::about(h, Some(&l("about", "About Dante")), None)?,
            &MenuItem::with_id(h, "check-updates", l("checkUpdates", "Check for Updates…"), true, None::<&str>)?,
            &PredefinedMenuItem::separator(h)?,
            &PredefinedMenuItem::services(h, Some(&l("services", "Services")))?,
            &PredefinedMenuItem::separator(h)?,
            &PredefinedMenuItem::hide(h, Some(&l("hide", "Hide Dante")))?,
            &PredefinedMenuItem::hide_others(h, Some(&l("hideOthers", "Hide Others")))?,
            &PredefinedMenuItem::show_all(h, Some(&l("showAll", "Show All")))?,
            &PredefinedMenuItem::separator(h)?,
            // Not the predefined Quit, which ends Dante before the page saves.
            &MenuItem::with_id(h, "quit", l("quit", "Quit Dante"), true, Some("CmdOrCtrl+Q"))?,
        ],
    )?;
    let edit = Submenu::with_items(
        h,
        l("edit", "Edit"),
        true,
        &[
            &PredefinedMenuItem::undo(h, Some(&l("undo", "Undo")))?,
            &PredefinedMenuItem::redo(h, Some(&l("redo", "Redo")))?,
            &PredefinedMenuItem::separator(h)?,
            &PredefinedMenuItem::cut(h, Some(&l("cut", "Cut")))?,
            &PredefinedMenuItem::copy(h, Some(&l("copy", "Copy")))?,
            &PredefinedMenuItem::paste(h, Some(&l("paste", "Paste")))?,
            &PredefinedMenuItem::select_all(h, Some(&l("selectAll", "Select All")))?,
        ],
    )?;
    let view = Submenu::with_items(h, l("view", "View"), true, &[&PredefinedMenuItem::fullscreen(h, Some(&l("fullscreen", "Enter Full Screen")))?])?;
    let window = Submenu::with_items(
        h,
        l("window", "Window"),
        true,
        &[
            &PredefinedMenuItem::minimize(h, Some(&l("minimize", "Minimize")))?,
            &PredefinedMenuItem::maximize(h, Some(&l("zoom", "Zoom")))?,
            &PredefinedMenuItem::separator(h)?,
            &close_pane,
        ],
    )?;
    // The page opens its own help window, which reads the guide without a connection.
    let help = Submenu::with_items(h, l("help", "Help"), true, &[&MenuItem::with_id(h, "open-help", l("openHelp", "Dante Help"), true, Some("CmdOrCtrl+?"))?])?;
    Menu::with_items(h, &[&app_menu, &edit, &view, &window, &help])
}

/// Writes the Mac menu bar again with the words the page sends. False where there is no menu bar.
#[tauri::command]
fn set_menu_labels(app: AppHandle, labels: MenuLabels) -> bool {
    if !cfg!(target_os = "macos") {
        return false;
    }
    mac_menu(&app, &labels).and_then(|menu| app.set_menu(menu)).is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // A second copy started by a double-click hands its file to the running one and
        // quits, so a project opens in the window already there.
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            match path_argument(args, std::path::Path::new(&cwd)) {
                Some(path) => open_from_system(app, path),
                None => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.set_focus();
                    }
                }
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Size and place of the window, as the writer left them; full screen is not brought back.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all() - tauri_plugin_window_state::StateFlags::FULLSCREEN)
                .build(),
        )
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                quit_requested(window.app_handle());
            }
        })
        .manage(QuitAnswered(Arc::new(AtomicBool::new(false))))
        .manage(files::WatcherState(Mutex::new(None)))
        .manage(Opened(Mutex::new(path_argument(own_arguments(), &std::env::current_dir().unwrap_or_default()))))
        // The window is created here rather than from the configuration, to choose where
        // the web view keeps its data.
        .setup(|app| {
            if cfg!(target_os = "macos") {
                let menu = mac_menu(app.handle(), &MenuLabels::new())?;
                app.set_menu(menu)?;
                app.on_menu_event(|app, event| {
                    if event.id() == "close-pane" {
                        let _ = app.emit("close-pane", ());
                    } else if event.id() == "check-updates" {
                        let _ = app.emit("check-updates", ());
                    } else if event.id() == "open-help" {
                        let _ = app.emit("open-help", ());
                    } else if event.id() == "quit" {
                        quit_requested(app);
                    }
                });
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
            files::file_signatures,
            files::open_with_system,
            files::import_files,
            files::watch_project,
            pdf::compile_pdf,
            backup::backup_project,
            backup::list_backups,
            backup::extract_backup,
            web::download_url,
            updates::check_update,
            webkit::webkit_info,
            opened_project,
            updates_supported,
            set_ui_zoom,
            set_menu_labels,
            quit,
            quit_answered,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
    // On the Mac a double-clicked file arrives as an event, whether Dante was running or not.
    app.run(|_app, _event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = _event {
            if let Some(path) = urls.into_iter().find_map(|u| u.to_file_path().ok()) {
                open_from_system(_app, path.to_string_lossy().into_owned());
            }
        }
    });
}

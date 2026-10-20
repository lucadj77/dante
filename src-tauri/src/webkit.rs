//! macOS 10.15 draws the windows of every app with the WebKit it shipped with (Safari 13.1),
//! even after Safari is updated: an updated Safari loads its newer WebKit from the "staged
//! frameworks" folder, and only because it tells dyld to look there. Dante asks for the same
//! copy on Catalina and older, restarting itself once with that variable set, so it gets the
//! engine of the installed Safari (15.6 at most on Catalina). Newer systems update WebKit with
//! the system and have nothing to do here.

/// The variable that makes dyld prefer a newer copy of a framework found in these folders.
const VARIABLE: &str = "DYLD_VERSIONED_FRAMEWORK_PATH";

/// Where Safari's updates put their WebKit: under /Library/Apple from Catalina on, under
/// /System before.
#[cfg(target_os = "macos")]
const STAGED: [&str; 2] = ["/Library/Apple/System/Library/StagedFrameworks/Safari", "/System/Library/StagedFrameworks/Safari"];

/// Set to skip the staged WebKit, should it ever stop Dante from starting.
#[cfg(target_os = "macos")]
const OPT_OUT: &str = "DANTE_SYSTEM_WEBKIT";
/// Set on the restarted copy, so that it never restarts again.
#[cfg(target_os = "macos")]
const RESTARTED: &str = "DANTE_WEBKIT_RESTARTED";

/// The folder of a newer WebKit installed by a Safari update, on macOS 10.x only.
#[cfg(target_os = "macos")]
fn staged_folder() -> Option<&'static str> {
    if !macos_10() {
        return None;
    }
    STAGED.into_iter().find(|dir| std::path::Path::new(dir).join("WebKit.framework").exists())
}

/// True on macOS 10.x, read from the system's own version file.
#[cfg(target_os = "macos")]
fn macos_10() -> bool {
    let Ok(plist) = std::fs::read_to_string("/System/Library/CoreServices/SystemVersion.plist") else {
        return false;
    };
    let Some(at) = plist.find("<key>ProductVersion</key>") else {
        return false;
    };
    let rest = &plist[at..];
    let Some(start) = rest.find("<string>") else {
        return false;
    };
    rest[start + "<string>".len()..].starts_with("10.")
}

/// Restarts Dante with the staged WebKit when there is one and it is not in use yet. Must run
/// first, before any window: the new process replaces this one, with the same id.
#[cfg(target_os = "macos")]
pub fn use_staged_webkit() {
    use std::os::unix::process::CommandExt;
    // The marker stops a second restart: macOS removes the DYLD_ variable from programs not
    // allowed to take it (a copy signed without Entitlements.plist), which would loop forever.
    if std::env::var_os(VARIABLE).is_some() || std::env::var_os(OPT_OUT).is_some() || std::env::var_os(RESTARTED).is_some() {
        return;
    }
    let Some(dir) = staged_folder() else {
        return;
    };
    let Ok(exe) = std::env::current_exe() else {
        return;
    };
    let error = std::process::Command::new(exe).args(std::env::args_os().skip(1)).env(VARIABLE, dir).env(RESTARTED, "1").exec();
    // exec returns only when it fails: Dante goes on with the system's WebKit.
    eprintln!("Dante: could not restart with the WebKit in {dir}: {error}");
}

#[cfg(not(target_os = "macos"))]
pub fn use_staged_webkit() {}

/// What draws Dante's window, for the report of a problem: the WebKit version and, on old
/// macOS, the folder of the staged copy in use.
#[tauri::command]
pub fn webkit_info() -> String {
    let version = tauri::webview_version().unwrap_or_else(|e| format!("? ({e})"));
    match std::env::var(VARIABLE) {
        Ok(dir) => format!("{version} (staged: {dir})"),
        Err(_) => version,
    }
}

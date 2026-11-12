//! The spelling checker of the Mac. The web view underlines misspelt words only when
//! "Check Spelling While Typing" is on, a choice macOS keeps per application and that
//! starts off for Dante. Dante turns it on the first time, and never again: whoever
//! turns it off from the Edit menu finds it off at the next opening.

#[cfg(any(target_os = "macos", test))]
use std::path::Path;

/// The key the web view of macOS reads to know whether to check spelling while typing.
#[cfg(any(target_os = "macos", test))]
const KEY: &str = "WebContinuousSpellCheckingEnabled";

/// Where macOS keeps the choices of this copy of Dante: the identifier of the application
/// when it runs from Dante.app, the name of the program when it runs on its own (as in development).
#[cfg(any(target_os = "macos", test))]
fn domain(executable: &Path, identifier: &str) -> String {
    let bundled = executable
        .parent()
        .map(|dir| dir.ends_with("Contents/MacOS"))
        .unwrap_or(false);
    if bundled {
        return identifier.to_string();
    }
    executable
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| identifier.to_string())
}

/// Turns the check while typing on when nobody has chosen yet. To call before the window exists.
#[cfg(target_os = "macos")]
pub fn check_while_typing(identifier: &str) {
    use std::process::{Command, Stdio};
    let Ok(executable) = std::env::current_exe() else { return };
    let domain = domain(&executable, identifier);
    let quiet = |args: &[&str]| {
        Command::new("/usr/bin/defaults")
            .args(args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|status| status.success())
            .unwrap_or(false)
    };
    // "read" fails when the key was never written: only then is the choice Dante's to make.
    if quiet(&["read", &domain, KEY]) {
        return;
    }
    quiet(&["write", &domain, KEY, "-bool", "true"]);
}

#[cfg(not(target_os = "macos"))]
pub fn check_while_typing(_identifier: &str) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_choice_is_kept_under_the_application_or_the_program() {
        let app = Path::new("/Applications/Dante.app/Contents/MacOS/dante");
        assert_eq!(domain(app, "app.dante.writer"), "app.dante.writer");
        let dev = Path::new("/Users/me/Developer/dante/src-tauri/target/debug/dante");
        assert_eq!(domain(dev, "app.dante.writer"), "dante");
        assert_eq!(KEY, "WebContinuousSpellCheckingEnabled");
    }
}

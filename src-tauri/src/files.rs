//! Filesystem access for one project folder. The frontend passes the project root and
//! a path relative to it, always with "/" as separator; paths that would leave the
//! project are refused.

use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize)]
pub struct Entry {
    path: String,
    name: String,
    #[serde(rename = "isDir")]
    is_dir: bool,
}

pub struct WatcherState(pub Mutex<Option<RecommendedWatcher>>);

fn resolve(root: &str, rel: &str) -> Result<PathBuf, String> {
    let mut path = PathBuf::from(root);
    for part in rel.split('/').filter(|p| !p.is_empty()) {
        match Path::new(part).components().next() {
            Some(Component::Normal(_)) if Path::new(part).components().count() == 1 => path.push(part),
            _ => return Err(format!("Invalid path: {rel}")),
        }
    }
    Ok(path)
}

fn relative(root: &Path, path: &Path) -> Option<String> {
    let rel = path.strip_prefix(root).ok()?;
    let parts: Vec<String> = rel.components().map(|c| c.as_os_str().to_string_lossy().into_owned()).collect();
    Some(parts.join("/"))
}

fn err(e: std::io::Error) -> String {
    e.to_string()
}

#[tauri::command]
pub fn list_dir(root: String, path: String) -> Result<Vec<Entry>, String> {
    let dir = resolve(&root, &path)?;
    let mut entries = Vec::new();
    for entry in fs::read_dir(&dir).map_err(err)? {
        let entry = entry.map_err(err)?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let rel = if path.is_empty() { name.clone() } else { format!("{path}/{name}") };
        entries.push(Entry { path: rel, name, is_dir: entry.file_type().map_err(err)?.is_dir() });
    }
    Ok(entries)
}

#[tauri::command]
pub fn read_text(root: String, path: String) -> Result<String, String> {
    fs::read_to_string(resolve(&root, &path)?).map_err(err)
}

/// Writes through a temporary file and a rename, so a sync client or another program
/// never sees a half-written note.
#[tauri::command]
pub fn write_text(root: String, path: String, content: String) -> Result<(), String> {
    let target = resolve(&root, &path)?;
    let dir = target.parent().ok_or("Invalid path")?;
    fs::create_dir_all(dir).map_err(err)?;
    let name = target.file_name().ok_or("Invalid path")?.to_string_lossy().into_owned();
    let temp = dir.join(format!(".{name}.dante-tmp"));
    fs::write(&temp, content).map_err(err)?;
    fs::rename(&temp, &target).map_err(|e| {
        let _ = fs::remove_file(&temp);
        err(e)
    })
}

#[tauri::command]
pub fn rename_path(root: String, from: String, to: String) -> Result<(), String> {
    let source = resolve(&root, &from)?;
    let target = resolve(&root, &to)?;
    if target.exists() {
        return Err(format!("Already exists: {to}"));
    }
    if let Some(dir) = target.parent() {
        fs::create_dir_all(dir).map_err(err)?;
    }
    fs::rename(source, target).map_err(err)
}

#[tauri::command]
pub fn create_dir(root: String, path: String) -> Result<(), String> {
    fs::create_dir_all(resolve(&root, &path)?).map_err(err)
}

#[tauri::command]
pub fn path_exists(root: String, path: String) -> Result<bool, String> {
    Ok(resolve(&root, &path)?.exists())
}

#[tauri::command]
pub fn remove_path(root: String, path: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("Refusing to remove the project folder".into());
    }
    let target = resolve(&root, &path)?;
    if target.is_dir() {
        fs::remove_dir_all(target).map_err(err)
    } else {
        fs::remove_file(target).map_err(err)
    }
}

/// Watches the project folder and emits "project-changed" with the relative paths
/// that changed. Watching a new project replaces the previous watcher.
#[tauri::command]
pub fn watch_project(app: AppHandle, state: State<WatcherState>, root: String) -> Result<(), String> {
    let base = PathBuf::from(&root);
    let watched = base.clone();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            let paths: Vec<String> = event.paths.iter().filter_map(|p| relative(&watched, p)).collect();
            if !paths.is_empty() {
                let _ = app.emit("project-changed", paths);
            }
        }
    })
    .map_err(|e| e.to_string())?;
    watcher.watch(&base, RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = Some(watcher);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_paths_outside_the_project() {
        assert!(resolve("/p", "../etc/passwd").is_err());
        assert!(resolve("/p", "a/../../b").is_err());
        assert!(resolve("/p", "Manuscript/010 A.md").is_ok());
    }

    #[test]
    fn writes_renames_and_lists() {
        let dir = std::env::temp_dir().join(format!("dante-test-{}", std::process::id()));
        let root = dir.to_string_lossy().into_owned();
        write_text(root.clone(), "Manuscript/010 A.md".into(), "text".into()).unwrap();
        assert_eq!(read_text(root.clone(), "Manuscript/010 A.md".into()).unwrap(), "text");
        rename_path(root.clone(), "Manuscript/010 A.md".into(), "Manuscript/020 A.md".into()).unwrap();
        let names: Vec<String> = list_dir(root.clone(), "Manuscript".into()).unwrap().into_iter().map(|e| e.name).collect();
        assert_eq!(names, vec!["020 A.md".to_string()]);
        assert!(rename_path(root.clone(), "Manuscript".into(), "Manuscript".into()).is_err());
        fs::remove_dir_all(dir).unwrap();
    }
}

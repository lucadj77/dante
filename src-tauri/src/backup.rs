//! Backups of a whole project: zip files kept on this computer, outside the project folder,
//! so they survive a damaged synced folder. Each project has its own folder of backups
//! inside the one the writer chose, and only the most recent ones are kept.
//!
//!   Dante backup/
//!   └── Il mio romanzo/
//!       ├── .dante-backup-of            the project's folder, to tell two projects of the same name apart
//!       ├── Il mio romanzo 2026-10-26 10-15-30.zip
//!       └── Il mio romanzo 2026-10-26 18-02-11.zip

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde::Serialize;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, DateTime, ZipWriter};

/// Names the project a folder of backups belongs to.
const MARKER: &str = ".dante-backup-of";

/// Folders at the top of the project left out: exports (copies of the novel), the trash,
/// other programs' data and version control.
const SKIPPED_TOP: &[&str] = &["export", ".trash", ".obsidian", ".git", "node_modules"];

/// Changes every minute while the project is open: it would make every backup look needed.
const PRESENCE: &str = ".dante/presence";

fn err(e: std::io::Error) -> String {
    e.to_string()
}

/// The folder of `root`'s backups in `dest`: "<name>", or "<name> 2" and so on when another
/// project of the same name took it. With `create`, made when missing.
fn project_dir(dest: &Path, name: &str, root: &str, create: bool) -> Result<Option<PathBuf>, String> {
    for n in 1.. {
        let dir = if n == 1 { dest.join(name) } else { dest.join(format!("{name} {n}")) };
        let marker = dir.join(MARKER);
        if dir.is_dir() {
            match fs::read_to_string(&marker) {
                Ok(owner) if owner.trim() == root => return Ok(Some(dir)),
                // A folder made by hand, or another project's: try the next name.
                _ => continue,
            }
        }
        if !create {
            return Ok(None);
        }
        fs::create_dir_all(&dir).map_err(err)?;
        fs::write(&marker, root).map_err(err)?;
        return Ok(Some(dir));
    }
    unreachable!()
}

/// The files and folders to save, as paths relative to `root` with "/" between names.
fn collect(root: &Path, dir: &Path, out: &mut Vec<(String, PathBuf, bool)>) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(err)? {
        let entry = entry.map_err(err)?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        let rel = path
            .strip_prefix(root)
            .map_err(|e| e.to_string())?
            .components()
            .map(|c| c.as_os_str().to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join("/");
        if dir == root && SKIPPED_TOP.contains(&name.as_str()) {
            continue;
        }
        if rel == PRESENCE || name == ".DS_Store" || name.contains(".dante-tmp") {
            continue;
        }
        let is_dir = entry.file_type().map_err(err)?.is_dir();
        out.push((rel, path.clone(), is_dir));
        if is_dir {
            collect(root, &path, out)?;
        }
    }
    Ok(())
}

fn modified(path: &Path) -> Option<SystemTime> {
    fs::metadata(path).and_then(|m| m.modified()).ok()
}

/// The zip files of a project's folder of backups, oldest first (their names end with the time).
fn backups(dir: &Path) -> Vec<PathBuf> {
    let mut list: Vec<PathBuf> = fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "zip"))
        .collect();
    list.sort();
    list
}

/// A time as the zip format writes it, in UTC; None outside the years it can hold.
fn zip_time(time: SystemTime) -> Option<DateTime> {
    let secs = time.duration_since(SystemTime::UNIX_EPOCH).ok()?.as_secs() as i64;
    let (days, rest) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    // Days since 1970 to a date (Howard Hinnant's algorithm).
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = (doy - (153 * mp + 2) / 5 + 1) as u8;
    let month = if mp < 10 { mp + 3 } else { mp - 9 } as u8;
    let year = (yoe + era * 400 + i64::from(month <= 2)) as u16;
    DateTime::from_date_and_time(year, month, day, (rest / 3600) as u8, (rest % 3600 / 60) as u8, (rest % 60) as u8).ok()
}

/// Zips the project at `root` into its folder of backups in `dest`, as "<name> <stamp>.zip",
/// then deletes the oldest beyond `keep`. With `only_if_changed`, nothing is written when no
/// file changed since the last backup. Returns the new file's path, or None.
#[tauri::command]
pub fn backup_project(root: String, dest: String, name: String, stamp: String, keep: usize, only_if_changed: bool) -> Result<Option<String>, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Not a folder: {root}"));
    }
    let mut entries = Vec::new();
    collect(&root_path, &root_path, &mut entries)?;
    let dir = project_dir(Path::new(&dest), &name, &root, true)?.ok_or("No folder for the backups")?;
    if only_if_changed && let Some(last) = backups(&dir).last().and_then(|p| modified(p)) {
        let newest = entries.iter().filter_map(|(_, p, _)| modified(p)).chain(modified(&root_path)).max();
        if newest.is_none_or(|t| t <= last) {
            return Ok(None);
        }
    }

    let target = dir.join(format!("{name} {stamp}.zip"));
    let partial = dir.join(format!(".{name} {stamp}.zip.partial"));
    let written = (|| -> Result<(), String> {
        let mut zip = ZipWriter::new(fs::File::create(&partial).map_err(err)?);
        let base = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated).large_file(true);
        for (rel, path, is_dir) in &entries {
            let mut options = base;
            if let Some(time) = modified(path).and_then(zip_time) {
                options = options.last_modified_time(time);
            }
            let inside = format!("{name}/{rel}");
            if *is_dir {
                zip.add_directory(inside, options).map_err(|e| e.to_string())?;
            } else {
                // A file that vanished since the listing is simply left out.
                let Ok(data) = fs::read(path) else { continue };
                zip.start_file(inside, options).map_err(|e| e.to_string())?;
                zip.write_all(&data).map_err(err)?;
            }
        }
        zip.finish().map_err(|e| e.to_string())?;
        Ok(())
    })();
    if let Err(e) = written {
        let _ = fs::remove_file(&partial);
        return Err(e);
    }
    fs::rename(&partial, &target).map_err(err)?;

    let all = backups(&dir);
    let extra = all.len().saturating_sub(keep.max(1));
    for old in &all[..extra] {
        let _ = fs::remove_file(old);
    }
    Ok(Some(target.to_string_lossy().into_owned()))
}

#[derive(Serialize)]
pub struct BackupInfo {
    /// The project's folder of backups, when there is one.
    dir: Option<String>,
    /// The most recent backup.
    latest: Option<String>,
    count: usize,
}

/// Where the backups of the project at `root` are, and the latest of them.
#[tauri::command]
pub fn list_backups(root: String, dest: String, name: String) -> Result<BackupInfo, String> {
    let Some(dir) = project_dir(Path::new(&dest), &name, &root, false)? else {
        return Ok(BackupInfo { dir: None, latest: None, count: 0 });
    };
    let all = backups(&dir);
    Ok(BackupInfo {
        dir: Some(dir.to_string_lossy().into_owned()),
        latest: all.last().map(|p| p.to_string_lossy().into_owned()),
        count: all.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("dante-backup-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn project(at: &Path) {
        fs::create_dir_all(at.join("Manoscritto/010 Uno")).unwrap();
        fs::create_dir_all(at.join(".dante/presence")).unwrap();
        fs::create_dir_all(at.join("export")).unwrap();
        fs::write(at.join("dante.yaml"), "title: Prova\n").unwrap();
        fs::write(at.join("Manoscritto/010 Uno/010 Inizio.md"), "C'era una volta.\n").unwrap();
        fs::write(at.join(".dante/presence/Anna.json"), "{}").unwrap();
        fs::write(at.join("export/Prova.docx"), "x").unwrap();
    }

    #[test]
    fn zips_the_project_and_keeps_the_latest() {
        let base = temp("zip");
        let root = base.join("Prova");
        project(&root);
        let dest = base.join("Dante backup");
        let (r, d) = (root.to_string_lossy().into_owned(), dest.to_string_lossy().into_owned());

        let first = backup_project(r.clone(), d.clone(), "Prova".into(), "2026-10-26 10-00-00".into(), 2, true).unwrap().unwrap();
        let mut archive = zip::ZipArchive::new(fs::File::open(&first).unwrap()).unwrap();
        let mut names: Vec<String> = archive.file_names().map(|n| n.unwrap().into_owned()).collect();
        names.sort();
        assert!(names.contains(&"Prova/Manoscritto/010 Uno/010 Inizio.md".to_string()));
        assert!(names.contains(&"Prova/dante.yaml".to_string()));
        assert!(!names.iter().any(|n| n.contains("presence") && n.ends_with(".json")));
        assert!(!names.iter().any(|n| n.starts_with("Prova/export")));
        let mut text = String::new();
        archive.by_name("Prova/Manoscritto/010 Uno/010 Inizio.md").unwrap().read_to_string(&mut text).unwrap();
        assert_eq!(text, "C'era una volta.\n");

        // Nothing changed: no new backup.
        assert_eq!(backup_project(r.clone(), d.clone(), "Prova".into(), "2026-10-26 11-00-00".into(), 2, true).unwrap(), None);
        // Asked for anyway, then the oldest goes beyond two.
        backup_project(r.clone(), d.clone(), "Prova".into(), "2026-10-26 12-00-00".into(), 2, false).unwrap().unwrap();
        backup_project(r.clone(), d.clone(), "Prova".into(), "2026-10-26 13-00-00".into(), 2, false).unwrap().unwrap();
        let info = list_backups(r.clone(), d.clone(), "Prova".into()).unwrap();
        assert_eq!(info.count, 2);
        assert!(info.latest.unwrap().ends_with("Prova 2026-10-26 13-00-00.zip"));
        assert!(!Path::new(&first).exists());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn keeps_two_projects_of_the_same_name_apart() {
        let base = temp("names");
        let (a, b) = (base.join("a/Romanzo"), base.join("b/Romanzo"));
        project(&a);
        project(&b);
        let dest = base.join("backups").to_string_lossy().into_owned();
        backup_project(a.to_string_lossy().into(), dest.clone(), "Romanzo".into(), "2026-10-26 10-00-00".into(), 1, false).unwrap();
        let second = backup_project(b.to_string_lossy().into(), dest.clone(), "Romanzo".into(), "2026-10-26 10-00-00".into(), 1, false).unwrap().unwrap();
        assert!(second.contains("Romanzo 2"));
        assert_eq!(list_backups(a.to_string_lossy().into(), dest, "Romanzo".into()).unwrap().count, 1);
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn writes_zip_dates() {
        let t = SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1_793_007_921);
        let d = zip_time(t).unwrap();
        assert_eq!((d.year(), d.month(), d.day()), (2026, 10, 26));
    }
}

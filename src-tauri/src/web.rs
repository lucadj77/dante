use std::io::Read;

// Images written as web addresses are downloaded into the project, so they reach the
// export and stay when the site removes them. The webview cannot fetch them itself:
// most sites do not allow it from another origin.

/// The largest image Dante downloads.
const LIMIT: u64 = 50 * 1024 * 1024;

fn fetch(url: &str) -> Result<Vec<u8>, String> {
    let lower = url.to_ascii_lowercase();
    if !lower.starts_with("https://") && !lower.starts_with("http://") {
        return Err("only http and https addresses can be downloaded".into());
    }
    let mut response = ureq::get(url).call().map_err(|e| e.to_string())?;
    let mut bytes = Vec::new();
    response
        .body_mut()
        .as_reader()
        .take(LIMIT + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > LIMIT {
        return Err("the image is larger than 50 MB".into());
    }
    Ok(bytes)
}

/// Downloads the file at `url` and returns its bytes as they are.
#[tauri::command]
pub async fn download_url(url: String) -> Result<tauri::ipc::Response, String> {
    let bytes = tauri::async_runtime::spawn_blocking(move || fetch(&url))
        .await
        .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuses_other_schemes() {
        assert!(fetch("file:///etc/passwd").is_err());
        assert!(fetch("ftp://example.org/a.png").is_err());
    }
}

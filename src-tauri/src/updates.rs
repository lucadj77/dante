use serde::{Deserialize, Serialize};
use tauri::{Manager, Runtime, Url, Webview};
use tauri_plugin_updater::UpdaterExt;

// Updates come from the releases on GitHub, each with a latest.json naming its files.
// The stable channel reads the latest official release, which GitHub keeps at a fixed
// address; the beta channel reads the list of releases and takes the highest version,
// beta or not. Tauri's updater then checks that one release only, so a stable copy is
// never offered a beta. The rest (download, install) goes through the updater plugin.

const REPO: &str = "lucadj77/dante";

/// What the updater plugin's own `check` returns, so the page can make an `Update` of it.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    rid: tauri::ResourceId,
    current_version: String,
    version: String,
    body: Option<String>,
    raw_json: serde_json::Value,
}

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

/// The address of the latest.json of the newest release, beta or not, among `releases`.
/// Only tags v<version> count: the old "preview" release does not.
fn newest_manifest(releases: &[Release]) -> Option<String> {
    releases
        .iter()
        .filter(|r| !r.draft)
        .filter_map(|r| {
            let version = semver::Version::parse(r.tag_name.strip_prefix('v')?).ok()?;
            let manifest = r.assets.iter().find(|a| a.name == "latest.json")?;
            Some((version, manifest.browser_download_url.clone()))
        })
        .max_by(|a, b| a.0.cmp(&b.0))
        .map(|(_, url)| url)
}

fn beta_manifest() -> Result<String, String> {
    let url = format!("https://api.github.com/repos/{REPO}/releases?per_page=30");
    let mut response = ureq::get(&url)
        .header("User-Agent", "Dante")
        .header("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| e.to_string())?;
    let text = response.body_mut().read_to_string().map_err(|e| e.to_string())?;
    let releases: Vec<Release> = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    newest_manifest(&releases).ok_or_else(|| "no release with an update manifest".into())
}

/// Looks for a newer version on `channel` ("stable" or "beta").
#[tauri::command]
pub async fn check_update<R: Runtime>(webview: Webview<R>, channel: String) -> Result<Option<Metadata>, String> {
    let endpoint = if channel == "beta" {
        tauri::async_runtime::spawn_blocking(beta_manifest).await.map_err(|e| e.to_string())??
    } else {
        format!("https://github.com/{REPO}/releases/latest/download/latest.json")
    };
    let url = Url::parse(&endpoint).map_err(|e| e.to_string())?;
    let updater = webview
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;
    let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    Ok(Some(Metadata {
        current_version: update.current_version.clone(),
        version: update.version.clone(),
        body: update.body.clone(),
        raw_json: update.raw_json.clone(),
        rid: webview.resources_table().add(update),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag: &str, manifest: bool) -> Release {
        let assets = if manifest {
            vec![Asset { name: "latest.json".into(), browser_download_url: format!("https://example.com/{tag}/latest.json") }]
        } else {
            vec![]
        };
        Release { tag_name: tag.into(), draft: false, assets }
    }

    #[test]
    fn the_beta_channel_takes_the_highest_version() {
        let releases = [
            release("v1.0.3", true),
            release("v1.1.0-beta.2", true),
            release("v1.1.0-beta.10", true),
            release("preview", true),
            release("v1.2.0-beta.1", false),
        ];
        assert_eq!(newest_manifest(&releases).unwrap(), "https://example.com/v1.1.0-beta.10/latest.json");
        let stable_after = [release("v1.1.0-beta.2", true), release("v1.1.0", true)];
        assert_eq!(newest_manifest(&stable_after).unwrap(), "https://example.com/v1.1.0/latest.json");
        assert!(newest_manifest(&[release("preview", true)]).is_none());
    }
}

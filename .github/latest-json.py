"""Writes latest.json, the update manifest the installed copies of Dante read.

Usage: latest-json.py <folder of release files> <version> <download address> [news.json]

news.json, written by news.py history, lists the notes of every version in Italian and
English; Dante's update banner shows those newer than the installed version.

Each signature (.sig) next to a release file becomes the entry of one system, named as
Tauri's updater looks for it: {os}-{arch}-{bundle}. Without signatures (the signing key
is not set) no manifest is written, and installed copies find no update.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

folder, version, base = sys.argv[1:4]
news = json.loads(Path(sys.argv[4]).read_text(encoding="utf-8")) if len(sys.argv) > 4 else {}

# The end of each update file's name, as the Builds workflow writes it, and its target.
TARGETS = {
    "-setup-{version}.exe": "windows-x86_64-nsis",
    "-{version}-mac-apple-silicon.app.tar.gz": "darwin-aarch64-app",
    "-{version}-mac-intel.app.tar.gz": "darwin-x86_64-app",
    "-{version}-x86_64.AppImage": "linux-x86_64-appimage",
    "-{version}-amd64.deb": "linux-x86_64-deb",
    "-{version}-x86_64.rpm": "linux-x86_64-rpm",
}

platforms = {}
for sig in sorted(Path(folder).glob("*.sig")):
    name = sig.name.removesuffix(".sig")
    for ending, target in TARGETS.items():
        if name == "Dante" + ending.format(version=version):
            platforms[target] = {"signature": sig.read_text().strip(), "url": f"{base}/{name}"}

if not platforms:
    print("No signatures: no update manifest.")
    sys.exit(0)

manifest = {
    "version": version,
    "notes": f"Dante {version}",
    "pub_date": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "platforms": platforms,
}
if news:
    manifest["news"] = news
Path(folder, "latest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
print(json.dumps(manifest, indent=2))

#!/usr/bin/env bash
# Writes src-tauri/ci.conf.json, merged into tauri.conf.json by `tauri build --config`:
# the version of this build and, when the signing key is available, the signed files
# the automatic update downloads.
set -euo pipefail
config="\"version\":\"$1\""
if [ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  config="$config,\"bundle\":{\"createUpdaterArtifacts\":true}"
fi
echo "{$config}" > src-tauri/ci.conf.json
cat src-tauri/ci.conf.json

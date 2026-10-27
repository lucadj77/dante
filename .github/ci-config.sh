#!/usr/bin/env bash
# Writes src-tauri/ci.conf.json, merged into tauri.conf.json by `tauri build --config`:
# when the signing key is available, the signed files the automatic update downloads.
# The version is the one in package.json (tauri.conf.json points to it), written there by
# the Release workflow.
set -euo pipefail
config=""
if [ -n "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  config="\"bundle\":{\"createUpdaterArtifacts\":true}"
fi
echo "{$config}" > src-tauri/ci.conf.json
cat src-tauri/ci.conf.json

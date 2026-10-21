#!/usr/bin/env bash
# Checks the built page and its scripts name the same SvelteKit global: when they differ
# Dante opens blank (0.1.43, a version name computed twice during the build).
set -euo pipefail
page=$(grep -o "__sveltekit_[a-z0-9]*" build/index.html | sort -u)
scripts=$(grep -rho "__sveltekit_[a-z0-9]*" build/_app/immutable | sort -u)
echo "page: $page / scripts: $scripts"
[ -n "$page" ] && [ "$page" = "$scripts" ]

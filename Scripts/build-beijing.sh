#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/build-common.sh"

build_version_packages \
    "Beijing" \
    "SubwaySurfers-Beijing-Linux" \
    "subwaysurfers-beijing" \
    "subwaysurfers-beijing" \
    "subwaysurfers-beijing.desktop" \
    "$REPO_ROOT/Source/Beijing/assets/4399.png" \
    "subwaysurfers-beijing.png" \
    "$REPO_ROOT"

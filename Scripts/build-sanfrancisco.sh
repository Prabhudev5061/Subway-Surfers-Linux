#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/build-common.sh"

build_version_packages \
    "SanFrancisco" \
    "SubwaySurfers-SanFrancisco-Linux" \
    "subwaysurfers-sanfrancisco" \
    "subwaysurfers-sanfrancisco" \
    "subwaysurfers-sanfrancisco.desktop" \
    "$REPO_ROOT/Source/SanFrancisco/assets/subwaysurfers.png" \
    "subwaysurfers-sanfrancisco.png" \
    "$REPO_ROOT"

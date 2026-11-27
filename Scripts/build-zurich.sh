#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/build-common.sh"

build_version_packages \
    "Zurich" \
    "SubwaySurfers-Zurich-Linux" \
    "subwaysurfers-zurich" \
    "subwaysurfers-zurich" \
    "subwaysurfers-zurich.desktop" \
    "$REPO_ROOT/Source/Zurich/assets/subwaysurfers-zurich.png" \
    "subwaysurfers-zurich.png" \
    "$REPO_ROOT"

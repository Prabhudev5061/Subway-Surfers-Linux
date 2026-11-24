#!/bin/bash
# ==============================================================================
# Reproducible Build Script: Subway Surfers Linux AppImage
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/app"
BUILD_DIR="$PROJECT_ROOT/build"

# Locate base AppImage
BASE_APPIMAGE="${1:-$PROJECT_ROOT/backups/SubwaySurfers-x86-64.AppImage.orig}"
if [ ! -f "$BASE_APPIMAGE" ]; then
    BASE_APPIMAGE="$PROJECT_ROOT/../SubwaySurfers-x86-64.AppImage"
fi

if [ ! -f "$BASE_APPIMAGE" ]; then
    echo "Error: Base AppImage not found at $BASE_APPIMAGE. Please supply path as argument: $0 <path_to_base.AppImage>"
    exit 1
fi

echo "=== Building Subway Surfers AppImage ==="
echo "Base AppImage: $BASE_APPIMAGE"
echo "Output Directory: $OUTPUT_DIR"

mkdir -p "$BUILD_DIR" "$OUTPUT_DIR"

echo "1. Extracting AppImage runtime (offset 0..189632)..."
head -c 189632 "$BASE_APPIMAGE" > "$BUILD_DIR/runtime"

echo "2. Unpacking upstream SquashFS filesystem..."
rm -rf "$BUILD_DIR/squashfs-root"
unsquashfs -d "$BUILD_DIR/squashfs-root" -o 189632 "$BASE_APPIMAGE"

echo "3. Applying Linux AutoSave patches..."
cp "$PROJECT_ROOT/source/main.js" "$BUILD_DIR/squashfs-root/resources/app/main.js"
cp "$PROJECT_ROOT/source/preload.js" "$BUILD_DIR/squashfs-root/resources/app/preload.js"
cp "$PROJECT_ROOT/source/autosave_manager.js" "$BUILD_DIR/squashfs-root/html/autosave_manager.js"
cp "$PROJECT_ROOT/source/4399.js" "$BUILD_DIR/squashfs-root/html/4399.js"
cp "$PROJECT_ROOT/source/index.html" "$BUILD_DIR/squashfs-root/html/index.html"
cp "$PROJECT_ROOT/source/AppRun" "$BUILD_DIR/squashfs-root/AppRun"
cp "$PROJECT_ROOT/source/subwaysurfers.desktop" "$BUILD_DIR/squashfs-root/subwaysurfers.desktop"
cp "$PROJECT_ROOT/source/subwaysurfers.png" "$BUILD_DIR/squashfs-root/subwaysurfers.png"
chmod 755 "$BUILD_DIR/squashfs-root/AppRun"

echo "4. Generating SquashFS filesystem (gzip compression, 128K block size)..."
rm -f "$BUILD_DIR/app.squashfs"
mksquashfs "$BUILD_DIR/squashfs-root" "$BUILD_DIR/app.squashfs" -comp gzip -b 131072 -root-owned -noappend

echo "5. Assembling Type 2 AppImage binary..."
cat "$BUILD_DIR/runtime" "$BUILD_DIR/app.squashfs" > "$OUTPUT_DIR/SubwaySurfers-AutoSave-Fixed-x86_64.AppImage"
chmod 755 "$OUTPUT_DIR/SubwaySurfers-AutoSave-Fixed-x86_64.AppImage"

echo "6. Cleaning temporary build files..."
rm -rf "$BUILD_DIR/squashfs-root" "$BUILD_DIR/app.squashfs" "$BUILD_DIR/runtime"

echo "=== AppImage build complete: $OUTPUT_DIR/SubwaySurfers-AutoSave-Fixed-x86_64.AppImage ==="

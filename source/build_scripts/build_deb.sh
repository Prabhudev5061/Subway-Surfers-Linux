#!/bin/bash
# ==============================================================================
# Reproducible Build Script: Subway Surfers Linux Debian Package (.deb)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="$PROJECT_ROOT/app"
BUILD_DIR="$PROJECT_ROOT/build"
DEB_TREE="$BUILD_DIR/deb-tree"

# Locate base AppImage or existing app tree
BASE_APPIMAGE="${1:-$PROJECT_ROOT/backups/SubwaySurfers-x86-64.AppImage.orig}"
if [ ! -f "$BASE_APPIMAGE" ]; then
    BASE_APPIMAGE="$PROJECT_ROOT/../SubwaySurfers-x86-64.AppImage"
fi

if [ ! -f "$BASE_APPIMAGE" ]; then
    echo "Error: Base AppImage not found at $BASE_APPIMAGE. Please supply path as argument: $0 <path_to_base.AppImage>"
    exit 1
fi

echo "=== Building Subway Surfers Debian Package ==="
echo "Base AppImage: $BASE_APPIMAGE"
echo "Output Directory: $OUTPUT_DIR"

mkdir -p "$BUILD_DIR" "$OUTPUT_DIR"
rm -rf "$DEB_TREE"
mkdir -p "$DEB_TREE/opt/subwaysurfers" "$DEB_TREE/usr/bin" "$DEB_TREE/usr/share/applications" "$DEB_TREE/usr/share/icons/hicolor/512x512/apps" "$DEB_TREE/DEBIAN"

echo "1. Unpacking base application..."
rm -rf "$BUILD_DIR/deb-app-root"
unsquashfs -d "$BUILD_DIR/deb-app-root" -o 189632 "$BASE_APPIMAGE"

echo "2. Applying patches to application tree..."
cp "$PROJECT_ROOT/source/main.js" "$BUILD_DIR/deb-app-root/resources/app/main.js"
cp "$PROJECT_ROOT/source/preload.js" "$BUILD_DIR/deb-app-root/resources/app/preload.js"
cp "$PROJECT_ROOT/source/autosave_manager.js" "$BUILD_DIR/deb-app-root/html/autosave_manager.js"
cp "$PROJECT_ROOT/source/4399.js" "$BUILD_DIR/deb-app-root/html/4399.js"
cp "$PROJECT_ROOT/source/index.html" "$BUILD_DIR/deb-app-root/html/index.html"
cp "$PROJECT_ROOT/source/AppRun" "$BUILD_DIR/deb-app-root/AppRun"
cp "$PROJECT_ROOT/source/subwaysurfers.desktop" "$BUILD_DIR/deb-app-root/subwaysurfers.desktop"
cp "$PROJECT_ROOT/source/subwaysurfers.png" "$BUILD_DIR/deb-app-root/subwaysurfers.png"

echo "3. Populating Debian package hierarchy..."
cp -a "$BUILD_DIR/deb-app-root/"* "$DEB_TREE/opt/subwaysurfers/"
ln -sf /opt/subwaysurfers/AppRun "$DEB_TREE/usr/bin/subwaysurfers"
cp "$PROJECT_ROOT/source/subwaysurfers.desktop" "$DEB_TREE/usr/share/applications/"
cp "$PROJECT_ROOT/source/subwaysurfers.png" "$DEB_TREE/usr/share/icons/hicolor/512x512/apps/"

# Copy control files
cp "$SCRIPT_DIR/debian/control" "$DEB_TREE/DEBIAN/"
cp "$SCRIPT_DIR/debian/postinst" "$DEB_TREE/DEBIAN/"
cp "$SCRIPT_DIR/debian/postrm" "$DEB_TREE/DEBIAN/"
chmod 755 "$DEB_TREE/DEBIAN/postinst" "$DEB_TREE/DEBIAN/postrm"

echo "4. Packaging Debian package via dpkg-deb..."
dpkg-deb --build "$DEB_TREE" "$OUTPUT_DIR/SubwaySurfers-AutoSave-Fixed-amd64.deb"

echo "5. Cleaning temporary build files..."
rm -rf "$BUILD_DIR/deb-app-root" "$DEB_TREE"

echo "=== Debian package build complete: $OUTPUT_DIR/SubwaySurfers-AutoSave-Fixed-amd64.deb ==="

#!/bin/bash
# ==============================================================================
# Subway Surfers Linux (Verified AutoSave Fixed Edition) - Universal Installer
# ==============================================================================
# Supports:
#   1. Native Debian/Ubuntu package installation (.deb via apt/dpkg)
#   2. User-space AppImage desktop integration (No root / sudo required)
#   3. Automated flags: --user, --deb, --system
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="Subway Surfers"
BIN_NAME="subwaysurfers"
DEB_NAME="SubwaySurfers-AutoSave-Fixed-amd64.deb"
APPIMAGE_NAME="SubwaySurfers-AutoSave-Fixed-x86_64.AppImage"

# Search paths for artifacts
DEB_FILE=""
APPIMAGE_FILE=""

for p in "$SCRIPT_DIR/$DEB_NAME" "$SCRIPT_DIR/../app/$DEB_NAME" "$SCRIPT_DIR/app/$DEB_NAME"; do
    if [ -f "$p" ]; then
        DEB_FILE="$p"
        break
    fi
done

for p in "$SCRIPT_DIR/$APPIMAGE_NAME" "$SCRIPT_DIR/../app/$APPIMAGE_NAME" "$SCRIPT_DIR/app/$APPIMAGE_NAME"; do
    if [ -f "$p" ]; then
        APPIMAGE_FILE="$p"
        break
    fi
done

MODE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --user)
            MODE="user"
            shift
            ;;
        --deb|--system)
            MODE="deb"
            shift
            ;;
        -h|--help)
            echo "Usage: ./install.sh [OPTIONS]"
            echo "Options:"
            echo "  --user    Install standalone AppImage and desktop shortcut for current user only"
            echo "  --deb     Install system-wide Debian package (.deb) using dpkg/sudo"
            echo "  --help    Show this message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "===================================================================="
echo "      Subway Surfers Verified AutoSave System - Linux Installer     "
echo "===================================================================="
echo "Game: Subway Surfers (World Tour: San Francisco 1.94.0)"
echo "Features: Atomic Save Hooks, Non-blocking Exit Flush, Cross-Hash Mirror"
echo "Architecture: x86_64 / amd64"
echo "Credits: Based on original Linux AppImage by Drizzle"
echo "         https://www.appimagehub.com/p/2299024"
echo "===================================================================="
echo ""

# Detection of installation mode
if [ "$MODE" = "deb" ] || { [ -z "$MODE" ] && [ -n "$DEB_FILE" ] && command -v dpkg >/dev/null 2>&1 && [ "$EUID" -eq 0 ]; }; then
    echo "[Mode] Installing native Debian package system-wide..."
    if [ -z "$DEB_FILE" ]; then
        echo "Error: Debian package $DEB_NAME not found."
        exit 1
    fi
    if [ "$EUID" -eq 0 ]; then
        dpkg -i "$DEB_FILE" || apt-get install -f -y
    elif command -v sudo >/dev/null 2>&1; then
        echo "Root privileges required for system deb installation. Prompting sudo:"
        sudo dpkg -i "$DEB_FILE" || sudo apt-get install -f -y
    else
        echo "Error: Root or sudo required for Debian installation. Re-run as root or use --user."
        exit 1
    fi
    echo ""
    echo "===================================================================="
    echo "Installation complete! Launch from application menu or run 'subwaysurfers'"
    echo "===================================================================="
    exit 0
fi

# User-space AppImage integration mode
echo "[Mode] Installing AppImage into user desktop environment..."
if [ -z "$APPIMAGE_FILE" ]; then
    echo "Error: AppImage package $APPIMAGE_NAME not found."
    exit 1
fi

USER_BIN_DIR="$HOME/.local/bin"
USER_APP_DIR="$HOME/.local/share/applications"
USER_ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"

mkdir -p "$USER_BIN_DIR" "$USER_APP_DIR" "$USER_ICON_DIR"

TARGET_APPIMAGE="$USER_BIN_DIR/$APPIMAGE_NAME"
echo "  -> Copying AppImage to $TARGET_APPIMAGE..."
cp -f "$APPIMAGE_FILE" "$TARGET_APPIMAGE"
chmod +x "$TARGET_APPIMAGE"

# Symlink to subwaysurfers command
ln -sf "$TARGET_APPIMAGE" "$USER_BIN_DIR/$BIN_NAME"

# Extract icon if icon image exists in script or package
ICON_SRC=""
for p in "$SCRIPT_DIR/subwaysurfers.png" "$SCRIPT_DIR/../source/subwaysurfers.png" "$SCRIPT_DIR/source/subwaysurfers.png"; do
    if [ -f "$p" ]; then
        ICON_SRC="$p"
        break
    fi
done

if [ -n "$ICON_SRC" ]; then
    cp -f "$ICON_SRC" "$USER_ICON_DIR/subwaysurfers.png"
fi

# Create Desktop entry
DESKTOP_ENTRY="$USER_APP_DIR/subwaysurfers.desktop"
echo "  -> Creating desktop shortcut at $DESKTOP_ENTRY..."
cat <<EOF > "$DESKTOP_ENTRY"
[Desktop Entry]
Name=Subway Surfers
Comment=Subway Surfers World Tour: San Francisco (AutoSave Fixed Edition)
Exec="$TARGET_APPIMAGE" %U
Icon=subwaysurfers
Terminal=false
Type=Application
Categories=Game;ArcadeGame;
StartupWMClass=SubwaySurfers
Keywords=subway;surfers;game;runner;arcade;
EOF

chmod +x "$DESKTOP_ENTRY"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$USER_APP_DIR" >/dev/null 2>&1 || true
fi

echo ""
echo "===================================================================="
echo "Installation complete!"
echo "  - Application executable: $USER_BIN_DIR/$BIN_NAME"
echo "  - Desktop Shortcut: $DESKTOP_ENTRY"
if [[ ":$PATH:" != *":$USER_BIN_DIR:"* ]]; then
    echo "  - Tip: Add '$USER_BIN_DIR' to your PATH to run 'subwaysurfers' directly."
fi
echo "Launch Subway Surfers from your desktop launcher or run: $TARGET_APPIMAGE"
echo "===================================================================="

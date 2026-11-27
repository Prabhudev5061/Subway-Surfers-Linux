#!/bin/bash
# ==============================================================================
# SubwaySurfers-SanFrancisco-Linux — Standalone Bash Installer
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REQ_DIR="$SCRIPT_DIR/required-files"

APP_ID="SubwaySurfers-SanFrancisco-Linux"
DISPLAY_NAME="Subway Surfers: San Francisco"
BIN_NAME="subwaysurfers-sanfrancisco"
PKG_NAME="subwaysurfers-sanfrancisco-linux"
APPIMAGE_NAME="SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage"
DEB_NAME="SubwaySurfers-SanFrancisco-Linux-amd64.deb"
ICON_NAME="subwaysurfers-sanfrancisco.png"
DESKTOP_NAME="subwaysurfers-sanfrancisco.desktop"

MODE=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --user) MODE="user"; shift ;;
        --deb|--system) MODE="deb"; shift ;;
        -h|--help)
            echo "Usage: $0 [--user | --deb]"
            echo "  --user    Install standalone AppImage for current user (default)"
            echo "  --deb     Install system-wide Debian package (.deb)"
            exit 0
            ;;
        *)
            echo "Error: Unknown option '$1'" >&2
            exit 1
            ;;
    esac
done

ARCH="$(uname -m)"
if [ "$ARCH" != "x86_64" ] && [ "$ARCH" != "amd64" ]; then
    echo "Error: Unsupported architecture '$ARCH'. $APP_ID requires x86_64 / amd64." >&2
    exit 1
fi

for cmd in chmod ln mkdir cp; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "Error: Required command '$cmd' not found." >&2
        exit 1
    fi
done

# Check shared system libraries expected by Electron runtime
if command -v ldconfig >/dev/null 2>&1; then
    missing_libs=()
    for lib in libnss3.so libgtk-3.so.0 libgbm.so.1 libasound.so.2; do
        if ! ldconfig -p 2>/dev/null | grep -q "$lib"; then
            missing_libs+=("$lib")
        fi
    done
    if [ "${#missing_libs[@]}" -gt 0 ]; then
        echo "Warning: Missing runtime libraries detected (${missing_libs[*]}). Install libnss3 libgtk-3-0 libgbm1 libasound2 if launch fails." >&2
    fi
fi

find_required() {
    local fname="$1"
    for candidate in "$REQ_DIR/$fname" "$SCRIPT_DIR/$fname"; do
        if [ -f "$candidate" ]; then
            echo "$candidate"
            return 0
        fi
    done
    return 1
}

echo "===================================================================="
echo "  $APP_ID — Standalone Linux Installer"
echo "===================================================================="
echo "Version:      World Tour: San Francisco (1.94.0)"
echo "Architecture: $ARCH"
echo "Shared Save:  ${XDG_DATA_HOME:-$HOME/.local/share}/SubwaySurfers-Linux/Save/"
echo "===================================================================="

if [ "$MODE" = "deb" ] || { [ -z "$MODE" ] && [ "$EUID" -eq 0 ] && find_required "$DEB_NAME" >/dev/null; }; then
    DEB_FILE="$(find_required "$DEB_NAME" || true)"
    if [ -z "$DEB_FILE" ]; then
        echo "Error: Required Debian package '$DEB_NAME' not found in '$REQ_DIR'." >&2
        exit 1
    fi
    if ! command -v dpkg >/dev/null 2>&1; then
        echo "Error: 'dpkg' is required for --deb installation." >&2
        exit 1
    fi
    if [ "$EUID" -eq 0 ]; then
        dpkg -i "$DEB_FILE" || apt-get install -f -y
    elif command -v sudo >/dev/null 2>&1; then
        sudo dpkg -i "$DEB_FILE" || sudo apt-get install -f -y
    else
        echo "Error: Root or sudo privileges are required for --deb installation. Use --user instead." >&2
        exit 1
    fi
    echo "Installation complete. Launch '$BIN_NAME' or '$DISPLAY_NAME'."
    exit 0
fi

APPIMAGE_FILE="$(find_required "$APPIMAGE_NAME" || true)"
ICON_FILE="$(find_required "$ICON_NAME" || true)"
DESKTOP_FILE="$(find_required "$DESKTOP_NAME" || true)"

if [ -z "$APPIMAGE_FILE" ]; then
    echo "Error: Required AppImage '$APPIMAGE_NAME' not found in '$REQ_DIR'." >&2
    exit 1
fi
if [ -z "$ICON_FILE" ]; then
    echo "Error: Required icon '$ICON_NAME' not found in '$REQ_DIR'." >&2
    exit 1
fi

USER_BIN_DIR="$HOME/.local/bin"
USER_APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
USER_ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/512x512/apps"
USER_PIXMAP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/512x512/apps"
SHARED_SAVE_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/SubwaySurfers-Linux/Save"

mkdir -p "$USER_BIN_DIR" "$USER_APP_DIR" "$USER_ICON_DIR" "$SHARED_SAVE_DIR"

TARGET_APPIMAGE="$USER_BIN_DIR/$APPIMAGE_NAME"
cp -f "$APPIMAGE_FILE" "$TARGET_APPIMAGE"
chmod 755 "$TARGET_APPIMAGE"
ln -sf "$TARGET_APPIMAGE" "$USER_BIN_DIR/$BIN_NAME"

cp -f "$ICON_FILE" "$USER_ICON_DIR/$ICON_NAME"

TARGET_DESKTOP="$USER_APP_DIR/$DESKTOP_NAME"
if [ -n "$DESKTOP_FILE" ]; then
    sed "s|^Exec=.*|Exec=\"$TARGET_APPIMAGE\" %U|" "$DESKTOP_FILE" > "$TARGET_DESKTOP"
else
    cat <<EOF > "$TARGET_DESKTOP"
[Desktop Entry]
Name=$DISPLAY_NAME
Comment=Subway Surfers World Tour: San Francisco (Unified Shared Save Edition)
Exec="$TARGET_APPIMAGE" %U
Icon=subwaysurfers-sanfrancisco
Terminal=false
Type=Application
Categories=Game;ArcadeGame;
StartupWMClass=$APP_ID
Keywords=subway;surfers;sanfrancisco;game;runner;arcade;
EOF
fi
chmod 644 "$TARGET_DESKTOP"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$USER_APP_DIR" >/dev/null 2>&1 || true
fi

echo "Installed $APP_ID:"
echo "  Executable:   $USER_BIN_DIR/$BIN_NAME"
echo "  AppImage:     $TARGET_APPIMAGE"
echo "  Desktop:      $TARGET_DESKTOP"
echo "  Icon:         $USER_ICON_DIR/$ICON_NAME"
echo "  Shared Saves: $SHARED_SAVE_DIR (preserved)"

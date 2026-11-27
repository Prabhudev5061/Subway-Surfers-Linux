#!/bin/bash
# ==============================================================================
# SubwaySurfers-SanFrancisco-Linux — Safe Uninstaller
# Preserves ~/.local/share/SubwaySurfers-Linux/Save/ and SubwaySurfers-Beijing-Linux.
# ==============================================================================
set -e

APP_ID="SubwaySurfers-SanFrancisco-Linux"
BIN_NAME="subwaysurfers-sanfrancisco"
PKG_NAME="subwaysurfers-sanfrancisco-linux"
APPIMAGE_NAME="SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage"
ICON_NAME="subwaysurfers-sanfrancisco.png"
DESKTOP_NAME="subwaysurfers-sanfrancisco.desktop"

USER_BIN_DIR="$HOME/.local/bin"
USER_APP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
USER_ICON_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/512x512/apps"
SHARED_SAVE_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/SubwaySurfers-Linux/Save"

if command -v dpkg >/dev/null 2>&1 && dpkg -s "$PKG_NAME" >/dev/null 2>&1; then
    if [ "$EUID" -eq 0 ]; then
        dpkg -r "$PKG_NAME"
    elif command -v sudo >/dev/null 2>&1; then
        sudo dpkg -r "$PKG_NAME"
    else
        echo "Warning: Root/sudo required to remove system package '$PKG_NAME'." >&2
    fi
fi

rm -f "$USER_BIN_DIR/$APPIMAGE_NAME" \
      "$USER_BIN_DIR/$BIN_NAME" \
      "$USER_APP_DIR/$DESKTOP_NAME" \
      "$USER_ICON_DIR/$ICON_NAME"

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database "$USER_APP_DIR" >/dev/null 2>&1 || true
fi

if [ -d "$SHARED_SAVE_DIR" ]; then
    echo "Shared player saves preserved at: $SHARED_SAVE_DIR"
fi
echo "Uninstalled $APP_ID cleanly."

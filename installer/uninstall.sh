#!/bin/bash
# ==============================================================================
# Subway Surfers Linux - Universal Uninstaller
# ==============================================================================

set -e

APP_NAME="Subway Surfers"
BIN_NAME="subwaysurfers"

echo "===================================================================="
echo "          Subway Surfers AutoSave System - Linux Uninstaller        "
echo "===================================================================="
echo ""

UNINSTALLED=0

# 1. Check for Debian package
if command -v dpkg >/dev/null 2>&1 && dpkg -s subwaysurfers-autosave >/dev/null 2>&1; then
    echo "[Found] System-wide Debian package detected: subwaysurfers-autosave"
    if [ "$EUID" -eq 0 ]; then
        dpkg -r subwaysurfers-autosave
    elif command -v sudo >/dev/null 2>&1; then
        sudo dpkg -r subwaysurfers-autosave
    else
        echo "[WARNING] Root/sudo required to remove deb package. Run: sudo dpkg -r subwaysurfers-autosave"
    fi
    UNINSTALLED=1
fi

# 2. Check for user-space AppImage installation
USER_BIN_DIR="$HOME/.local/bin"
USER_APP_DIR="$HOME/.local/share/applications"
USER_ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"
TARGET_APPIMAGE="$USER_BIN_DIR/SubwaySurfers-AutoSave-Fixed-x86_64.AppImage"
OLD_APPIMAGE="$USER_BIN_DIR/SubwaySurfers-AutoSave-x86_64.AppImage"

if [ -f "$TARGET_APPIMAGE" ] || [ -f "$OLD_APPIMAGE" ] || [ -L "$USER_BIN_DIR/$BIN_NAME" ] || [ -f "$USER_APP_DIR/subwaysurfers.desktop" ]; then
    echo "[Found] User-space standalone installation detected."
    rm -f "$TARGET_APPIMAGE"
    rm -f "$OLD_APPIMAGE"
    rm -f "$USER_BIN_DIR/$BIN_NAME"
    rm -f "$USER_APP_DIR/subwaysurfers.desktop"
    rm -f "$USER_ICON_DIR/subwaysurfers.png"

    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$USER_APP_DIR" >/dev/null 2>&1 || true
    fi
    echo "  -> Removed user-space binaries and desktop shortcuts."
    UNINSTALLED=1
fi

# 3. Clean up runtime symlinks
rm -f /tmp/SubwaySurfers 2>/dev/null || true
rm -f "${XDG_RUNTIME_DIR:-/tmp}/SubwaySurfers_${USER}" 2>/dev/null || true

# 4. Save data management
PROFILE_DIR="$HOME/.config/SubwaySurfersSanfrancisco"
if [ -d "$PROFILE_DIR" ]; then
    echo ""
    echo "Player save data detected at: $PROFILE_DIR"
    if [ -t 0 ]; then
        read -r -p "Do you want to delete player save data? (A backup will be created first) [y/N]: " DEL_DATA
        if [[ "$DEL_DATA" =~ ^[Yy]$ ]]; then
            BACKUP_TAR="$HOME/subwaysurfers_save_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
            tar -czf "$BACKUP_TAR" -C "$HOME/.config" "SubwaySurfersSanfrancisco"
            echo "  -> Backup created at: $BACKUP_TAR"
            rm -rf "$PROFILE_DIR"
            echo "  -> Removed player save directory."
        else
            echo "  -> Player progress preserved at $PROFILE_DIR."
        fi
    else
        echo "  -> Player progress preserved at $PROFILE_DIR (run in terminal to delete)."
    fi
fi

echo ""
if [ "$UNINSTALLED" -eq 1 ]; then
    echo "[SUCCESS] Subway Surfers has been uninstalled from this system."
else
    echo "[NOTICE] No active installation files were found."
fi
echo "===================================================================="

# Subway Surfers Linux — Uninstallation Guide

This guide describes how to cleanly remove Subway Surfers and its associated shortcuts from your Linux system.

---

## Automated Removal

Run the uninstaller script:
```bash
./installer/uninstall.sh
```
The uninstaller automatically detects whether the application was installed as a system-wide Debian package or as a user-space AppImage, removing all binaries and menu shortcuts.

---

## Manual Removal

### 1. Removing User-Space AppImage Installation
Delete the binaries and desktop integration files:
```bash
rm -f ~/.local/bin/SubwaySurfers-AutoSave-Fixed-x86_64.AppImage
rm -f ~/.local/bin/subwaysurfers
rm -f ~/.local/share/applications/subwaysurfers.desktop
rm -f ~/.local/share/icons/hicolor/512x512/apps/subwaysurfers.png
update-desktop-database ~/.local/share/applications 2>/dev/null || true
```

### 2. Removing Debian Package
Run:
```bash
sudo dpkg -r subwaysurfers-autosave
```

---

## Player Save Data Preservation

Neither the automatic uninstaller nor standard package removal scripts touch your personal game progress. 

If you wish to retain your saves, your progress will remain safely at:
```
~/.config/SubwaySurfersSanfrancisco/
```

If you wish to completely wipe your game data and start over, delete this folder:
```bash
rm -rf ~/.config/SubwaySurfersSanfrancisco/
```
*(Warning: This permanently deletes your unlocked characters, coins, keys, and high scores.)*

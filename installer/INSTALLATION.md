# Subway Surfers Linux — Installation Guide

This guide describes how to install and run the modified Subway Surfers Linux distribution with verified automatic save persistence.

---

## Prerequisites

- **Architecture:** x86-64 (amd64)
- **Linux Kernel:** 5.4 or newer (tested on 6.8+)
- **Graphics:** OpenGL 3.3+ / WebGL 2.0 compatible GPU driver (Mesa / NVIDIA / AMD / Intel)
- **FUSE:** `libfuse2` or `fuse3` (required for AppImage execution)

---

## Option 1: Standalone AppImage (Recommended, No Root Required)

The AppImage is completely self-contained and runs on any standard Linux distribution.

### Method A: Automated Desktop Integration
Run the universal installer script with `--user`:
```bash
./installer/install.sh --user
```
This automatically:
- Installs the AppImage to `~/.local/bin/SubwaySurfers-AutoSave-Fixed-x86_64.AppImage`
- Creates a symlink at `~/.local/bin/subwaysurfers`
- Registers the desktop shortcut and high-resolution icon in `~/.local/share/applications`

You can then launch Subway Surfers directly from your desktop application launcher or terminal:
```bash
subwaysurfers
```

### Method B: Direct Execution
You can also run the AppImage file directly without installing:
```bash
chmod +x app/SubwaySurfers-AutoSave-Fixed-x86_64.AppImage
./app/SubwaySurfers-AutoSave-Fixed-x86_64.AppImage
```

---

## Option 2: System-Wide Debian Package (.deb)

For Debian, Ubuntu, Linux Mint, Pop!_OS, and derivatives:

```bash
sudo dpkg -i app/SubwaySurfers-AutoSave-Fixed-amd64.deb
sudo apt-get install -f -y  # Resolves any missing system dependencies
```
Or use the installer:
```bash
sudo ./installer/install.sh --deb
```

Once installed, the command `subwaysurfers` is available in `/usr/bin/subwaysurfers`, and the game appears in your desktop application menu under **Games**.

---

## Troubleshooting

### AppArmor / Unprivileged User Namespaces Notice
On Ubuntu 24.04+ or systems with AppArmor user namespace restrictions, `AppRun` automatically detects the restriction and passes `--no-sandbox` to Electron. No manual configuration is necessary.

### Verifying Player Progress Persistence
Save files are located in your user profile:
```
~/.config/SubwaySurfersSanfrancisco/IndexedDB/file__0.indexeddb.leveldb/
```
The game flushes player progress automatically during gameplay, on character/board purchases, and immediately upon window closure.

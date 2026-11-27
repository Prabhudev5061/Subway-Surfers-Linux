# Installation Guide — `SubwaySurfers-Linux`

Both **Subway Surfers: San Francisco** (`SubwaySurfers-SanFrancisco-Linux`) and **Subway Surfers: Beijing** (`SubwaySurfers-Beijing-Linux`) can be installed independently or side-by-side. Both automatically share `~/.local/share/SubwaySurfers-Linux/Save/`.

---

## 1. Install System Dependencies (Debian / Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y libnss3 libgtk-3-0 libgbm1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libfuse2
```

*(On Ubuntu 24.04+ with `t64` transition packages, `libasound2t64`, `libgtk-3-0t64`, `libatk1.0-0t64`, `libatk-bridge2.0-0t64`, `libcups2t64`, and `libfuse2t64` satisfy these dependencies.)*

---

## 2. Option A — Portable AppImages

Verify checksums first:

```bash
sha256sum -c SHA256SUMS
```

Make executable and run directly:

```bash
# San Francisco
chmod +x "App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage"
"./App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage"

# Beijing
chmod +x "App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage"
"./App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage"
```

Optional windowed launch:

```bash
"./App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage" --windowed
"./App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage" --windowed
```

---

## 3. Option B — Debian Packages (`.deb`)

Install system-wide to `/opt/subwaysurfers-sanfrancisco/` and `/opt/subwaysurfers-beijing/`:

```bash
# Install San Francisco
sudo dpkg -i "Debian installers/SubwaySurfers-SanFrancisco-Linux-amd64.deb" || sudo apt-get install -f -y

# Install Beijing
sudo dpkg -i "Debian installers/SubwaySurfers-Beijing-Linux-amd64.deb" || sudo apt-get install -f -y
```

Launch from terminal or desktop menu:

```bash
subwaysurfers-sanfrancisco
subwaysurfers-beijing
```

---

## 4. Option C — Standalone Bash Installers

Each folder under `Terminal-Bash-Installers/` is completely self-contained and works even if copied outside the repository.

### User-Space Installation (No `sudo` Required)

```bash
# San Francisco
cd Terminal-Bash-Installers/SanFrancisco
./install.sh --user

# Beijing
cd Terminal-Bash-Installers/Beijing
./install.sh --user
```

This installs:
- Executable AppImages & symlinks in `~/.local/bin/subwaysurfers-sanfrancisco` and `~/.local/bin/subwaysurfers-beijing`
- Desktop launchers in `~/.local/share/applications/`
- Original version-specific icons in `~/.local/share/icons/hicolor/512x512/apps/`

### System-Wide `.deb` Mode via Bash Installer

```bash
./Terminal-Bash-Installers/SanFrancisco/install.sh --deb
./Terminal-Bash-Installers/Beijing/install.sh --deb
```

---

## 5. Desktop Launcher & Controls

- **Application Menu:** Search for **Subway Surfers: San Francisco** or **Subway Surfers: Beijing**.
- **Fullscreen:** Both launch in fullscreen by default; press `F11` to toggle fullscreen/windowed mode (`window_state.json` persists your preference).
- **Escape Key:** Preserved for in-game menus (does not close the window).

---

## 6. Updating

Run the newer AppImage, `dpkg -i`, or `install.sh` directly. Your shared player saves in `~/.local/share/SubwaySurfers-Linux/Save/` are preserved automatically.

---

## 7. Uninstalling

Uninstalling one version never affects the other version and **never removes shared player saves** at `~/.local/share/SubwaySurfers-Linux/Save/`.

### Using Standalone Uninstallers

```bash
./Terminal-Bash-Installers/SanFrancisco/uninstall.sh
./Terminal-Bash-Installers/Beijing/uninstall.sh
```

### Using `dpkg` (System `.deb` Packages)

```bash
sudo dpkg -r subwaysurfers-sanfrancisco-linux
sudo dpkg -r subwaysurfers-beijing-linux
```

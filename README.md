# SubwaySurfers-Linux 1.0

**SubwaySurfers-Linux 1.0** is an unofficial Linux desktop wrapper and shared-save project for three *Subway Surfers* (`1.94.0`) WebGL builds: **San Francisco**, **Beijing**, and **Zurich**.

I put this project together so all three cities can run locally on Linux without browser clutter, intrusive ads, or separate profile folders that lose your progress when switching cities.

> **Disclaimer:** This is an independent, personal/educational Linux integration project. It is **not** affiliated with, endorsed by, or approved by **SYBO Games ApS** or **Kiloo Games**. *Subway Surfers* and all original game assets belong to their respective owners. See [DISCLAIMER.md](DISCLAIMER.md) before using or packaging local game files.

---

## Included Versions

| Version | App ID | Underlying Game Build | Unity Version | Command |
|---|---|---|---|---|
| **San Francisco** | `SubwaySurfers-SanFrancisco-Linux` | World Tour: San Francisco (`1.94.0`) | `2019.4.18f1` | `subwaysurfers-sanfrancisco` |
| **Beijing** | `SubwaySurfers-Beijing-Linux` | World Tour: Beijing (`Beijing_2`, `1.94.0`) | `2019.2.0f1` | `subwaysurfers-beijing` |
| **Zurich** | `SubwaySurfers-Zurich-Linux` | World Tour: Zurich (`ZurichNewPrivacy`, `1.94.0`) | `2019.4.18f1` | `subwaysurfers-zurich` |

*Note:* `1.0` (`1.0.0` in package metadata) is the version of this Linux integration release. The underlying game builds remain `1.94.0`.

---

## Controls

Movement in all three versions uses **WASD** instead of the arrow keys. Physical arrow keys are disabled for movement so all three builds behave the same way.

| Action | Key |
|---|---|
| Move left | `A` |
| Move right | `D` |
| Jump / move up | `W` |
| Roll / move down | `S` |
| Start run / activate hoverboard | `Space` |
| Pause / menu back | `Escape` |
| Toggle fullscreen | `F11` |

Mouse clicks/drags, touch input, and standard gamepads still work as provided by the game. Releasing focus or switching windows (`Alt+Tab`) automatically releases any held movement key so your runner never gets stuck moving sideways.

---

## Linux Requirements

- 64-bit Linux (`x86_64` / `amd64`)
- OpenGL / WebGL 2.0 capable GPU (tested on Intel UHD integrated graphics and NVIDIA RTX 3050 Mobile via PRIME offload)
- Standard desktop libraries: `libc6 (>= 2.31)`, `libnss3`, `libgtk-3-0`, `libgbm1`, `libasound2`, `libatk1.0-0`, `libatk-bridge2.0-0`, `libcups2`, `libdrm2` (plus `libfuse2` if running AppImages directly with FUSE)

On Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y libnss3 libgtk-3-0 libgbm1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libfuse2
```

*(On Ubuntu 24.04+, the `t64` library equivalents satisfy these dependencies.)*

---

## Installation

### Option 1: AppImage

Verify checksums first if you want to double-check your local files:

```bash
sha256sum -c SHA256SUMS
```

Make the AppImage executable and run it:

```bash
chmod +x "App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage"
"./App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage"

chmod +x "App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage"
"./App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage"

chmod +x "App images/SubwaySurfers-Zurich-Linux-x86_64.AppImage"
"./App images/SubwaySurfers-Zurich-Linux-x86_64.AppImage"
```

Pass `--windowed` if you don't want fullscreen on launch (`F11` also toggles fullscreen at any time).

### Option 2: Debian Package (`.deb`)

Install any or all three `.deb` packages system-wide:

```bash
sudo dpkg -i "Debian installers/SubwaySurfers-SanFrancisco-Linux-amd64.deb" || sudo apt-get install -f -y
sudo dpkg -i "Debian installers/SubwaySurfers-Beijing-Linux-amd64.deb" || sudo apt-get install -f -y
sudo dpkg -i "Debian installers/SubwaySurfers-Zurich-Linux-amd64.deb" || sudo apt-get install -f -y
```

Then launch from your application menu or run `subwaysurfers-sanfrancisco`, `subwaysurfers-beijing`, or `subwaysurfers-zurich`.

*(Standalone Bash installer bundles are also kept in `Terminal-Bash-Installers/` if you prefer user-space `~/.local/bin` installs without `sudo`.)*

---

## Shared Save Storage, AutoSave & Crash Recovery

- **Where saves live:** All three versions read and write directly to the exact same files in:
  ```text
  ~/.local/share/SubwaySurfers-Linux/Save/
  ```
  Specifically: `cloud`, `cloud_old`, `local`, `local_old`, `PlayerPrefs`, `recovery/`, and `.storage.lock`.
- **How shared saves work:** Instead of letting Electron store saves per-origin inside Chromium's IndexedDB folders, a shared bridge (`Source/Shared/host_idbfs_bridge.js` and `Source/Shared/shared_storage.js`) maps Emscripten's `IDBFS` calls directly to `~/.local/share/SubwaySurfers-Linux/Save/`. Your coins, keys, high score, characters, boards, and upgrades carry over seamlessly between San Francisco, Beijing, and Zurich.
- **How automatic saving works:** `Source/Shared/autosave_manager.js` watches Emscripten `FS.close` and `FS.rename` calls on save files, verifies the 28-byte Kiloo SHA-1 header, coalesces rapid writes, and flushes cleanly when you finish a run, switch focus, or close the window — with zero extra save buttons or popups.
- **What happens if the game crashes:** Every primary save update writes through a temporary file (`fsync` + atomic POSIX `rename`) after copying the previous valid save into `Save/recovery/`. If a primary save gets truncated or corrupted during a crash, startup automatically restores the newest valid backup (`*_old` or `Save/recovery/*.recovery`) and cleans up any stale `.storage.lock` left by a dead process.
- **Why you cannot run two versions at once:** Because all three versions write directly to the same physical files, `Source/Shared/storage_lock.js` holds an exclusive `.storage.lock` while one version is running. Trying to launch a second version while another is open exits cleanly with an error notice (`exit code 2`) instead of corrupting your save.

---

## Backing Up & Uninstalling

**Back up your progress** (while no game is running):

```bash
tar -czf "$HOME/subwaysurfers-save-backup-$(date +%Y%m%d).tar.gz" -C "$HOME/.local/share/SubwaySurfers-Linux" Save
```

**Uninstall without losing saves:**

```bash
# If installed via .deb
sudo dpkg -r subwaysurfers-sanfrancisco-linux
sudo dpkg -r subwaysurfers-beijing-linux
sudo dpkg -r subwaysurfers-zurich-linux

# If installed via Terminal-Bash-Installers
./Terminal-Bash-Installers/SanFrancisco/uninstall.sh
./Terminal-Bash-Installers/Beijing/uninstall.sh
./Terminal-Bash-Installers/Zurich/uninstall.sh
```

Neither `dpkg -r` nor `uninstall.sh` touches `~/.local/share/SubwaySurfers-Linux/Save/`.

---

## Limitations & Project Relationship

- **Distribution limits:** Proprietary game bundles (`.unityweb` files, logos, and compiled packages) are **not** included in Git and are not published for public download because redistribution rights from SYBO Games ApS / Kiloo Games are not cleared. See [DISCLAIMER.md](DISCLAIMER.md) and [Documentation/SECURITY.md](Documentation/SECURITY.md).
- **Single active instance:** Only one city can run at a time to keep the shared save files safe.
- **Offline mode:** All external network requests and promotional ad wrappers (including Beijing's free-item video-ad popups and Zurich's `igroutka.ru` portal scripts) are disabled locally. Features that depend on live online servers (like Facebook login or video ads) are intentionally inactive.
- **Relationship to the original game:** This repository provides only the Linux Electron shell, WASD control remapping, shared storage/recovery layer, build/test scripts, and documentation. *Subway Surfers* itself and all game assets remain the property of SYBO Games ApS and Kiloo Games. Upstream San Francisco AppImage credit: Drizzle (`https://www.appimagehub.com/p/2299024`).

---

## More Documentation

See [Documentation/README.md](Documentation/README.md) for architecture details, save compatibility notes, build instructions, security details, troubleshooting, and test results.

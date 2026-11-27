# SubwaySurfers-Linux

Unified Linux desktop integration and shared persistence project consolidating **Subway Surfers: San Francisco**, **Subway Surfers: Beijing**, and **Subway Surfers: Zurich** into one maintainable repository with a single shared player save location.

---

## Available Versions

| Application ID | Game Build | Unity Engine | Command |
|---|---|---|---|
| `SubwaySurfers-SanFrancisco-Linux` | World Tour: San Francisco (`1.94.0`) | `2019.4.18f1` | `subwaysurfers-sanfrancisco` |
| `SubwaySurfers-Beijing-Linux` | World Tour: Beijing (`Beijing_2`, `1.94.0`) | `2019.2.0f1` | `subwaysurfers-beijing` |
| `SubwaySurfers-Zurich-Linux` | World Tour: Zurich (`ZurichNewPrivacy`, `1.94.0`) | `2019.4.18f1` | `subwaysurfers-zurich` |

All three versions launch independently, coexist cleanly on the same Linux system, preserve their own original logos and gameplay assets, run ad-free offline, and read/write the **exact same physical save files**.

---

## Key Features

- **Unified Shared Save Storage:** San Francisco, Beijing, and Zurich all read from and atomically write to `~/.local/share/SubwaySurfers-Linux/Save/` (`cloud`, `cloud_old`, `local`, `local_old`, `PlayerPrefs`, `recovery/`). Progress made in any city is immediately available when launching the others.
- **Exclusive Storage Locking:** Prevents simultaneous game instances (any pair among San Francisco, Beijing, and Zurich) from corrupting shared files, with automatic stale-lock recovery after crashes.
- **Invisible Integrated AutoSave:** Event-driven Emscripten `FS.close` and `FS.rename` hooks flush changes cleanly on run completion, purchases, focus loss, and graceful shutdown (`force-save-before-exit`) with zero extra UI clutter.
- **Ad-Free Offline Runtime:** Beijing free-item advertising popups (`[▶ -> ?]` video-ad prompt and post-run `Free Double Up!` ad banner) and Zurich `igroutka.ru` portal overlays/scripts are removed cleanly via offline `PokiUnitySDK` `adblock` signaling while keeping all legitimate gameplay, missions, Word Hunt rewards, Shop boosts, and character unlocks intact.
- **Atomic Writes & Crash Recovery:** All BSON save files are validated against their 28-byte Kiloo SHA-1 header before commit, written via temp file + `fsync` + POSIX `rename`, and backed up to `Save/recovery/` for automatic recovery if a primary save is damaged.
- **Safe First-Launch Migration:** Detects legacy `~/.config/SubwaySurfersSanfrancisco`, `~/.config/SubwaySurfersBeijing2`, and `~/.config/SubwaySurfersZurich` IndexedDB profiles, creates SHA-256-verified backups before touching anything, and halts safely if conflicting progress is detected across multiple profiles.
- **Minimal Fullscreen Experience:** Starts directly into the game in fullscreen (`F11` toggles fullscreen, `Escape` preserved, `--windowed` supported), with no developer toolbars, debug badges, or extra buttons.
- **Hardened Electron Security:** Runs with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, strict CSP, localhost `127.0.0.1` HTTP serving, path traversal protection, and outbound network request blocking.

---

## Installation Choices

Three distribution formats are built for each version (**9 release artifacts total**):

1. **AppImage (`App images/`):** Portable single-file executables (`SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage`, `SubwaySurfers-Beijing-Linux-x86_64.AppImage`, `SubwaySurfers-Zurich-Linux-x86_64.AppImage`).
2. **Debian Packages (`Debian installers/`):** Native system packages (`SubwaySurfers-SanFrancisco-Linux-amd64.deb`, `SubwaySurfers-Beijing-Linux-amd64.deb`, `SubwaySurfers-Zurich-Linux-amd64.deb`).
3. **Standalone Bash Installers (`Terminal-Bash-Installers/`):** Self-contained `install.sh` / `uninstall.sh` bundles for `SanFrancisco/`, `Beijing/`, and `Zurich/` with all required files in `required-files/`.

See [Documentation/INSTALLATION.md](Documentation/INSTALLATION.md) for copy-paste installation, building, testing, checksum verification, and removal commands.

---

## System Requirements

- **OS / Arch:** 64-bit Linux (`x86_64` / `amd64`)
- **Graphics:** OpenGL / WebGL 2.0 capable GPU (tested across all three versions on Intel UHD `ADL GT2` Mesa OpenGL 4.6 and NVIDIA GeForce RTX 3050 Laptop GPU PRIME offload `595.112.07`)
- **System Libraries:** `libc6 (>= 2.31)`, `libnss3`, `libgtk-3-0`, `libgbm1`, `libasound2`, `libatk1.0-0`, `libatk-bridge2.0-0`, `libcups2`, `libdrm2`

---

## Project Directory Structure

```text
SubwaySurfers-Linux/
├── App images/                 # Final .AppImage binaries (local build output)
├── Debian installers/          # Final .deb packages (local build output)
├── Terminal-Bash-Installers/   # Self-contained install.sh / uninstall.sh bundles (3 versions)
├── Documentation/              # Common, SanFrancisco, Beijing, and Zurich documentation
├── Source/
│   ├── Shared/                 # Shared Electron shell, IPC storage, locking, autosave, migration
│   ├── SanFrancisco/           # San Francisco Electron entry, desktop/deb metadata, web runtime
│   ├── Beijing/                # Beijing Electron entry, clean-room offline runtime, desktop/deb metadata
│   └── Zurich/                 # Zurich Electron entry, clean-room offline runtime, desktop/deb metadata
├── Scripts/                    # Build, checksum, test, and cleanup automation scripts
├── Tests/                      # Automated shared-storage, migration, autosave, packaging & 6-transition E2E suites
├── SHA256SUMS                  # SHA-256 verification manifest for all 24 distributable/installer entries
└── LICENSE                     # MIT license for Linux integration code + proprietary asset notice
```

---

## Building & Testing Locally

```bash
# Rebuild all 9 release artifacts and regenerate SHA256SUMS
./Scripts/build-all.sh

# Run full automated test suite (storage, migration, autosave, packaging, 6-transition live E2E, checksums)
./Scripts/test-all.sh

# Verify checksums standalone
./Scripts/verify-checksums.sh
```

---

## Current Release Status & Legal Notice

- **Build & Test Status:** All 9 release artifacts are built, verified with `sha256sum -c SHA256SUMS` (`24/24 OK`), and pass all automated shared-storage, migration, autosave, packaging, ad-removal, and live 6-transition cross-version switching tests.
- **Legal / Redistribution Limitations:** Proprietary Subway Surfers assets (`.unityweb` bundles, game artwork, and logos) are the intellectual property of **SYBO Games ApS / Kiloo Games** and are excluded from public Git tracking via `.gitignore`. See [Documentation/SECURITY-AND-LEGAL.md](Documentation/SECURITY-AND-LEGAL.md) for full provenance, upstream credits (`https://www.appimagehub.com/p/2299024`), and redistribution boundaries.

# Subway Surfers Linux (World Tour: San Francisco 1.94.0)
### High-Performance Desktop Linux Port with Verified Automatic Save Persistence

[![Linux](https://img.shields.io/badge/Platform-Linux%20x86__64-blue.svg)](#)
[![Tests](https://img.shields.io/badge/Tests-42%2F42%20PASSING-brightgreen.svg)](#)
[![Package](https://img.shields.io/badge/Formats-AppImage%20%7C%20Debian-orange.svg)](#)
[![Status](https://img.shields.io/badge/Status-Verified%20Stable-success.svg)](#)

An unofficial, standalone desktop Linux distribution of **Subway Surfers (World Tour: San Francisco 1.94.0)** featuring a high-performance **event-driven automatic save system**, native desktop integration, and full offline support.

---

## Highlights & Features

- **Reliable Automatic Save System:** Saves player progress seamlessly across runs, upgrades, and character unlocks with zero progress loss.
- **Atomic Rename Interception:** Hooks into Unity IL2CPP `FileUtil.Save` atomic write cycles (`cloud_new` / `local_new` -> target).
- **IDBFS Timestamp Correction:** Eliminates Emscripten timestamp stagnation, guaranteeing that virtual MEMFS changes reliably sync to Chromium IndexedDB.
- **Graceful Shutdown Interceptor:** Intercepts window closure, forcing an immediate flush of pending saves before Electron terminates.
- **BSON & SHA-1 Integrity:** Preserves the authentic 28-byte header and 160-bit SHA-1 checksum format required by Kiloo/SYBO engines.
- **Universal Linux Compatibility:** Packaged as both a portable **AppImage** and native **Debian package (`.deb`)**.
- **Verified Stability:** 100% pass rate across 42 automated tests, including live end-to-end two-session restart persistence tests.

---

## Quick Start

### Option 1: Standalone AppImage (Recommended)

No root permissions or package managers required. Simply install for your current user:

```bash
# Automated desktop integration (installs to ~/.local/bin and creates menu shortcuts)
./installer/install.sh --user

# Run the game
subwaysurfers
```

Or run the AppImage file directly:
```bash
chmod +x app/SubwaySurfers-AutoSave-Fixed-x86_64.AppImage
./app/SubwaySurfers-AutoSave-Fixed-x86_64.AppImage
```

### Option 2: System-Wide Debian Package (.deb)

For Ubuntu, Debian, Linux Mint, Pop!_OS, and derivatives:

```bash
sudo ./installer/install.sh --deb
```

---

## Consolidated Project Structure

```
Subway-Surfers-Linux/
├── README.md                          # Main documentation & quickstart
├── CREDITS.md                         # Drizzle & SYBO attributions
├── CHANGELOG.md                       # Full version history & repair logs
├── LICENSE_AND_ATTRIBUTION.md         # Legal notices & open-source licenses
├── .gitignore                         # Repository clean specifications
├── app/
│   ├── SubwaySurfers-AutoSave-Fixed-x86_64.AppImage   # Portable Linux AppImage
│   └── SubwaySurfers-AutoSave-Fixed-amd64.deb         # Native Debian/Ubuntu package
├── installer/
│   ├── install.sh                     # Universal user/deb installer
│   ├── uninstall.sh                   # Clean uninstaller
│   ├── INSTALLATION.md                # Comprehensive installation manual
│   └── UNINSTALLATION.md              # Uninstallation instructions
├── source/
│   ├── autosave_manager.js            # Core persistence state machine
│   ├── main.js                        # Electron main process & IPC lifecycle
│   ├── preload.js                     # Secure renderer IPC context bridge
│   ├── 4399.js                        # Emscripten virtual FS & safeMkdir patches
│   ├── index.html                     # WebGL host page & script orchestration
│   ├── subwaysurfers.desktop          # XDG desktop shortcut specification
│   ├── subwaysurfers.png              # 512x512 high-resolution icon
│   ├── build_scripts/
│   │   ├── build_appimage.sh          # Reproducible AppImage build script
│   │   └── build_deb.sh               # Reproducible Debian build script
│   └── modified_game_files/
│       └── CHANGES_OVERVIEW.md        # Technical diff summary of engine patches
├── tests/
│   ├── run_all_tests.py               # Master automated test suite runner
│   ├── test_header_and_sha1.js        # TC-01: Header & SHA-1 cryptographic validation
│   ├── test_autosave_manager.js       # TC-02: AutoSaveManager state machine tests
│   ├── test_bson_and_gameplay.py      # TC-03: BSON model & gameplay simulation tests
│   ├── test_ipc_lifecycle.js          # TC-04: Electron shutdown lifecycle tests
│   ├── test_profile_persistence.py    # TC-05: Profile isolation & backup validation
│   ├── test_live_save_persistence.js  # TC-06: Live end-to-end restart persistence test
│   ├── fixtures/                      # Test fixtures & reference saves
│   └── test_logs/
│       └── automated_tests.log        # Test execution logs
├── documentation/
│   ├── ROOT_CAUSE_REPORT.md           # Deep-dive save failure investigation
│   ├── TESTING_REPORT.md              # 42/42 test suite report
│   ├── SAVE_PERSISTENCE_TEST_REPORT.md# Live two-session persistence report
│   ├── FULL_BUG_AUDIT.md              # Complete bug audit & fixes
│   ├── KNOWN_ISSUES.md                # Edge-case behaviors & platform notes
│   ├── SAVE_SYSTEM_REVERSE_ENGINEERING.md # Storage architecture documentation
│   └── analysis/                      # Historical reverse engineering logs
├── diagnostics/
│   ├── APPIMAGE_LAUNCH_FAILURE.md     # AppImage launch failure trace & root cause
│   ├── APPIMAGE_LAUNCH_FIX.md         # Fix implementation & validation report
│   └── runtime_logs/                  # Raw execution traces
├── backups/
│   ├── SubwaySurfers-x86-64.AppImage.orig # Byte-identical original AppImage backup
│   ├── original_profile_backup.tar.gz     # Initial player save backup archive
│   └── BACKUP_MANIFEST.txt               # Backup verification checksums
└── release/
    ├── SubwaySurfers-AutoSave-Fixed-Linux.zip # Complete release distribution bundle
    ├── SHA256SUMS                     # Cryptographic checksums
    └── RELEASE_NOTES.md               # User-facing release notes
```

---

## Building from Source

To build the AppImage and Debian packages locally using the self-contained build scripts:

### Prerequisites
- Linux x86_64
- `squashfs-tools` (`mksquashfs`, `unsquashfs`)
- `dpkg-deb` (for Debian package)
- The base upstream AppImage (`SubwaySurfers-x86-64.AppImage`)

### Build AppImage:
```bash
./source/build_scripts/build_appimage.sh [path/to/base/SubwaySurfers-x86-64.AppImage]
```
The script will unpack the base AppImage, apply the Linux AutoSave patches, compile SquashFS with `gzip` compression and 128K block size, and assemble `app/SubwaySurfers-AutoSave-Fixed-x86_64.AppImage`.

### Build Debian Package:
```bash
./source/build_scripts/build_deb.sh [path/to/base/SubwaySurfers-x86-64.AppImage]
```
Packages the patched application hierarchy into `app/SubwaySurfers-AutoSave-Fixed-amd64.deb`.

---

## Known Issues & Platform Notes

- **AppArmor User Namespace Restriction:** Certain modern Linux distributions (such as Ubuntu 24.04+) enforce restrictions on unprivileged user namespaces. The bundled `AppRun` launcher automatically detects this via `/proc/sys/kernel/apparmor_restrict_unprivileged_userns` and applies `--no-sandbox` to ensure seamless execution.
- **Audio Lag during Cold Boot:** On slower storage media, audio buffers may take 1-2 seconds to prime upon initial engine initialization.
- **Wayland Support:** Runs via XWayland by default. For native Wayland, pass `--enable-features=UseOzonePlatform --ozone-platform=wayland`.

---

## Verification & Automated Test Suite

The project includes an exhaustive automated test suite covering unit, integration, and live dynamic restart verification.

To run the full test suite:
```bash
cd tests
python3 run_all_tests.py
```

### Test Coverage Summary:
| Suite | Module | Tests | Description | Result |
| :--- | :--- | :---: | :--- | :---: |
| **TC-01** | `test_header_and_sha1.js` | 10 | Header & SHA-1 Cryptographic Integrity | **PASS** |
| **TC-02** | `test_autosave_manager.js` | 5 | State Machine, Debounce & Queue Drain | **PASS** |
| **TC-03** | `test_bson_and_gameplay.py` | 14 | BSON Model, Purchases & Corruption Detection | **PASS** |
| **TC-04** | `test_ipc_lifecycle.js` | 3 | Window Close Intercept & Watchdog Failsafe | **PASS** |
| **TC-05** | `test_profile_persistence.py` | 9 | Profile Isolation & Backup Integrity | **PASS** |
| **TC-06** | `test_live_save_persistence.js` | 1 | Live End-to-End Two-Session Restart Test | **PASS** |
| **TOTAL**| **42 Tests across 6 Suites** | **42** | **100% Success Rate** | **PASS** |

---

## Credits & Acknowledgements

- **Original Linux AppImage Package:** Created and uploaded by **Drizzle** on AppImageHub ([https://www.appimagehub.com/p/2299024](https://www.appimagehub.com/p/2299024)).
- **Game Intellectual Property:** Subway Surfers is the intellectual property of **SYBO Games** and Kiloo.
- **Unofficial Modification:** This repository documents community Linux compatibility fixes and an open-source persistence subsystem. It is not affiliated with or endorsed by SYBO Games.

---

## License

See [LICENSE_AND_ATTRIBUTION.md](file:///home/prabhudev/Subway%20Surfer/Subway-Surfers-Linux/LICENSE_AND_ATTRIBUTION.md) for full licensing, third-party component notices, and disclaimers.

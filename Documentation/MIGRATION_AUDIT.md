# Migration Audit Report — `SubwaySurfers-Linux`

**Audit Date:** 2026-11-27  
**Target Repository:** `/home/prabhudev/Subway Surfer/SubwaySurfers-Linux/`  
**Status:** Phase One Audit & Backup Verified

---

## 1. Original Project Locations & Baselines

| Component | Path | Git Commit / Version | Notes |
|---|---|---|---|
| San Francisco Project | `/home/prabhudev/Subway Surfer/Subway-Surfers-Linux/` | `42266c7` (`main`) | Electron + Unity 2019.4.18f1 (`productVersion: 1.94.0`), AutoSave + fullscreen startup |
| Upstream SF AppImage | `/home/prabhudev/Subway Surfer/SubwaySurfers-x86-64.AppImage` | Original (Drizzle / AppImageHub) | Size: `140,473,536` bytes, SHA-256: `84a81c0c76abd5e58d31f94e1e9b1a5f823bf482f73db6e2fe63d5a27d37fc35` (Never modified) |
| SF AutoSave AppImage | `/home/prabhudev/Subway Surfer/Subway-Surfers-Linux/app/SubwaySurfers-AutoSave-Fixed-x86_64.AppImage` | `v1.94.0-autosave3-final` | SHA-256: `d8ab497fa77595028e25015d4b2af72f7eafa7202971e442f65e25fefd84c31c` |
| SF Fullscreen AppImage | `/home/prabhudev/Subway Surfer/Subway-Surfers-Linux/dist_fullscreen/SubwaySurfers-SanFrancisco-Fullscreen-x86_64.AppImage` | Fullscreen release | Size: `140,481,728` bytes, SHA-256: `f49afa8fa46deffff32ef6b2278ead2d9eca255ee34e3e8464531f7e99216664` |
| Beijing Project | `/home/prabhudev/Subway Surfer/SubwaySurfers-Beijing-Linux/` | `3a98ad2` (`main`) | Electron 36.5.0 + Unity 2019.2.0f1 (`Beijing_2`, `productVersion: 1.94.0`), embedded `127.0.0.1` HTTP server |
| Beijing AppImage | `/home/prabhudev/Subway Surfer/SubwaySurfers-Beijing-Linux/dist/SubwaySurfers-Beijing-Linux-x86_64.AppImage` | `0.2.0-standalone` | Size: `153,015,488` bytes, SHA-256: `44301f0230b0aa586dc6d4390c23b23b4747ce3d6aeec64608d6d7a3360e2cf6` |
| Beijing Debian Package | `/home/prabhudev/Subway Surfer/SubwaySurfers-Beijing-Linux/dist/SubwaySurfers-Beijing-Linux-amd64.deb` | `0.2.0-standalone` | SHA-256: `82b7c264b0264ee5ff2759bb6e22283baf01ac4679dc83e25a0fa4f5e323f7c9` |
| Beijing Bash Installer | `/home/prabhudev/Subway Surfer/SubwaySurfers-Linux/Terminal-Bash-Installers/Beijing/` | `1.94.0-unified1` | Self-contained installer bundle |
| Zurich Source Capture | `/home/prabhudev/Subway Surfer/Zurich/files/m.igroutka.ru/ni3/171/SubwaySurfers/` | `ZurichNewPrivacy` (`1.94.0`) | Unity `2019.4.18f1`, `TOTAL_MEMORY: 369098752`, `ZurichNewPrivacy.data.unityweb` SHA-256 `abf564553f7b07a29425c035ce8069248809c5efdcc4e76a147412fa87a5ee9a` |

---

## 2. Verified Backup Locations & Integrity

1. **Pre-existing Migration Backup (14:43):** `/home/prabhudev/Subway Surfer/backups_unified_migration_20261127_1444/`
   - Verified with `sha256sum -c --quiet SHA256SUMS.backup` -> `ALL_OK`.
   - Note: Live saves in `~/.config/SubwaySurfersSanfrancisco` (17:50) and `~/.config/SubwaySurfersBeijing2` (17:55) were updated after 14:43.
2. **Phase One Audit Backup (18:03):** `/home/prabhudev/Subway Surfer/backups_audit_20261127/` (`715` files, `sha256sum -c --quiet SHA256SUMS.backup` -> `BACKUP_VERIFIED_OK`).
3. **Zurich Integration Phase 0 Backup (22:00):** `/home/prabhudev/Subway Surfer/backups_zurich_phase0_20261127_220012/` (`320` files, `sha256sum -c --quiet SHA256SUMS.backup` -> `OK`). Contains full pre-Zurich `SubwaySurfers-Linux/`, full `Zurich/` source tree, `~/.local/share/SubwaySurfers-Linux/` shared saves & migration backups, and Git status/history snapshot.

---

## 3. Original Logo Inventory

| Version | Original File Path | Format & Dimensions | Size (bytes) | SHA-256 |
|---|---|---|---|---|
| San Francisco | `Subway-Surfers-Linux/source/subwaysurfers.png` (and `.DirIcon` / `resources/app/icon.png` in upstream AppImage) | PNG, `512 x 512`, 8-bit/color RGBA | `378,940` | `95ea7b903bf206b293c1f2fcfcbcfc40d3e6391c78fbbec4672c360b5fb694c3` |
| San Francisco (Favicon) | `SubwaySurfers-x86-64.AppImage!/html/favicon.ico` | JPEG, `16 x 16` | `852` | (preserved in upstream bundle) |
| Beijing | `SubwaySurfers-Beijing-Linux/web/4399.png` (from `Beijing-Website-Download/ni3/125/SubwaySurfers/4399.png`) | PNG, `2048 x 2048`, 16-bit/color RGB | `11,665,811` | `0129053cb9fd66cc8f5d9a0f5d9686115ee6dacd8c89f94384359f1b521ba890` |
| Zurich (Original) | `Zurich/files/m.igroutka.ru/ni3/171/SubwaySurfers/b3f5e1472e1bfbee1804c7e854546a08.png` | WebP, `40 x 40`, RGB | `1,054` | `2ce9ec76c8503a9fbdb459d457ec1f140c97a443eae99f0cb12bc9ac0c15759a` |
| Zurich (Desktop/X11 PNG) | `Source/Zurich/assets/subwaysurfers-zurich.png` (decoded from original WebP) | PNG, `256 x 256`, 8-bit/color RGBA | `91,301` | `145baf5e11c4d42c8c9f920679db4d9ee7c0de92a202882c7d94008b77c1ce23` |

**Audit Finding (Logo Defect Fixed in Unified Build):**
- `SubwaySurfers-Beijing-Linux` previously packaged `appimage/icon-placeholder.png` (`256 x 256`, SHA-256 `5398fe31404d91a2445609758842e21d7fe1124422fcecc8b37a338792a21248`) as its AppImage `.DirIcon` and `.deb` icon instead of the original `web/4399.png`.
- In `SubwaySurfers-Linux`, Beijing uses the original `4399.png` (and for `.deb` hicolor icon compatibility, a standard 512x512 PNG derived strictly from `4399.png` or `pixmaps` alongside the unmodified original `4399.png` in Electron/AppDir). San Francisco uses the original `subwaysurfers.png`.

---

## 4. Save Paths, Formats & Compatibility Findings

### 4.1 Legacy Save Locations Discovered
- **San Francisco:** `~/.config/SubwaySurfersSanfrancisco/IndexedDB/file__0.indexeddb.leveldb/`
  - Database `/idbfs` (v21), store `FILE_DATA`, keys under `/idbfs/9ca1650cb5772c831cf4ccc5f0517c30/` (`MD5("file:///tmp/SubwaySurfers")`) and mirrored `/idbfs/09de0e244ad54a7e2c94ae0e99c4d3db/` (`MD5("file:///opt/subwaysurfers/html")`).
  - Files: `PlayerPrefs` (229 bytes), `Save/cloud` (11,906 bytes), `Save/cloud_old` (11,906 bytes), `Save/local` (1,021 bytes), `Save/local_old` (1,021 bytes).
- **Beijing:** `~/.config/SubwaySurfersBeijing2/IndexedDB/http_127.0.0.1_47321.indexeddb.leveldb/`
  - Database `/idbfs` (v21), store `FILE_DATA`, keys under `/idbfs/141951c78e0371bca42ee67e7a9757dc/` (`MD5("http://127.0.0.1:47321")`).
  - Files: `PlayerPrefs` (391 bytes), `Save/cloud` (11,048 bytes), `Save/cloud_old` (11,502 bytes), `Save/local` (1,021 bytes), `Save/local_old` (1,021 bytes), plus `Unity/local.8c8c04fd365107d42a5e0e2f229913c2/Analytics/config` (0 bytes).

### 4.2 Binary Format & Schema Comparison (Empirical Results)
Decoded via `persistence/bson_adapter.py` on isolated copies of both live profiles:
- **`Save/cloud`:** Both use Kiloo `BsonFileSaver` 28-byte SHA-1 integrity header (`[4B hash_len=20][20B SHA-1][4B payload_len]`) + standard BSON.
  - SF `Save/cloud` SHA-1: `a417dff6efc8f2ba0f4f85fc9b726d04c09aea17`, **142 top-level keys**.
  - Beijing `Save/cloud` SHA-1: `0db7ee4449ed869bd7c58c57b6896a0d5060be4b`, **142 top-level keys**.
  - Keys unique to SF: `[]` (0). Keys unique to Beijing: `[]` (0). BSON type mismatches: `[]` (0).
- **`Save/local`:** Both have **30 top-level keys**, 0 unique keys, 0 type mismatches.
- **`PlayerPrefs`:** Both use Unity binary `UnityPrf` container (`b"UnityPrf\x00\x00\x01\x00\x00\x00\x10\x00..."`).

### 4.3 Live Cross-Engine Compatibility Verification (3 Versions)
- Booting **Beijing** (`Unity 2019.2.0f1`) with San Francisco's exact save files succeeded with zero errors.
- Booting **San Francisco** (`Unity 2019.4.18f1`) with Beijing's exact save files succeeded with zero errors.
- Booting **Zurich** (`ZurichNewPrivacy`, `Unity 2019.4.18f1`, `1.94.0`) against the live shared save succeeded with zero errors: `Save/cloud` (`142` top-level keys, `0` missing/extra keys, `0` type mismatches), `Save/local` (`30` top-level keys, `0` missing/extra keys, `0` type mismatches), and `PlayerPrefs` (`UnityPrf`, `353` bytes) all matched San Francisco and Beijing identically. All six directed cross-version transitions passed live E2E verification.

### 4.4 Player Data Conflict & Migration Decision
Both legacy profiles contain active progress:
- **San Francisco:** `completedRunCount=43`, `highScore=3,172,149`, `obfuscatedCoins=2,423`, `obfuscatedKeys=64`, `unlockedCharacters=['slick', 'tricky', 'fresh']`, `upgrades={4,3,4,4}`.
- **Beijing:** `completedRunCount=2`, `highScore=24,140`, `obfuscatedCoins=1,000`, `obfuscatedKeys=5`, `unlockedCharacters=['slick']`, `upgrades={0,0,0,0}`.

Per strict non-overwrite rules, automatic migration **stops and reports a conflict** if both legacy saves exist without explicit user resolution. For this host system, the user explicitly selected: **Migrate San Francisco progress into `~/.local/share/SubwaySurfers-Linux/Save/` while preserving verified backups of both original profiles.**

---

## 5. Architectural & Packaging Decisions

1. **Canonical Shared Save Storage (`~/.local/share/SubwaySurfers-Linux/Save/`):**
   - Replace per-app Chromium IndexedDB `/idbfs` persistence with a shared host-filesystem IDBFS bridge (`Source/Shared/host_idbfs_bridge.js` + `Source/Shared/shared_storage.js` + `Source/Shared/storage_lock.js`) over scoped IPC.
   - Both San Francisco and Beijing read/write the exact same physical files (`cloud`, `cloud_old`, `local`, `local_old`, `PlayerPrefs`, `recovery/`), protected by atomic temp-write + `fsync` + `rename` and an exclusive `.storage.lock` process lock.
2. **Standardized Naming & Coexistence:**
   - San Francisco: `SubwaySurfers-SanFrancisco-Linux` (binary `subwaysurfers-sanfrancisco`, `.desktop` `subwaysurfers-sanfrancisco.desktop`, `StartupWMClass=SubwaySurfers-SanFrancisco-Linux`).
   - Beijing: `SubwaySurfers-Beijing-Linux` (binary `subwaysurfers-beijing`, `.desktop` `subwaysurfers-beijing.desktop`, `StartupWMClass=SubwaySurfers-Beijing-Linux`).
   - Eliminates old `SanFranciso` typo and removes `SubwaySurfersSanfrancisco` / `SubwaySurfersBeijing` / `SubwaySurfersBeijing2` as active save destinations.
3. **Minimal UI & Hardened Shared Shell:**
   - Both games run inside the hardened `Source/Shared/electron_shell.js` (`127.0.0.1` local HTTP server, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`, strict CSP, outbound URL blocking, path traversal protection, fullscreen startup, `F11` toggle, `Escape` preserved).
   - Zero extra toolbars, diagnostics drawers, debug badges, or save UI.
4. **Build Dependencies Verified on Host:**
   - `python3`, `dpkg-deb`, `mksquashfs`, `unsquashfs`, `sha256sum`, Electron `36.5.0` runtime (`ELECTRON_RUN_AS_NODE=1` for Node execution), X11 `DISPLAY=:0.0`, `glxinfo`, `nvidia-smi`.

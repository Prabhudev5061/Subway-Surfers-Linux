# Cleanup Manifest Report — `SubwaySurfers-Linux`

**Cleanup Updated & Re-Verified:** 2026-11-27  
**Script:** `Scripts/clean-old-files.sh`

---

## 1. Pre-Cleanup Verification Checks (All Passed)
1. Verified `backups_audit_20261127/SHA256SUMS.backup` (`715` files) via `sha256sum -c --quiet`.
2. Verified `SubwaySurfers-Linux/SHA256SUMS` (`24` entries across San Francisco, Beijing, and Zurich) via `sha256sum -c --quiet`.
3. Verified upstream `SubwaySurfers-x86-64.AppImage` (`140,473,536` bytes, SHA-256 `84a81c0c76abd5e58d31f94e1e9b1a5f823bf482f73db6e2fe63d5a27d37fc35`) intact.
4. Verified original Zurich source files (`ZurichNewPrivacy.data.unityweb` SHA-256 `abf564553f7b07a29425c035ce8069248809c5efdcc4e76a147412fa87a5ee9a`, original logo `b3f5e1472e1bfbee1804c7e854546a08.png` SHA-256 `2ce9ec76c8503a9fbdb459d457ec1f140c97a443eae99f0cb12bc9ac0c15759a`) intact.
5. Verified canonical shared saves at `~/.local/share/SubwaySurfers-Linux/Save/` (`cloud`, `PlayerPrefs`, `recovery/`).

---

## 2. Removed Redundant Paths (Phase 1 Consolidation)

| Removed Path | Size | Reason & Preservation |
|---|---|---|
| `/home/prabhudev/Subway Surfer/Subway-Surfers-Linux` | `835 MB` | Superseded by `SubwaySurfers-Linux/Source/SanFrancisco/` & `Source/Shared/`; full backup preserved in `backups_audit_20261127/Subway-Surfers-Linux`. |
| `/home/prabhudev/Subway Surfer/SubwaySurfers-Beijing-Linux` | `619 MB` | Superseded by `SubwaySurfers-Linux/Source/Beijing/` & `Source/Shared/`; full backup preserved in `backups_audit_20261127/SubwaySurfers-Beijing-Linux`. |
| `/home/prabhudev/Subway Surfer/analysis` | `335 MB` | Obsolete extracted AppImage scratch; `Scripts/build-common.sh` extracts cleanly from `SubwaySurfers-x86-64.AppImage`. |
| `/home/prabhudev/Subway Surfer/Beijing-Website-Download` | `67 MB` | Obsolete raw site mirror; verified `Beijing_2.*` assets & `4399.png` preserved in `SubwaySurfers-Linux/Source/Beijing/` and `backups_audit_20261127/`. |
| `/home/prabhudev/Subway Surfer/investigation_igroutka_beijing2` | `96 KB` | Obsolete investigation scratch directory. |
| `/home/prabhudev/Subway Surfer/siteone-temp` | `8 KB` | Obsolete crawler temporary cache. |
| `/home/prabhudev/Subway Surfer/SubwaySurfers-beijing` | `996 KB` | Obsolete early download mirror. |
| `/home/prabhudev/Subway Surfer/CLEANUP_PLAN.md` | `8 KB` | Superseded by `SubwaySurfers-Linux/Documentation/CLEANUP_REPORT.md`. |
| `/home/prabhudev/Subway Surfer/backups_launch_repair_20261124` | `445 MB` | Superseded by verified `backups_audit_20261127/`. |

During Zurich integration, `Source/Beijing/web/loaders/v3/` (unused Poki v3 wrapper scripts `master-loader.js` and `unity.js`) was also removed from the Beijing runtime staging directory. No original source trees, verified backups, or user saves were deleted.

---

## 3. Preserved Paths
- `/home/prabhudev/Subway Surfer/SubwaySurfers-Linux/` (unified 3-version repository & all 9 release artifacts)
- `/home/prabhudev/Subway Surfer/SubwaySurfers-x86-64.AppImage` (unmodified upstream San Francisco AppImage)
- `/home/prabhudev/Subway Surfer/Zurich/` (original Zurich source capture & provenance)
- `/home/prabhudev/Subway Surfer/backups_audit_20261127/` (verified Phase One backup)
- `/home/prabhudev/Subway Surfer/backups_unified_migration_20261127_1444/` (earlier migration backup)
- `/home/prabhudev/Subway Surfer/backups_zurich_phase0_20261127_220012/` (Phase 0 Zurich integration backup, `320` files)
- `~/.local/share/SubwaySurfers-Linux/Save/` and `~/.local/share/SubwaySurfers-Linux/migration/backups/`
- `~/.config/SubwaySurfersSanfrancisco` and `~/.config/SubwaySurfersBeijing2` (original user save profiles preserved read-only)

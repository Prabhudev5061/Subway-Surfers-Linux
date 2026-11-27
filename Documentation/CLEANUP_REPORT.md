# Cleanup Manifest Report — `SubwaySurfers-Linux`

**Cleanup Executed:** 2026-11-27  
**Script:** `Scripts/clean-old-files.sh`

---

## 1. Pre-Cleanup Verification Checks (All Passed)
1. Verified `backups_audit_20261127/SHA256SUMS.backup` (`715` files) via `sha256sum -c --quiet`.
2. Verified `SubwaySurfers-Linux/SHA256SUMS` (`16` entries) via `sha256sum -c --quiet`.
3. Verified upstream `SubwaySurfers-x86-64.AppImage` (`140,473,536` bytes, SHA-256 `84a81c0c76abd5e58d31f94e1e9b1a5f823bf482f73db6e2fe63d5a27d37fc35`) intact.
4. Verified canonical shared saves at `~/.local/share/SubwaySurfers-Linux/Save/` (`cloud`, `PlayerPrefs`, `recovery/`).

---

## 2. Removed Redundant Paths

| Removed Path | Size | Reason & Preservation |
|---|---|---|
| `/home/prabhudev/Subway Surfer/Subway-Surfers-Linux` | `835 MB` | Superseded by `SubwaySurfers-Linux/Source/SanFrancisco/` & `Source/Shared/`; full backup preserved in `backups_audit_20261127/Subway-Surfers-Linux`. |
| `/home/prabhudev/Subway Surfer/SubwaySurfers-Beijing-Linux` | `619 MB` | Superseded by `SubwaySurfers-Linux/Source/Beijing/` & `Source/Shared/`; full backup preserved in `backups_audit_20261127/SubwaySurfers-Beijing-Linux`. |
| `/home/prabhudev/Subway Surfer/analysis` | `335 MB` | Obsolete extracted AppImage scratch; `Scripts/build-common.sh` now extracts cleanly from `SubwaySurfers-x86-64.AppImage`. |
| `/home/prabhudev/Subway Surfer/Beijing-Website-Download` | `67 MB` | Obsolete raw site mirror; verified `Beijing_2.*` assets & `4399.png` preserved in `SubwaySurfers-Linux/Source/Beijing/` and `backups_audit_20261127/`. |
| `/home/prabhudev/Subway Surfer/investigation_igroutka_beijing2` | `96 KB` | Obsolete investigation scratch directory. |
| `/home/prabhudev/Subway Surfer/siteone-temp` | `8 KB` | Obsolete crawler temporary cache. |
| `/home/prabhudev/Subway Surfer/SubwaySurfers-beijing` | `996 KB` | Obsolete early download mirror. |
| `/home/prabhudev/Subway Surfer/CLEANUP_PLAN.md` | `8 KB` | Superseded by `SubwaySurfers-Linux/Documentation/CLEANUP_REPORT.md`. |
| `/home/prabhudev/Subway Surfer/backups_launch_repair_20261124` | `445 MB` | Superseded by verified `backups_audit_20261127/`. |

---

## 3. Preserved Paths
- `/home/prabhudev/Subway Surfer/SubwaySurfers-Linux/` (unified repository & all 6 release packages)
- `/home/prabhudev/Subway Surfer/SubwaySurfers-x86-64.AppImage` (unmodified upstream AppImage)
- `/home/prabhudev/Subway Surfer/backups_audit_20261127/` (verified Phase One backup)
- `/home/prabhudev/Subway Surfer/backups_unified_migration_20261127_1444/` (earlier migration backup)
- `~/.local/share/SubwaySurfers-Linux/Save/` and `~/.local/share/SubwaySurfers-Linux/migration/backups/`
- `~/.config/SubwaySurfersSanfrancisco` and `~/.config/SubwaySurfersBeijing2` (original user save profiles preserved read-only)

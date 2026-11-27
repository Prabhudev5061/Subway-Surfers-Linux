# SubwaySurfers-Linux Documentation Index

## Common Documentation
- [INSTALLATION.md](INSTALLATION.md) — AppImage, `.deb`, and standalone Bash installer instructions for all three versions, dependency installation, updating, and removal.
- [SHARED-STORAGE.md](SHARED-STORAGE.md) — Canonical `~/.local/share/SubwaySurfers-Linux/Save/` architecture, 3-version BSON compatibility, `HostIDBFS` bridge, migration policy, locking, atomic writes, and manual backup/restore.
- [AUTOSAVE-AND-RECOVERY.md](AUTOSAVE-AND-RECOVERY.md) — Emscripten `FS.close`/`FS.rename` hooks, queue draining, shutdown flush, and crash recovery.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Lock conflicts, migration conflict resolution, GPU/PRIME offload, AppArmor sandbox, and diagnostics.
- [SECURITY-AND-LEGAL.md](SECURITY-AND-LEGAL.md) — Security sandbox, CSP, outbound blocking, proprietary asset provenance, and redistribution boundaries.
- [MIGRATION_AUDIT.md](MIGRATION_AUDIT.md) — Audit of original projects, backups, logos, and 3-version save compatibility.
- [CLEANUP_REPORT.md](CLEANUP_REPORT.md) — Cleanup verification and preserved source/backup manifest.
- [FINAL_IMPLEMENTATION_REPORT.md](FINAL_IMPLEMENTATION_REPORT.md) — Complete 3-version implementation, artifact checksums, and test summary.

## Version-Specific Documentation
- **San Francisco:** [README](SanFrancisco/README.md) | [Architecture](SanFrancisco/ARCHITECTURE.md) | [Build](SanFrancisco/BUILD.md) | [Test Results](SanFrancisco/TEST-RESULTS.md) | [Release Notes](SanFrancisco/RELEASE-NOTES.md)
- **Beijing:** [README](Beijing/README.md) | [Architecture](Beijing/ARCHITECTURE.md) | [Build](Beijing/BUILD.md) | [Test Results](Beijing/TEST-RESULTS.md) | [Release Notes](Beijing/RELEASE-NOTES.md)
- **Zurich:** [README](Zurich/README.md) | [Architecture](Zurich/ARCHITECTURE.md) | [Build](Zurich/BUILD.md) | [Test Results](Zurich/TEST-RESULTS.md) | [Release Notes](Zurich/RELEASE-NOTES.md)

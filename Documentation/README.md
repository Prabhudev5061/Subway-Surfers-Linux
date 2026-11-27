# SubwaySurfers-Linux 1.0 Documentation Index

## Common Documentation
- [DISCLAIMER.md](../DISCLAIMER.md) — Non-affiliation, intellectual property boundaries, provenance, and distribution restrictions.
- [ARCHITECTURE.md](ARCHITECTURE.md) — Unified Electron shell, shared WASD controls layer, and shared persistence architecture.
- [BUILD_AND_INSTALL.md](BUILD_AND_INSTALL.md) — Building v1.0 packages locally, running tests, and verifying checksums.
- [INSTALLATION.md](INSTALLATION.md) — AppImage, `.deb`, and standalone Bash installer instructions, dependencies, updating, and removal.
- [SHARED-STORAGE.md](SHARED-STORAGE.md) — Canonical `~/.local/share/SubwaySurfers-Linux/Save/` architecture, `HostIDBFS` bridge, migration policy, locking, atomic writes, and manual backup/restore.
- [SAVE_COMPATIBILITY.md](SAVE_COMPATIBILITY.md) — Empirical 3-version BSON schema audit and 6-transition compatibility verification.
- [AUTOSAVE-AND-RECOVERY.md](AUTOSAVE-AND-RECOVERY.md) — Emscripten `FS.close`/`FS.rename` hooks, queue draining, shutdown flush, and crash recovery.
- [SECURITY.md](SECURITY.md) & [SECURITY-AND-LEGAL.md](SECURITY-AND-LEGAL.md) — Security sandbox, CSP, outbound blocking, provenance, and redistribution boundaries.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Lock conflicts, migration conflict resolution, GPU/PRIME offload, AppArmor sandbox, and diagnostics.
- [TEST_RESULTS.md](TEST_RESULTS.md) — Complete v1.0 automated, live WASD gameplay, and Intel/NVIDIA GPU test results.
- [RELEASE_NOTES.md](RELEASE_NOTES.md) — SubwaySurfers-Linux 1.0 release notes.
- [MIGRATION_AUDIT.md](MIGRATION_AUDIT.md) | [CLEANUP_REPORT.md](CLEANUP_REPORT.md) | [FINAL_IMPLEMENTATION_REPORT.md](FINAL_IMPLEMENTATION_REPORT.md)

## Version-Specific Documentation
- **San Francisco:** [README](SanFrancisco/README.md) | [Architecture](SanFrancisco/ARCHITECTURE.md) | [Build](SanFrancisco/BUILD.md) | [Test Results](SanFrancisco/TEST-RESULTS.md) | [Release Notes](SanFrancisco/RELEASE-NOTES.md)
- **Beijing:** [README](Beijing/README.md) | [Architecture](Beijing/ARCHITECTURE.md) | [Build](Beijing/BUILD.md) | [Test Results](Beijing/TEST-RESULTS.md) | [Release Notes](Beijing/RELEASE-NOTES.md)
- **Zurich:** [README](Zurich/README.md) | [Architecture](Zurich/ARCHITECTURE.md) | [Build](Zurich/BUILD.md) | [Test Results](Zurich/TEST-RESULTS.md) | [Release Notes](Zurich/RELEASE-NOTES.md)

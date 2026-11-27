# Release Notes — `SubwaySurfers-Linux 1.0`

**Release Date:** 2026-11-28  
**Linux Collection Version:** `1.0` (`1.0.0` in package metadata)  
**Underlying Subway Surfers Builds:** `1.94.0` (San Francisco, Beijing, Zurich)

---

## Highlights in v1.0
- **Unified WASD Controls (`Source/Shared/controls_wasd.js`):** Standardized directional movement across San Francisco, Beijing, and Zurich to `W` (Jump), `A` (Left), `S` (Roll), and `D` (Right). Disabled physical arrow keys as primary movement controls, added focus-loss/blur keyup cleanup so held keys never stick, and preserved `Space`, `Escape`, `F11`, mouse, touch, gamepad, text input, and Electron shortcuts.
- **Three-Version Collection:** Includes San Francisco (`2019.4.18f1`), Beijing (`2019.2.0f1`), and Zurich (`2019.4.18f1`), all sharing `~/.local/share/SubwaySurfers-Linux/Save/` directly with exclusive locking, atomic writes, and crash recovery.
- **Ad-Free Offline Runtime:** Beijing free-item video-ad prompts (`[▶ -> ?]` and `Free Double Up!`) and Zurich `igroutka.ru` portal overlays/scripts remain removed.
- **Six Primary v1.0 Release Packages Built:** Three `.AppImage` executables (`App images/`) and three `.deb` packages (`Debian installers/`), plus maintained standalone Bash installers (`Terminal-Bash-Installers/`), all verified with `sha256sum -c SHA256SUMS`.
- **Honest Documentation & Disclaimer:** Added [`DISCLAIMER.md`](../DISCLAIMER.md) and updated user documentation explaining exact provenance, non-affiliation with SYBO/Kiloo, and local-only distribution boundaries for proprietary assets.

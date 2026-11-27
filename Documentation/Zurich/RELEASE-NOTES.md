# Release Notes — `SubwaySurfers-Zurich-Linux` (`SubwaySurfers-Linux 1.0`, Game `1.94.0`)

- Updated movement controls to **WASD** (`W` jump, `A` left, `S` roll, `D` right) via `Source/Shared/controls_wasd.js`, disabling physical arrow keys as primary movement while preserving `Space`, `Escape`, `F11`, mouse, touch, gamepad, text input, and Electron shortcuts.
- Packaged as part of **SubwaySurfers-Linux 1.0** (`1.0.0` package metadata; underlying game build remains `ZurichNewPrivacy` `1.94.0`).
- Integrated World Tour: Zurich (`ZurichNewPrivacy`, `1.94.0`, Unity `2019.4.18f1`) as the third edition of `SubwaySurfers-Linux`.
- Configured direct shared persistence to `~/.local/share/SubwaySurfers-Linux/Save/` via `Source/Shared/host_idbfs_bridge.js`, `autosave_manager.js`, `shared_storage.js`, and `storage_lock.js`.
- Verified empirical BSON schema compatibility with San Francisco and Beijing (`142` identical top-level keys in `Save/cloud`, `30` in `Save/local`, `0` type mismatches).
- Excluded all `igroutka.ru` portal overlays/scripts (`#more_g`, `#game_lock`, `script.js`, `logo-mini.png`) and replaced Poki ad scripts with clean-room offline `poki-sdk-cleanroom.js` (`adblock` mode).
- Preserved original Zurich logo (`b3f5e1472e1bfbee1804c7e854546a08.png`) and generated `256x256` RGBA PNG (`subwaysurfers-zurich.png`) for Linux desktop/X11 integration.
- Built portable AppImage, `.deb` package, and self-contained Bash installer bundle.

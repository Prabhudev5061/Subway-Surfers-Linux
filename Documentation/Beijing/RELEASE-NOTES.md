# Release Notes — `SubwaySurfers-Beijing-Linux` (`SubwaySurfers-Linux 1.0`, Game `1.94.0`)

- Updated movement controls to **WASD** (`W` jump, `A` left, `S` roll, `D` right) via `Source/Shared/controls_wasd.js`, disabling physical arrow keys as primary movement while preserving `Space`, `Escape`, `F11`, mouse, touch, gamepad, text input, and Electron shortcuts.
- Packaged as part of **SubwaySurfers-Linux 1.0** (`1.0.0` package metadata; underlying game build remains `Beijing_2` `1.94.0`).
- Consolidated into unified `SubwaySurfers-Linux` repository alongside San Francisco and Zurich.
- Replaced per-app IndexedDB storage (`~/.config/SubwaySurfersBeijing2`) with unified shared host storage (`~/.local/share/SubwaySurfers-Linux/Save/`).
- Replaced placeholder icon (`icon-placeholder.png`) with the original supplied Beijing logo (`4399.png`), with in-memory `256x256` X11 window icon resizing to eliminate the X11 `16,777,248`-byte request overflow.
- Updated `runtime_bootstrap.js` so `#loading-overlay` remains visible until `Module.postRun` completes, preventing a blank `#231F20` window frame during WASM initialization.
- Removed unwanted Beijing free-item advertising popups/banners (`[▶ -> ?]` menu button, post-run `Free Double Up!` banner, `commercialBreak()` triggers) by updating `Source/Beijing/web/runtime/poki-sdk-cleanroom.js` to offline `adblock` mode (`SendMessage(gameObjectName, 'adblock')`, `pokiAdBlock = true`) and removing unused `loaders/v3/` Poki wrapper files.
- Built portable AppImage, `.deb` package, and self-contained Bash installer bundle.

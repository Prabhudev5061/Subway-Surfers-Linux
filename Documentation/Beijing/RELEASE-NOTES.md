# Release Notes — `SubwaySurfers-Beijing-Linux` (`1.94.0-unified1`)

- Consolidated into unified `SubwaySurfers-Linux` repository alongside San Francisco.
- Replaced per-app IndexedDB storage (`~/.config/SubwaySurfersBeijing2`) with unified shared host storage (`~/.local/share/SubwaySurfers-Linux/Save/`).
- Replaced placeholder icon (`icon-placeholder.png`) with the original supplied Beijing logo (`4399.png`), with in-memory `256x256` X11 window icon resizing to eliminate the X11 `16,777,248`-byte request overflow.
- Updated `runtime_bootstrap.js` so `#loading-overlay` remains visible until `Module.postRun` completes, preventing a blank `#231F20` window frame during WASM initialization.
- Built portable AppImage, `.deb` package, and self-contained Bash installer bundle.

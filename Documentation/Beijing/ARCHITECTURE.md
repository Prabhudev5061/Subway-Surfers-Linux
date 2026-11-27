# Beijing Architecture, Resource Inventory & Shared Integration

## 1. Verified Local Resource Inventory & SHA-256 Validation
| File | Size (bytes) | SHA-256 | Classification |
|---|---|---|---|
| `Build/Beijing_2.json` | `591` | `89a2ea3ca211136f4a3f758c8f9a4d5de97d434ef61eaf92822eee6395394404` | Manifest (`unityVersion: 2019.2.0f1`, `productVersion: 1.94.0`) |
| `Build/Beijing_2.data.unityweb` | `29,477,323` | `6668b37e6331d11b888ebb66ea5ffda606afa26ace6391c99d923ed1e517bc9f` | Proprietary Unity asset bundle (excluded from Git) |
| `Build/Beijing_2.wasm.code.unityweb` | `26,477,341` | `4c53dbc95a29413f6452a58f0c0438f7a4bbf0310fe6473adeb7508e176b48a8` | Proprietary Unity IL2CPP WASM (excluded from Git) |
| `Build/Beijing_2.wasm.framework.unityweb` | `540,326` | `0b7f5575e033f09c715cef64645bbae186ad90de84da8547b7342ce9c63283bc` | Proprietary Unity WASM framework (excluded from Git) |
| `loaders/v2/unity/static/UnityLoader.2019.2.js` | `237,674` | `59a837fcb8e9609a0ebb5b0effc35ed965b1765694f32a29cd517381162812a2` | Unity WebGL loader (excluded from Git) |
| `Source/Beijing/assets/4399.png` | `11,665,811` | `0129053cb9fd66cc8f5d9a0f5d9686115ee6dacd8c89f94384359f1b521ba890` | Original Beijing logo (`2048x2048` PNG, excluded from Git) |

## 2. Clean-Room Offline Runtime & Fixes
- **`poki-sdk-cleanroom.js`:** Implements the local `PokiSDK` and `initPokiBridge` contract offline in ad-disabled (`adblock`) mode (`window.pokiAdBlock = true`, `window.pokiReady = false`, `SendMessage(gameObjectName, 'adblock')`) without any Poki proprietary code, remote ad scripts, trackers, or Prebid code. Sending `'adblock'` disables Unity's promotional free-item video-ad overlays (main-menu `[▶ -> ?]` Free Stuff button, post-run `Free Double Up!` banner, and `commercialBreak()` triggers) while preserving all legitimate gameplay, character unlocks, missions, Word Hunt daily rewards, Shop boosts, and save persistence. Any `displayAd` container is hidden/detached. Unused `loaders/v3/` Poki slideshow/wrapper scripts were removed.
- **`unity_2019_2_compat.js`:** Probes WebGL 2.0 / 1.0 + WASM, handles user-gesture WebAudio unlock, ensures MEMFS `/http:/127.0.0.1:<port>` directories exist for Kiloo `FileUtil`, and computes aspect-ratio-safe viewport dimensions (`9/16` to `16/9`).
- **`runtime_bootstrap.js`:** Keeps `#loading-overlay` visible until `Module.postRun` completes (+250ms) and falls back to `window.innerWidth`/`innerHeight` when computing viewport size, preventing a blank `#231F20` frame before Unity renders.
- **X11 Window Icon Sizing (`electron_shell.js`):** Resizes the original `2048x2048` `4399.png` in memory to `256x256` via `nativeImage` for the X11 `_NET_WM_ICON` property, avoiding X11's `16,777,248`-byte `Cannot send request` overflow while keeping the unmodified original `4399.png` on disk.

## 3. Shared Storage, AutoSave & Controls
- `Source/Beijing/web/4399.js` routes `IDBFS.syncfs` through `window.HostIDBFS` (`Source/Shared/host_idbfs_bridge.js`) to `~/.local/share/SubwaySurfers-Linux/Save/`, and passes Unity key events through `Source/Shared/controls_wasd.js` (`W/A/S/D` movement, physical arrows suppressed, focus-loss keyup cleanup).
- Uses unified `Source/Shared/autosave_manager.js`, `Source/Shared/shared_storage.js`, and `Source/Shared/storage_lock.js` for atomic writes, recovery backups, and exclusive locking.

## 4. Known Limitations
- Proprietary `Beijing_2.*.unityweb` bundles and `4399.png` are excluded from public Git tracking pending rights-holder authorization from SYBO Games ApS / Kiloo Games.

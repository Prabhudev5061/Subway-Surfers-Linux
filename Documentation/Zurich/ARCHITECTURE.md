# Zurich Architecture, Resource Inventory & Shared Integration

## 1. Verified Local Resource Inventory & SHA-256 Validation
Source discovered at `/home/prabhudev/Subway Surfer/Zurich/files/m.igroutka.ru/ni3/171/SubwaySurfers/`:

| File | Size (bytes) | SHA-256 | Runtime Required | Proprietary / Git Status |
|---|---|---|---|---|
| `Build/ZurichNewPrivacy.json` | `697` | `ceeadd3e892927d69f74fdb47a86603e4654206a4667bfbbfcda60913631b32e` | Yes | Proprietary build manifest (excluded from Git) |
| `Build/ZurichNewPrivacy.data.unityweb` | `28,988,830` | `abf564553f7b07a29425c035ce8069248809c5efdcc4e76a147412fa87a5ee9a` | Yes | Proprietary Unity asset bundle (excluded from Git) |
| `Build/ZurichNewPrivacy.wasm.code.unityweb` | `25,767,131` | `70d5f54f8247af69a34a3438664505ab5c1394de3daa7e236bff88d91eb8c466` | Yes | Proprietary Unity IL2CPP WASM (excluded from Git) |
| `Build/ZurichNewPrivacy.wasm.framework.unityweb` | `521,663` | `08fbd78769cae238592651e5651d1b9a8cad32de9f4e66157523270f3e7b95ae` | Yes | Proprietary Unity WASM framework (excluded from Git) |
| `UnityLoader.2019.2.js` | `237,684` | `94cbf74b31062a2b9508a1fcc3a58f0634b4f830eac65f825bf45e1f29c7d3a3` | Yes | Unity WebGL loader (excluded from Git) |
| `4399.js` (original) | `878,585` | `58dadacbf1266404f12e7007953aad4a536e61847368a2264534c0789ecdfef0` | Patched locally | Proprietary Emscripten glue (patched with `HostIDBFS` + `AutoSaveManager`, excluded from Git) |
| `b3f5e1472e1bfbee1804c7e854546a08.png` | `1,054` | `2ce9ec76c8503a9fbdb459d457ec1f140c97a443eae99f0cb12bc9ac0c15759a` | Yes | Original Zurich logo (`40x40` WebP, excluded from Git) |
| `torus-bold-webfont.woff2` | `23,064` | `af95aaf09528c2abfc0203c1fd9a56f9d6090fa969abdb65b4d0b73b5c905dd5` | Optional | Font asset (excluded from Git) |
| `Source/Zurich/assets/subwaysurfers-zurich.png` | `91,301` | `145baf5e11c4d42c8c9f920679db4d9ee7c0de92a202882c7d94008b77c1ce23` | Packaging/X11 | `256x256` RGBA PNG decoded from original Zurich logo (excluded from Git) |

### Excluded Portal / Adware Files from `Zurich/` Source
- `files/m.igroutka.ru/files/img/logo-mini.png` (`8,438` B, `180x47` PNG) — Russian portal badge (`igroutka.ru`), excluded.
- `files/m.igroutka.ru/files/scripts/script.js` (`761` B) — Portal framing/click-jacking `#game_lock` script, excluded.
- `poki-sdk.js` / `poki-sdk-core.js` — Replaced with clean-room offline `runtime/poki-sdk-cleanroom.js` (`adblock` mode).

## 2. Unity Build Configuration (`Build/ZurichNewPrivacy.json`)
- **Unity Version:** `2019.4.18f1`
- **Product / Version:** `Subway Surfers` / `1.94.0` (`Kiloo Games`)
- **TOTAL_MEMORY:** `369,098,752` bytes (~352 MiB)
- **Graphics API:** `["WebGL 2.0", "WebGL 1.0"]`
- **Background:** `#231F20` (`Dark` splash style, `multithreading: false`, `developmentBuild: false`)

## 3. Clean-Room Runtime, Security & Blank-Screen Prevention
- **`Source/Zurich/web/index.html`:** Strict CSP (`default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; ...`), zero inline `<script>` tags, zero `igroutka.ru` wrapper elements.
- **`Source/Zurich/web/config.js`:** Separates `window.config` (`ZurichNewPrivacy.json`, `b3f5e1472e1bfbee1804c7e854546a08.png`, decompressed file sizes) from `index.html`.
- **`runtime/poki-sdk-cleanroom.js`:** Reports `adblock` (`pokiAdBlock = true`) so Unity disables promotional video-ad popups offline with zero outbound network errors.
- **`runtime/unity_2019_4_compat.js` & `runtime/runtime_bootstrap.js`:** Probes WebGL 2.0/1.0 and required assets, displays `#loading-overlay` immediately, computes aspect-ratio-safe viewport dimensions, hides `#loading-overlay` only after `Module.postRun` (+250ms), and unlocks WebAudio on first gesture.
- **`Source/Zurich/electron/main.js`:** Launches hardened `Source/Shared/electron_shell.js` on `127.0.0.1:47323` with `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.

## 4. Shared Storage, AutoSave & Crash Recovery
- `Source/Zurich/web/4399.js` routes `IDBFS.syncfs` through `window.HostIDBFS` (`Source/Shared/host_idbfs_bridge.js`) directly to `~/.local/share/SubwaySurfers-Linux/Save/`, pre-creates MEMFS `/http:/127.0.0.1:<port>` directories, and attaches `AutoSaveManager` `FS.close` / `FS.rename` hooks.

# FUTURE AI CONTEXT & TECHNICAL BRIEFING

> **CRITICAL BRIEFING FOR FUTURE AI ASSISTANTS & REVERSE ENGINEERS**
> 
> This document is a complete, self-contained technical briefing on the Subway Surfers Linux AppImage (`SubwaySurfers-x86-64.AppImage`).
> Read this document first before inspecting any other file. It synthesizes all findings, verified facts, structural layouts, and architectural blueprints so that future development, modding, packaging, or debugging conversations do not need to repeat the static reverse engineering phase.

---

## 1. Executive Summary & Core Identity

The file `SubwaySurfers-x86-64.AppImage` is **NOT** a native C/C++ or Mono Linux executable. It is a **multi-tiered hybrid desktop application**:
1. **Outer Shell**: An **AppImage Type 2** package containing an embedded **SquashFS 4.0** filesystem (gzip-compressed).
2. **Desktop Container**: An **Electron 36.5.0** desktop wrapper (running **Chromium 134.0.6998.35**, **Node.js 22.14.0**, and Google **V8 13.4**).
3. **Game Engine**: **Unity 2019.4.18f1** compiled using the **IL2CPP (v24 metadata)** pipeline to **WebAssembly (WASM MVP)**.
4. **Game Content**: The official **Subway Surfers World Tour: San Francisco** (version **1.94.0**) originally created by **Kiloo Games** and **SYBO Games** for web gaming portals (Poki / 4399), packaged locally with ad networks disabled and assets 100% bundled offline.

---

## 2. Cryptographic Signatures & Exact Locations

- **Workspace Path**: `/home/prabhudev/Subway Surfer`
- **Original AppImage Path**: `/home/prabhudev/Subway Surfer/SubwaySurfers-x86-64.AppImage`
- **Original File Size**: `140,473,536 bytes` (133.97 MB)
- **Original File Permissions**: `-rwxrwxr-x` (0775)
- **SHA-256 Hash**: `84a81c0c76abd5e58d31f94e1e9b1a5f823bf482f73db6e2fe63d5a27d37fc35`
- **Extracted Root Path**: `/home/prabhudev/Subway Surfer/analysis/extracted/squashfs-root/`
- **Extraction Mechanism Used**: Host-native `unsquashfs -dest analysis/extracted/squashfs-root -offset 189632 SubwaySurfers-x86-64.AppImage` (0 errors, 96 files created, total uncompressed size: 349,219,747 bytes / 333.04 MB).
- **Embedded SquashFS Offset**: `189632` bytes (`0x0002e4c0`).

---

## 3. Technology Stack & Programming Languages

- **Packaging**: AppImage Type 2 (ELF magic `7f 45 4c 46 02 01 01 00 41 49 02 00 00 00 00 00`).
- **Main Host Languages**:
  - C / C++ (Chromium / Electron native binaries, ANGLE, SwiftShader, Crashpad).
  - Bash (Startup launcher script `AppRun`).
  - JavaScript / Node.js (Electron window manager `main.js`, `preload.js`).
  - HTML5 / CSS (Web container `index.html`, `unity.js`).
- **Game Engine Languages**:
  - C# (Original Kiloo/SYBO Subway Surfers source code compiled via IL2CPP).
  - WebAssembly (Compiled bytecode in `SanFrancisco.wasm.code.unityweb`, 25.77 MB).
  - Emscripten JavaScript (Runtime glue code in `SanFrancisco.wasm.framework.unityweb`).
- **Graphics Stack**: WebGL 2.0 / WebGL 1.0 -> Chromium GPU Process (ANGLE EGL/GLESv2) -> Host OpenGL / Vulkan (Mesa / NVIDIA) with CPU fallback via bundled Google SwiftShader.
- **Audio Stack**: AAC audio streams inside ISO Base Media / MP4 containers -> Chromium WebAudio -> Host ALSA (`libasound.so.2`) -> PipeWire / PulseAudio.
- **Save / Persistence**: Emscripten IDBFS mapping `/idbfs` to Chromium IndexedDB (`~/.config/SubwaySurfersSanfrancisco/IndexedDB/`).

---

## 4. Complete Relevant Directory Structure

```
analysis/extracted/squashfs-root/
├── AppRun                               (682 B)   [CRITICAL] Launcher script checking AppArmor and creating symlink
├── SubwaySurfers                        (188.4 MB)[CRITICAL] Main native Electron 36 ELF x86_64 binary
├── chrome-sandbox                       (37.3 KB) Chromium SUID sandbox (0755, not setuid)
├── chrome_crashpad_handler              (1.48 MB) Crash reporter daemon
├── libffmpeg.so                         (2.65 MB) Bundled media decoder (AAC/MP4 playback)
├── libEGL.so                            (254 KB)  Bundled ANGLE EGL interface
├── libGLESv2.so                         (6.14 MB) Bundled ANGLE OpenGL ES implementation
├── libvk_swiftshader.so                 (4.58 MB) Bundled Vulkan CPU software rasterizer
├── libvulkan.so.1                       (2.17 MB) Bundled Vulkan ICD loader
├── vk_swiftshader_icd.json              (107 B)   SwiftShader ICD configuration
├── icudtl.dat                           (9.98 MB) Unicode internationalization tables
├── resources.pak                        (5.95 MB) Chromium browser UI resources
├── chrome_100_percent.pak               (144 KB)  Chromium 1x UI pak
├── chrome_200_percent.pak               (214 KB)  Chromium 2x HiDPI UI pak
├── snapshot_blob.bin                    (328 KB)  V8 engine startup heap snapshot
├── v8_context_snapshot.bin              (695 KB)  V8 context snapshot
├── version                              (6 B)     Contains "36.5.0"
├── .DirIcon                             (370 KB)  512x512 PNG application icon
├── locales/                             (44.3 MB) 56 Chromium locale pak files
├── resources/app/                       (468 KB)  Electron application source
│   ├── package.json                               App descriptor ("SubwaySurfersSanfrancisco", author: "Drizzle")
│   ├── main.js                                    Main process window manager (creates 1080x720 window)
│   ├── preload.js                                 Commented-out preload script
│   ├── icon.png                                   512x512 PNG icon (identical to .DirIcon)
│   └── pnpm-lock.yaml                             pnpm lockfile (shows electron 34/36, electron-builder 25)
└── html/                                (55.7 MB) [CRITICAL] Web container & Unity WebGL build
    ├── index.html                                 HTML container launching master-loader.js
    ├── 4399.js                                    Emscripten IDBFS mount script & fullscreen handler
    ├── poki-sdk.js                                Local Poki SDK shim
    ├── poki-sdk-core.js                           Poki SDK offline mock (resolves ad promises immediately)
    ├── prebid4.12.0.js                            0-byte empty file (ad bidding disabled)
    ├── master-loader.js                           WebGL loader dispatcher
    ├── unity.js                                   Loading progress UI
    ├── UnityLoader.2019.2.js                      Unity 2019 WebGL Loader script
    ├── script.js                                  Domain iframe check stub
    ├── favicon.ico                                Game icon
    ├── screenshots/                               Gameplay preview thumbnails
    └── Build/                                     [CRITICAL GAME ENGINE ASSETS]
        ├── SanFrancisco.json                      Build configuration (Unity 2019.4.18f1, memory: 352 MB)
        ├── SanFrancisco.data.unityweb   (26.7 MB) UnityWebData 1.0 composite package
        ├── SanFrancisco.wasm.code.unityweb (24.6 MB) WebAssembly binary containing compiled C# IL2CPP logic
        └── SanFrancisco.wasm.framework.unityweb (509 KB) Emscripten JS glue code
```

---

## 5. Inner Structure of `SanFrancisco.data.unityweb`

The file `html/Build/SanFrancisco.data.unityweb` is a contiguous `UnityWebData 1.0` binary container. Its header table maps 7 internal files:

| Internal File Path | Offset (Bytes) | Length (Bytes) | Format & Contents |
| :--- | :--- | :--- | :--- |
| `Resources/unity_default_resources` | `0x0000010e` (270) | 3,421,588 (3.26 MB) | Unity default assets, Arial font, standard shaders |
| `Managed/mono/4.0/machine.config` | `0x003436a2` (3,421,858) | 33,648 (32.8 KB) | Mono CLR XML configuration |
| `Il2CppData/Metadata/global-metadata.dat` | `0x0034ba12` (3,455,506) | 6,109,716 (5.83 MB) | **IL2CPP Metadata v24**: 11,045 string literals, 476 classes |
| `boot.config` | `0x0091f426` (9,565,222) | 62 B | `wait-for-native-debugger=0`, `vr-enabled=0`, `hdr=0` |
| `data.unity3d` | `0x0091f464` (9,565,284) | 15,634,579 (14.91 MB) | **UnityFS v7 archive (LZ4)**: scenes, 3D meshes, prefabs |
| `resources.resource` | `0x018084f7` (25,199,863) | 332,823 (325 KB) | **24 AAC audio streams** (sound effects, coin pickup, jumps) |
| `sharedassets1.resource` | `0x0185990e` (25,532,686) | 2,446,530 (2.33 MB) | **21 AAC audio streams** (theme song, ambient music, horns) |

---

## 6. Detailed Startup Sequence

```mermaid
flowchart TD
    A["SubwaySurfers-x86-64.AppImage executed"] --> B["AppImage Runtime mounts SquashFS (gzip) via FUSE"]
    B --> C["AppRun checks /proc/sys/kernel/apparmor_restrict_unprivileged_userns"]
    C -->|If restricted (1)| D["Set sandbox='--no-sandbox'"]
    C -->|If not restricted| E["sandbox=''"]
    D --> F["Create symlink: /tmp/SubwaySurfers -> $HERE/html"]
    E --> F
    F --> G["Execute $HERE/SubwaySurfers $sandbox $@"]
    G --> H["Linux ELF loader resolves $ORIGIN/libffmpeg.so & system glibc"]
    H --> I["Electron main process loads resources/app/main.js"]
    I --> J["Create BrowserWindow (1080x720, icon.png)"]
    J --> K["Load /tmp/SubwaySurfers/index.html"]
    K --> L["Execute 4399.js: mount IDBFS at /idbfs for persistent save data"]
    L --> M["master-loader.js loads poki-sdk.js (offline ad mock) & unity.js"]
    M --> N["UnityLoader.2019.2.js parses SanFrancisco.json"]
    N --> O["Unpack SanFrancisco.data.unityweb (UnityWebData 1.0) into VFS"]
    O --> P["Instantiate SanFrancisco.wasm.code.unityweb (WebAssembly module)"]
    P --> Q["IL2CPP runtime initialized with global-metadata.dat (v24)"]
    Q --> R["Chromium GPU process creates WebGL 2.0 context via ANGLE/SwiftShader"]
    R --> S["Unity unpacks data.unity3d (level0 scene) & starts Subway Surfers loop"]
```

---

## 7. Known Linux Compatibility Issues & Quirks

1. **GLIBC Requirement**: Requires **`GLIBC_2.25`** minimum. Any modern Linux distribution released after February 2017 is compatible.
2. **Ubuntu 24.04 LTS / AppArmor Compatibility**: Handled automatically in `AppRun`. Because unprivileged user namespaces are restricted in Ubuntu 24.04, `AppRun` detects this and passes `--no-sandbox`.
3. **The `/tmp/SubwaySurfers` Symlink Flaw**:
   - `AppRun` hardcodes `ln -s "$HERE/html" /tmp/SubwaySurfers`.
   - In a multi-user system, if one user creates `/tmp/SubwaySurfers`, another user cannot launch the game without permission errors.
   - If abruptly killed (`SIGKILL`), the symlink may remain stale.
   - **Fix**: Modify `main.js` to load `path.join(__dirname, '../../html/index.html')` and eliminate the symlink from `AppRun`.
4. **Missing `.desktop` File**: The SquashFS root lacks a `subwaysurfers.desktop` file. Standard desktop integration utilities (`appimaged`, `AppImageLauncher`) will not create system menu entries automatically.
5. **Display Server**: Works out-of-the-box on X11 and Wayland (via XWayland). Native Wayland can be enabled via:
   `./SubwaySurfers-x86-64.AppImage --enable-features=UseOzonePlatform --ozone-platform=wayland`
6. **FUSE Requirement**: If running on a minimal system without `libfuse2` / `/dev/fuse`, extract using `--appimage-extract` and execute `./squashfs-root/AppRun`.

---

## 8. Modding & Reverse Engineering Guide

### How to Modify Window Settings & UI
- Edit `squashfs-root/resources/app/main.js`:
  - Change resolution: `width: 1920, height: 1080`.
  - Enable fullscreen: `fullscreen: true`.
  - Open DevTools on launch: `win.webContents.openDevTools();`.

### How to Modify Audio Streams
- Audio is stored as **raw AAC streams** inside ISO Base Media / MP4 containers (`ftypmp42` / `isom`).
- Sound effects: in `SanFrancisco.data.unityweb` at offset `25,199,863` (`resources.resource`, 24 streams).
- Music & ambient: in `SanFrancisco.data.unityweb` at offset `25,532,686` (`sharedassets1.resource`, 21 streams).
- To replace: encode replacement audio using `ffmpeg -i input.wav -c:a aac -b:a 128k output.m4a`, ensure correct container headers, and splice into the resource container.

### How to Extract 3D Models and Textures
- Locate `data.unity3d` embedded at offset `9,565,284` (length: `15,634,579` bytes) inside `SanFrancisco.data.unityweb`.
- Use `AssetStudio` or `UnityPy` to extract characters (Jake, Tricky, Guard, Dog), hoverboards, track pieces, and UI sprites.

### How to Reverse Engineer & Modify Gameplay Logic
- Binary: `squashfs-root/html/Build/SanFrancisco.wasm.code.unityweb`.
- Metadata: `squashfs-root/html/Build/SanFrancisco.data.unityweb` -> `global-metadata.dat`.
- Tools:
  - Run `Il2CppDumper` on `SanFrancisco.wasm.code.unityweb` and `global-metadata.dat` to generate `dump.cs` with all class definitions, method offsets, and field layouts in `Assembly-CSharp.dll`.
  - Disassemble WASM using `wasm2wat` from WABT.
  - Decompile in Ghidra using the WebAssembly extension.

### How to Repack into a New AppImage
After editing files in `squashfs-root/`:
```bash
# Ensure subwaysurfers.desktop exists in squashfs-root/
appimagetool squashfs-root SubwaySurfers-Modified-x86_64.AppImage
```

---

## 9. Confirmed Facts vs. Unverified Assumptions

| Finding | Classification | Verification Method |
| :--- | :--- | :--- |
| Application is an Electron wrapper around Unity WebGL | **Confirmed Fact** | Extracted `package.json`, `main.js`, `SanFrancisco.json`, `version` |
| Unity Version is `2019.4.18f1` | **Confirmed Fact** | Found in `SanFrancisco.json`, `boot.config`, UnityFS header |
| Scripting backend is IL2CPP Metadata v24 | **Confirmed Fact** | Parsed magic `0xFAB11BAF`, version `24` in `global-metadata.dat` |
| WebAssembly binary contains 22.1 MB code section | **Confirmed Fact** | Parsed WASM section table in `SanFrancisco.wasm.code.unityweb` |
| Core assets load 100% offline | **Confirmed Fact** | Inspected `master-loader.js`, `SanFrancisco.data.unityweb` VFS table |
| Poki SDK and Prebid ads are disabled/mocked | **Confirmed Fact** | `prebid4.12.0.js` is 0 bytes; `poki-sdk-core.js` auto-resolves promises |
| Maximum GLIBC requirement is `GLIBC_2.25` | **Confirmed Fact** | Analyzed `.gnu.version_r` records using `readelf -V` |
| 14 original characters and multiple hoverboards exist | **Confirmed Fact** | Extracted string literals and class names from IL2CPP metadata |
| Outbound telemetry is completely dormant during play | **Hypothesis / Requires Dynamic Test** | Requires dynamic network packet capture under `mitmproxy` |

---

## 10. Paths to Detailed Supporting Reports

All detailed investigation reports and artifacts are stored in `analysis/reports/`:
- **Master Report**: `analysis/reports/MASTER_TECHNICAL_REPORT.md`
- **Directory Tree**: `analysis/reports/DIRECTORY_TREE.txt`
- **Dependencies CSV**: `analysis/reports/DEPENDENCIES.csv`
- **Asset Inventory CSV**: `analysis/reports/ASSET_INVENTORY.csv`
- **Executable Analysis**: `analysis/reports/EXECUTABLE_ANALYSIS.md`
- **Startup Flow & Mermaid**: `analysis/reports/STARTUP_FLOW.md`
- **Architecture & Mermaid**: `analysis/reports/ARCHITECTURE.md`
- **Linux Compatibility**: `analysis/reports/LINUX_COMPATIBILITY.md`
- **Security & Vulnerabilities**: `analysis/reports/SECURITY_ANALYSIS.md`
- **Modification Feasibility**: `analysis/reports/MODIFICATION_FEASIBILITY.md`
- **Evidence & Hash Index**: `analysis/reports/EVIDENCE_INDEX.md`
- **Raw Evidence Logs**: `analysis/evidence/`

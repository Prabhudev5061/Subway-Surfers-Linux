# Future Modification Feasibility Assessment

## 1. Executive Summary

This document evaluates the practical feasibility of modifying, customizing, extending, or maintaining the **Subway Surfers AppImage**. Potential modifications are categorized by technical complexity, tooling requirements, risk profile, and dependencies.

---

## 2. Categorization of Modification Opportunities

### Category A: Straightforward Modifications

These modifications can be performed directly using standard Linux text editors, basic command-line utilities, or standard packaging scripts without modifying binary executables or compiled assets.

#### A.1 Desktop Environment Integration & `.desktop` File
- **Description**: Add a standard XDG `.desktop` file to enable system menu discovery, application icon display in dock/dash, and MIME associations.
- **Relevant Files**: `squashfs-root/subwaysurfers.desktop` (to create), `squashfs-root/.DirIcon`.
- **Required Tools**: Standard text editor, `desktop-file-validate`, `appimagetool`.
- **Difficulty**: Very Low (Level 1/10).
- **Risks**: None.
- **Dependencies**: Valid PNG icon (available at `.DirIcon`).
- **Implementation Blueprint**:
  ```ini
  [Desktop Entry]
  Type=Application
  Name=Subway Surfers
  Comment=Subway Surfers San Francisco Desktop
  Exec=AppRun %U
  Icon=subwaysurfers
  Categories=Game;ArcadeGame;
  Terminal=false
  ```

#### A.2 Eliminating Insecure `/tmp/SubwaySurfers` Symlink
- **Description**: Refactor `AppRun` and `resources/app/main.js` so that Electron loads `html/index.html` via a relative path from the executable directory (`path.join(__dirname, '../../html/index.html')`), eliminating the `/tmp/SubwaySurfers` symlink entirely.
- **Relevant Files**: `squashfs-root/AppRun`, `squashfs-root/resources/app/main.js`.
- **Required Tools**: Standard text editor.
- **Difficulty**: Low (Level 2/10).
- **Risks**: Breaking asset loading if relative path calculation is incorrect.
- **Dependencies**: Node.js path module.

#### A.3 Window Configuration, Resolution & Fullscreen Options
- **Description**: Customize default window resolution, minimum window constraints, frameless mode, kiosk mode, or fullscreen launch.
- **Relevant Files**: `squashfs-root/resources/app/main.js`.
- **Required Tools**: Text editor.
- **Difficulty**: Low (Level 2/10).
- **Parameters to Adjust**:
  `BrowserWindow({ width: 1920, height: 1080, fullscreen: false, autoHideMenuBar: true })`.
- **Risks**: Low.

#### A.4 Native Wayland Support Flags
- **Description**: Enable native Wayland execution by adding Ozone platform flags to `AppRun` or `main.js`:
  `app.commandLine.appendSwitch('enable-features', 'UseOzonePlatform');`
  `app.commandLine.appendSwitch('ozone-platform', 'wayland');`
- **Relevant Files**: `squashfs-root/AppRun`, `squashfs-root/resources/app/main.js`.
- **Required Tools**: Text editor.
- **Difficulty**: Low (Level 2/10).
- **Risks**: Black screens or visual artifacts on certain proprietary NVIDIA Wayland setups.

---

### Category B: Requires Specialized Tools

These modifications involve inspecting, replacing, or repacking structured assets, audio streams, or WebGL engine configurations.

#### B.1 Replacing Audio Tracks and Sound Effects
- **Description**: Replace the background theme music or specific sound effects (coin sound, train horn, jump).
- **Relevant Files**:
  - `squashfs-root/html/Build/SanFrancisco.data.unityweb` (contains `sharedassets1.resource` and `resources.resource`).
- **Audio Format**: AAC streams in MP4/ISO container (`ftypmp42` / `isom`).
- **Required Tools**:
  - `ffmpeg` (for encoding new audio clips to AAC/M4A).
  - Custom Python script or hex editor (to splice replacement streams matching byte length, or rebuild the `UnityWebData 1.0` header table).
- **Difficulty**: Moderate (Level 5/10).
- **Risks**: Desynchronizing offsets in `SanFrancisco.data.unityweb` will cause audio engine failures or load hangs.
- **Dependencies**: Matching audio sampling rate (44.1 kHz / 48 kHz).

#### B.2 Modifying Web Container, UI, and Aspect Ratio
- **Description**: Adjust HTML canvas styling, background color, responsive scaling, or UI overlay.
- **Relevant Files**: `squashfs-root/html/index.html`, `squashfs-root/html/unity.js`, `squashfs-root/html/Build/SanFrancisco.json`.
- **Required Tools**: Standard web development tools (Chrome DevTools, text editor).
- **Difficulty**: Low to Moderate (Level 3/10).
- **Risks**: Canvas coordinate misalignment with mouse click input.

#### B.3 Extracting and Inspecting 3D Models and Textures
- **Description**: Extract character 3D models (Jake, Tricky), textures, hoverboard meshes, and track assets from `data.unity3d`.
- **Relevant Files**: Embedded `data.unity3d` (UnityFS archive v7).
- **Required Tools**: `AssetStudio` (GUI on Windows/Wine), `UnityPy` (Python library), or `UABE` (Unity Assets Bundle Extractor).
- **Difficulty**: Moderate (Level 5/10).
- **Risks**: None during extraction (read-only); re-injecting modified textures requires recalculating LZ4 block sizes in the UnityFS container.

---

### Category C: Requires Substantial Reverse Engineering

These modifications require deep binary analysis, WebAssembly decompilation, and IL2CPP metadata manipulation.

#### C.1 Gameplay Logic Modification (Physics, Speed, Coin Multipliers)
- **Description**: Modify character speed, jump height, gravity, coin multiplier, collision invincibility, or endless run parameters.
- **Relevant Files**:
  - `squashfs-root/html/Build/SanFrancisco.wasm.code.unityweb` (25.77 MB WASM binary).
  - `squashfs-root/html/Build/SanFrancisco.data.unityweb` -> `Il2CppData/Metadata/global-metadata.dat`.
- **Required Tools**:
  - `wabt` (`wasm2wat`, `wat2wasm`).
  - `Ghidra` (with WebAssembly loader and IL2CPP symbol mapping via `Il2CppDumper`).
  - Binary hex editor.
- **Difficulty**: High (Level 8/10).
- **Risks**: Corrupting WASM function bodies, element tables, or LEB128 encodings will cause WASM validation errors (`CompileError: WebAssembly.instantiate(): failed`).
- **Prerequisite Investigation**: Run `Il2CppDumper` on `SanFrancisco.wasm.code.unityweb` and `global-metadata.dat` to extract function names, field offsets, and method addresses in `Assembly-CSharp.dll`.

#### C.2 Save Data & Player Inventory Manipulation
- **Description**: Modify unlocked characters, coin balances, keys, or high scores.
- **Storage Location**: IndexedDB stored in `~/.config/SubwaySurfersSanfrancisco/IndexedDB/`.
- **Format**: Chromium LevelDB key-value format.
- **Required Tools**: Chromium DevTools (open DevTools in `main.js` via `win.webContents.openDevTools()`) or Python LevelDB parser.
- **Difficulty**: Moderate to High (Level 6/10).
- **Risks**: Save file corruption resulting in reset to default values.

---

### Category D: Not Established / Unverified Feasibility

Components whose modification feasibility cannot be determined statically.

#### D.1 Online Cloud Save & Multiplayer Leaderboards
- **Description**: Connecting the client to a custom private server for online high scores.
- **Status**: **Unestablished**. The hardcoded backend endpoints (`subwaysurfers.kiloo-games.com/api/v3`) are legacy proprietary Kiloo services that may no longer be active or require proprietary TLS certificates/signatures.
- **Required Dynamic Investigation**: Inspect outbound network packets under a proxy to determine API protocol schemas and authentication headers.

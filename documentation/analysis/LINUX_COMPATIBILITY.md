# Linux Compatibility and System Requirements Analysis

## 1. Executive Summary

This document details the Linux operating system requirements, hardware requirements, library dependencies, display server behaviors, and potential distribution compatibility roadblocks for the Subway Surfers AppImage (`SubwaySurfers-x86-64.AppImage`).

The application demonstrates strong backward compatibility with Linux distributions released from 2017 onward, with specific runtime behaviors tailored for modern distributions (such as Ubuntu 24.04 LTS).

---

## 2. Core System Requirements

| Parameter | Confirmed Requirement | Recommended / Optimal | Evidence / Source |
| :--- | :--- | :--- | :--- |
| **CPU Architecture** | `x86_64` (AMD64) | 64-bit multi-core (x86_64) | ELF Header Machine: Advanced Micro Devices X86-64 |
| **Kernel Version** | Linux `3.2.0` or higher | Linux `5.15`+ | ELF ABI tag in `SubwaySurfers` binary |
| **GNU C Library** | **`glibc >= 2.25`** | `glibc >= 2.31`+ | ELF `.gnu.version_r` demands up to `GLIBC_2.25` |
| **RAM (System)** | Minimum 1.5 GB free | 4.0 GB+ | Electron (~300MB) + Unity WebGL Heap (352MB) |
| **Storage** | 350 MB disk space | 500 MB+ | Extracted size: 349 MB; AppImage size: 140 MB |
| **Display Server** | X11 or Wayland (via XWayland) | X11 or Wayland with Ozone enabled | Links against `libX11.so.6`, `libxcb.so.1` |
| **Graphics API** | OpenGL 2.1+ / OpenGL ES 2.0+ / Vulkan 1.0+ | OpenGL 3.3+ / Vulkan 1.2+ (Mesa / NVIDIA) | ANGLE / SwiftShader fallback |
| **Audio Server** | ALSA (`libasound.so.2`) | PipeWire / PulseAudio via ALSA plugin | ELF dependency on `libasound.so.2` |
| **Filesystem Mount** | FUSE (`libfuse2` or `fuse3`) | `libfuse2` / `fuse3` installed | AppImage Type 2 squashfuse runtime |

---

## 3. Graphics Subsystem & Hardware Compatibility

### 3.1 Graphics Stack Pipeline
The game renders through a multi-tiered pipeline:
`Unity WebGL (Canvas)` -> `Chromium GPU Process (ANGLE)` -> `Native OpenGL / Vulkan / SwiftShader`.

### 3.2 Hardware Vendors & Drivers
- **Intel Graphics**: Fully supported via Mesa drivers (`iris` or `crocus`). WebGL 2.0 runs natively via Mesa EGL/GLES.
- **AMD Radeon**: Fully supported via Mesa drivers (`radeonsi` or `amdgpu`). Excellent performance under both X11 and Wayland.
- **NVIDIA**: Supported via proprietary NVIDIA drivers (via GLX / EGL) and open-source `nouveau`.
- **Virtual Machines / Headless Systems**: Bundled with **Google SwiftShader** (`libvk_swiftshader.so` + `vk_swiftshader_icd.json`). If no 3D hardware GPU acceleration is present, the software rasterizer executes WebGL instructions on the CPU without crashing.

### 3.3 WebGL Specifications
- Primary: **WebGL 2.0** (`SanFrancisco.json`: `"graphicsAPI": ["WebGL 2.0", "WebGL 1.0"]`).
- Memory allocation: `TOTAL_MEMORY: 369098752` bytes (~352 MB allocated for WebGL/WASM heap).
- Drawing buffer: `"webglContextAttributes": {"preserveDrawingBuffer": false}` (optimal for 60 FPS continuous rendering).

---

## 4. Display Server & Desktop Integration

### 4.1 X11 vs. Wayland Behavior
- **Default Mode**: Operates as an X11 client using `libX11.so.6`, `libXcomposite.so.1`, `libXdamage.so.1`, `libXext.so.6`, `libXfixes.so.3`, and `libXrandr.so.2`.
- **Wayland Compatibility**: On native Wayland sessions (GNOME 40+, KDE Plasma 5/6, Sway), the window launches automatically through **XWayland**.
- **Native Wayland Execution**: Because Electron 36 is built on Chromium 134, native Wayland rendering can be activated by passing Ozone command-line arguments:
  ```bash
  ./SubwaySurfers-x86-64.AppImage --enable-features=UseOzonePlatform --ozone-platform=wayland
  ```

### 4.2 Desktop Integration Findings
- **Missing Desktop Entry**: The root of the SquashFS filesystem **does not contain a `.desktop` file**. Standard AppImage tools (such as `appimaged` or `AppImageLauncher`) rely on a root `.desktop` file to integrate the application into system application menus.
- **Icon Assets**: Contains a 512x512 RGBA PNG icon at `.DirIcon` and `resources/app/icon.png`.
- **Recommendation**: Create a compliant `subwaysurfers.desktop` file for system launcher integration.

---

## 5. Audio and Input Subsystems

### 5.1 Audio Compatibility
- Directly depends on `libasound.so.2` (ALSA).
- Interoperates seamlessly with modern Linux audio routing daemons:
  - **PipeWire**: Handled via `pipewire-alsa` wrapper.
  - **PulseAudio**: Handled via `pulseaudio-alsa` plugin.
- Audio codecs utilized: AAC streams encapsulated in ISO Base Media / MP4 containers (`resources.resource` and `sharedassets1.resource`), decoded using bundled `libffmpeg.so`.

### 5.2 Input Devices
- **Keyboard**: Full keyboard input via `libxkbcommon.so.0` (Arrow keys and Spacebar for lane shifting, jumping, rolling, and hoverboard activation).
- **Mouse / Touch**: Mouse click-and-drag emulation for swipe gestures.
- **Gamepads / Joysticks**: Supported via Chromium Gamepad API backed by `libudev.so.1`.

---

## 6. Distribution-Specific Compatibility Roadblocks & Mitigations

### 6.1 Issue 1: AppArmor Unprivileged User Namespace Restrictions (Ubuntu 24.04 LTS+)
- **Problem**: Ubuntu 24.04 LTS introduced an AppArmor restriction that blocks unprivileged user namespaces (`kernel.apparmor_restrict_unprivileged_userns = 1`). Standard Chromium/Electron SUID sandbox helpers fail to launch.
- **Status in this AppImage**: **Handled proactively**.
  `AppRun` explicitly checks `/proc/sys/kernel/apparmor_restrict_unprivileged_userns` and automatically appends `--no-sandbox` if restriction is enabled:
  ```bash
  restriction=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns)
  if [ "$restriction" = "1" ]; then
      sandbox="--no-sandbox"
  fi
  ```

### 6.2 Issue 2: Hardcoded Global Symlink at `/tmp/SubwaySurfers`
- **Problem**: `AppRun` creates a symbolic link at `/tmp/SubwaySurfers` pointing to the extracted `html` directory:
  ```bash
  check_symlink "/tmp/SubwaySurfers"
  ln -s "$HERE/html" /tmp/SubwaySurfers
  ```
- **Risks**:
  1. Multi-user systems: If User A launches the AppImage, `/tmp/SubwaySurfers` is created. If User B attempts to launch the AppImage, `ln -s` fails or errors out with permission denied.
  2. Stale symlink: If the process is terminated abruptly (e.g. `SIGKILL`), the symlink may remain, causing subsequent launches to encounter path conflicts.
- **Mitigation / Recommendation**: Modify `resources/app/main.js` and `AppRun` to use user-isolated runtime paths (e.g., `$XDG_RUNTIME_DIR/SubwaySurfers` or relative paths via `path.join(__dirname, '../../html')`).

### 6.3 Issue 3: Missing Host FUSE Subsystem
- **Problem**: AppImage Type 2 binaries require FUSE (`fusermount`) to mount the SquashFS payload. Minimal server installations or containerized environments (Docker/LXC) often lack `/dev/fuse`.
- **Mitigation**: The AppImage provides the built-in `--appimage-extract` flag. Users without FUSE can extract the archive once and execute `./squashfs-root/AppRun` directly.

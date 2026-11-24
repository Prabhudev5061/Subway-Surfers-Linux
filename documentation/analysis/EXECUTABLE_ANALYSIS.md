# Executable and Shared Library Analysis

## 1. Executive Summary

This document presents a comprehensive static binary and dependency analysis of the executables and shared objects contained within the Subway Surfers AppImage (`SubwaySurfers-x86-64.AppImage`).

The application is structured into two distinct execution tiers:
1. **The Native Host Tier**: An **Electron 36.5.0** native Linux runtime built on **Chromium 134** and **Node.js**, compiled as a 64-bit ELF Position-Independent Executable (PIE) for `x86_64`.
2. **The Game Engine Execution Tier**: A **WebAssembly (WASM)** binary module (`SanFrancisco.wasm.code.unityweb`) executed within Chromium's V8 engine, hosting the compiled C# IL2CPP codebase of **Unity 2019.4.18f1**.

---

## 2. ELF Binaries Overview

All native binaries located within the extracted payload directory (`squashfs-root/`) were analyzed using `file`, `readelf`, `objdump`, `nm`, and `strings`.

### 2.1 Binary Inventory

| Binary | File Type | Size | Build ID (SHA-1) | Stripped? | Default Search Path (RPATH/RUNPATH) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SubwaySurfers` | ELF 64-bit LSB PIE executable | 197,543,680 B (~188 MB) | `5fc0d229d46afe163fb03588dbeae156247df1ea` | **No** (contains `.symtab`) | `RPATH: [$ORIGIN]` |
| `chrome-sandbox` | ELF 64-bit LSB PIE executable | 38,224 B (~37 KB) | `df28017d426455b189e0f1bb054805f3fec8f3e7` | **No** (with debug_info) | None |
| `chrome_crashpad_handler` | ELF 64-bit LSB PIE executable | 1,556,152 B (~1.48 MB) | `1ab57b9b6caff799239de6c699393fc793c34204` | **No** | None |
| `libffmpeg.so` | ELF 64-bit LSB shared object | 2,778,264 B (~2.65 MB) | `434990d8d63ab4a125f9d18fe11a5b94fdc64548` | **No** | `RUNPATH: [$ORIGIN]` |
| `libEGL.so` | ELF 64-bit LSB shared object | 260,424 B (~254 KB) | `1442973985182124faa311defc5e60696c97f4f1` | **No** | None |
| `libGLESv2.so` | ELF 64-bit LSB shared object | 6,434,712 B (~6.14 MB) | `8c2215222fdceb383a2b3771b51e44e7d3b45a61` | **No** | None |
| `libvk_swiftshader.so` | ELF 64-bit LSB shared object | 4,799,136 B (~4.58 MB) | `f2cc6f448619497af40ba8fc0bc3d44d434fcc00` | **No** | None |
| `libvulkan.so.1` | ELF 64-bit LSB shared object | 2,272,144 B (~2.17 MB) | `186532eb10fc36e45d0baa4b5d1c32cb1357814b` | **No** (with debug_info) | None |

---

## 3. Main Executable Analysis (`SubwaySurfers`)

### 3.1 ELF Header & Architecture
- **Class / Data**: ELF64, 2's complement, Little Endian.
- **Machine**: Advanced Micro Devices X86-64.
- **ELF Type**: `ET_DYN` (Position Independent Executable).
- **OS/ABI**: UNIX - System V (`ABI Version: 0`).
- **Entry Point**: `0x028c50e0`.
- **Flags**: `BIND_NOW`, `NOW PIE`.
- **Interpreter**: `/lib64/ld-linux-x86-64.so.2`.

### 3.2 Dynamic Section & RPATH
- Dynamic section contains 61 entries.
- `RPATH` is configured as `[$ORIGIN]`. This allows the executable to discover bundled libraries (`libffmpeg.so`) residing in the same directory as the executable without requiring `LD_LIBRARY_PATH`.

### 3.3 Dynamic Dependencies (Direct DT_NEEDED Entries)
The main executable declares direct dependencies on 34 shared objects:
1. `libffmpeg.so` (Bundled)
2. `libdl.so.2` (System)
3. `libpthread.so.0` (System)
4. `libglib-2.0.so.0` (System)
5. `libgobject-2.0.so.0` (System)
6. `libgio-2.0.so.0` (System)
7. `libnss3.so` (System)
8. `libnssutil3.so` (System)
9. `libsmime3.so` (System)
10. `libnspr4.so` (System)
11. `libdbus-1.so.3` (System)
12. `libatk-1.0.so.0` (System)
13. `libatk-bridge-2.0.so.0` (System)
14. `libcups.so.2` (System)
15. `libgtk-3.so.0` (System)
16. `libpango-1.0.so.0` (System)
17. `libcairo.so.2` (System)
18. `libX11.so.6` (System)
19. `libXcomposite.so.1` (System)
20. `libXdamage.so.1` (System)
21. `libXext.so.6` (System)
22. `libXfixes.so.3` (System)
23. `libXrandr.so.2` (System)
24. `libgbm.so.1` (System)
25. `libexpat.so.1` (System)
26. `libxcb.so.1` (System)
27. `libxkbcommon.so.0` (System)
28. `libudev.so.1` (System)
29. `libasound.so.2` (System)
30. `libatspi.so.0` (System)
31. `libm.so.6` (System)
32. `libgcc_s.so.1` (System)
33. `libc.so.6` (System)
34. `ld-linux-x86-64.so.2` (System)

### 3.4 Symbol Information
- `.dynsym` table size: **11,042 entries**.
- `.symtab` is present and **unstripped** in all binaries, allowing high-fidelity static reverse engineering and stack unwinding.

### 3.5 GLIBC Version Compatibility Requirements
The version definition records (`.gnu.version_r`) of `SubwaySurfers` demand the following GLIBC symbols:
- `GLIBC_2.2.5`
- `GLIBC_2.3`
- `GLIBC_2.3.2`
- `GLIBC_2.3.3`
- `GLIBC_2.3.4`
- `GLIBC_2.4`
- `GLIBC_2.6`
- `GLIBC_2.7`
- `GLIBC_2.8`
- `GLIBC_2.9`
- `GLIBC_2.10`
- `GLIBC_2.11`
- `GLIBC_2.12`
- `GLIBC_2.14`
- `GLIBC_2.15`
- `GLIBC_2.16`
- `GLIBC_2.17`
- `GLIBC_2.18`
- **`GLIBC_2.25`** *(Maximum required symbol)*

**Compatibility Assessment**: Because the maximum requirement is `GLIBC_2.25` (released in February 2017), the binary will execute seamlessly on virtually all modern Linux distributions (Ubuntu 18.04+, Debian 10+, Fedora 26+, Arch Linux, RHEL 8+).

---

## 4. Bundled Shared Libraries Analysis

### 4.1 `libffmpeg.so`
- **Purpose**: Bundled media decoder for Chromium/Electron HTML5 audio and video playback.
- **DT_RUNPATH**: `[$ORIGIN]`
- **GLIBC Max**: `GLIBC_2.17`
- **Dynamic Dependencies**: `libpthread.so.0`, `libm.so.6`, `libgcc_s.so.1`, `libc.so.6`, `ld-linux-x86-64.so.2`.

### 4.2 `libEGL.so` & `libGLESv2.so` (ANGLE Subsystem)
- **Purpose**: Almost Native Graphics Layer Engine (ANGLE) translating WebGL API calls into native OpenGL / Vulkan commands.
- **GLIBC Max**: `GLIBC_2.16` (`libEGL.so`), `GLIBC_2.17` (`libGLESv2.so`).
- **Dependencies**: `libdl.so.2`, `libpthread.so.0`, `libX11.so.6`, `libXext.so.6`, `libxcb.so.1`, `libc.so.6`.
- **Loading Behavior**: Loaded at runtime via `dlopen()` by the Chromium GPU process.

### 4.3 `libvk_swiftshader.so` & `libvulkan.so.1` (Vulkan Software Fallback)
- **Purpose**: CPU-based Vulkan software implementation (Google SwiftShader). Configured by `vk_swiftshader_icd.json` pointing to `./libvk_swiftshader.so`.
- **GLIBC Max**: `GLIBC_2.17` (`libvk_swiftshader.so`), `GLIBC_2.16` (`libvulkan.so.1`).
- **Importance**: Ensures WebGL 1.0 and WebGL 2.0 graphics render properly even on Linux systems lacking hardware GPU drivers or running inside virtual machines.

---

## 5. Secondary Executable Tier: WebAssembly (`SanFrancisco.wasm.code.unityweb`)

Unlike traditional native desktop games where gameplay logic resides in compiled C++ or Mono/IL2CPP ELF shared objects (like `libil2cpp.so` or `libunity.so`), this application's game logic is compiled into a WebAssembly module.

### 5.1 WASM Binary Structure
- **Format**: WebAssembly Binary (WASM), version 1 (MVP).
- **File Size**: 25,765,359 bytes (~24.57 MB).
- **Compression**: Raw uncompressed WASM bytecode.

### 5.2 Section Breakdown

| Section ID | Section Type | Size (Bytes) | Description |
| :--- | :--- | :--- | :--- |
| **1** | Type | 7,972 | Function signature declarations |
| **2** | Import | 12,626 | Host bindings (WebGL, WebAudio, JS runtime calls) |
| **3** | Function | 73,962 | Function definitions index |
| **6** | Global | 46 | Global WASM variables |
| **7** | Export | 16,570 | Exported functions called by JavaScript glue |
| **9** | Element | 365,832 | Function table elements (indirect call table) |
| **10** | **Code** | **22,096,120** | **Compiled IL2CPP C# function bodies (~22.1 MB)** |
| **11** | Data | 3,192,193 | Static linear data memory segments (~3.19 MB) |

### 5.3 Functionality & Reverse Engineering Potential
- Contains the compiled game loop, player physics, collision detection routines, animation state machines, and obstacle spawning logic of Subway Surfers.
- Interfaces directly with `SanFrancisco.wasm.framework.unityweb` for Emscripten memory and canvas manipulation.
- Uses `Il2CppData/Metadata/global-metadata.dat` (embedded in `SanFrancisco.data.unityweb`) for string literals and method type metadata.
- Can be disassembled using `wasm2wat` or decompiled via Ghidra with WebAssembly extensions.

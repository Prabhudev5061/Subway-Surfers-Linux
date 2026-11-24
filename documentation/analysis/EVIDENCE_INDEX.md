# Evidence and Verification Index

## 1. Overview

This document indexes all verification evidence, command invocations, raw output artifacts, file offsets, and cryptographic checksums collected during the static analysis of `SubwaySurfers-x86-64.AppImage`.

All raw evidence files are stored in `analysis/evidence/`.

---

## 2. Core Cryptographic and File Signatures

| File / Component | Metric | Value | Evidence File |
| :--- | :--- | :--- | :--- |
| **Original AppImage** | Absolute Path | `/home/prabhudev/Subway Surfer/SubwaySurfers-x86-64.AppImage` | `file_stat.txt` |
| **Original AppImage** | Size (Bytes) | `140,473,536 bytes` (~133.97 MB) | `file_stat.txt` |
| **Original AppImage** | SHA-256 | `84a81c0c76abd5e58d31f94e1e9b1a5f823bf482f73db6e2fe63d5a27d37fc35` | `sha256.txt` |
| **Original AppImage** | Permissions | `-rwxrwxr-x` (0775) | `file_stat.txt` |
| **AppImage Runtime** | ELF Magic | `7f 45 4c 46 02 01 01 00 41 49 02 00 00 00 00 00` (Type 2 "AI\x02") | `elf_header.txt` |
| **SquashFS Offset** | Byte Offset | `189632` (0x0002e4c0) | `squashfs_magic_offset.txt` |
| **SquashFS Superblock**| Creation Date | `Thu Jun 26 23:21:29 2025` | `squashfs_super.txt` |
| **SquashFS Size** | Filesystem Size | `140,279,847 bytes` (~133.78 MB), compression: gzip | `squashfs_super.txt` |
| **Main Executable** | Size (Bytes) | `197,543,680 bytes` (~188.39 MB) | `binary_types.txt` |
| **Main Executable** | Build ID (SHA-1)| `5fc0d229d46afe163fb03588dbeae156247df1ea` | `binary_types.txt` |
| **Unity WebGL Data** | Magic & Header | `UnityWebData1.0\0`, header length: 270 bytes | `unityweb_entries.txt` |
| **Unity IL2CPP Meta** | Magic & Version | Magic: `0xfab11baf`, Version: `24` | `il2cpp_metadata.txt` |
| **UnityFS Bundle** | Magic & Engine | `UnityFS`, Generator Version: `2019.4.18f1` | `unityfs_header_details.txt` |
| **WebAssembly Engine**| Format & Size | WASM v1 MVP, `25,765,359 bytes` | `wasm_sections.txt` |

---

## 3. Evidence Files Directory

### 3.1 AppImage Identification & Extraction Evidence
- **`analysis/evidence/sha256.txt`**: Original AppImage SHA-256 hash.
- **`analysis/evidence/file_stat.txt`**: File size, access/modification timestamps, inode metadata.
- **`analysis/evidence/file_type.txt`**: Standard `file` utility classification.
- **`analysis/evidence/elf_header.txt`**: AppImage runtime ELF64 header showing Type 2 signature.
- **`analysis/evidence/sections.txt`**: AppImage runtime 32 ELF section headers.
- **`analysis/evidence/runtime_strings.txt`**: Strings from the AppImage runtime (`squashfuse`, `appimage_get_elf_section_offset_and_length`).
- **`analysis/evidence/squashfs_magic_offset.txt`**: Byte offset detection locating `hsqs` at offset `189632`.
- **`analysis/evidence/squashfs_super.txt`**: Output of `unsquashfs -s -offset 189632` validating the SquashFS 4:0 superblock.
- **`analysis/evidence/squashfs_filelist.txt`**: Complete file list dumped from SquashFS before extraction.
- **`analysis/evidence/extraction.log`**: Safe extraction log using host `unsquashfs` utility (0 errors, 96 files created).

### 3.2 Executable & Dynamic Dependency Evidence
- **`analysis/evidence/binary_types.txt`**: ELF classification, architecture, and BuildIDs for all extracted binaries and shared libraries.
- **`analysis/evidence/SubwaySurfers_dynamic.txt`**: `readelf -d` output showing RPATH `[$ORIGIN]` and 34 DT_NEEDED entries.
- **`analysis/evidence/chrome_bin_needed.txt`**: DT_NEEDED dependencies of `chrome-sandbox` and `chrome_crashpad_handler`.
- **`analysis/evidence/all_libs_needed.txt`**: DT_NEEDED dependencies of all bundled `.so` files.
- **`analysis/evidence/all_unique_needed_libs.txt`**: De-duplicated list of all 34 required shared libraries.
- **`analysis/evidence/glibc_versions.txt`**: Complete list of requested GLIBC symbol versions.
- **`analysis/evidence/glibc_max.txt`**: Sorted list of GLIBC symbol versions establishing `GLIBC_2.25` as the maximum requirement.
- **`analysis/evidence/libs_glibc_max.txt`**: Verification showing bundled `.so` files require only `GLIBC_2.16` / `GLIBC_2.17`.
- **`analysis/evidence/host_lib_check.txt`**: Verification matching all 34 dynamic dependencies against host `ldconfig` cache (100% satisfied).

### 3.3 Engine & Game Asset Evidence
- **`analysis/evidence/unityweb_files.txt`**: `file` classification of files in `html/Build/`.
- **`analysis/evidence/unity_data_hex.txt`**: Hexdump of `SanFrancisco.data.unityweb` identifying `UnityWebData1.0` header.
- **`analysis/evidence/unityweb_entries.txt`**: Exact byte offsets, lengths, and file paths of all 7 embedded files inside `SanFrancisco.data.unityweb`.
- **`analysis/evidence/boot_config.txt`**: Dumped contents of embedded `boot.config`.
- **`analysis/evidence/data_unity3d_magic.txt`**: Identification of `UnityFS` archive signature in `data.unity3d`.
- **`analysis/evidence/unityfs_header_details.txt`**: UnityFS version 7 header parsing showing Unity `2019.4.18f1` generator version and LZ4 compression flags.
- **`analysis/evidence/unity_bundle_files.txt`**: Serialized Unity assets identified in the bundle header (`globalgamemanagers`, `sharedassets0.assets`, `level0`).
- **`analysis/evidence/audio_streams.txt`**: Identification of 24 ISO Base Media / MP4 (`ftypmp42`) streams in `resources.resource` and 21 streams in `sharedassets1.resource`.
- **`analysis/evidence/wasm_sections.txt`**: WebAssembly section breakdown of `SanFrancisco.wasm.code.unityweb` (Code section: 22.1 MB).
- **`analysis/evidence/framework_head.txt`**: Header lines of Emscripten runtime JavaScript glue code.

### 3.4 IL2CPP Metadata & System Extraction Evidence
- **`analysis/evidence/il2cpp_metadata.txt`**: Identification of IL2CPP magic `0xFAB11BAF` and version `24`.
- **`analysis/evidence/il2cpp_header_fields.txt`**: Offsets and sizes of all IL2CPP v24 metadata tables (literals, strings, methods, fields, types).
- **`analysis/evidence/il2cpp_assemblies.txt`**: C# assemblies identified in IL2CPP metadata (`Assembly-CSharp.dll`, `UnityEngine.*`).
- **`analysis/evidence/all_string_literals.txt`**: Complete dump of all 11,045 UTF-8 string literals decoded from IL2CPP metadata.
- **`analysis/evidence/string_literals_summary.txt`**: 52 HTTP/HTTPS endpoints extracted from string literals.
- **`analysis/evidence/game_classes.txt`**: 476 Subway Surfers game classes extracted from metadata.
- **`analysis/evidence/game_systems.txt`**: Character, hoverboard, track, coin, and powerup classes.
- **`analysis/evidence/characters_and_boards.txt`**: Confirmation of 14 Subway Surfers characters and specific hoverboard bundles.
- **`analysis/evidence/shader_list.txt`**: Shader names (`Custom/Distorted/Character seperated alpha`, `Unlit/Transparent Colored`).
- **`analysis/evidence/audio_symbols.txt`**: Audio method and clip names in IL2CPP metadata.
- **`analysis/evidence/audio_literals.txt`**: Audio string literals.
- **`analysis/evidence/loc_literals.txt`**: Localization strings and language support references.
- **`analysis/evidence/html_urls.txt`**: URLs identified in JavaScript files within `html/`.

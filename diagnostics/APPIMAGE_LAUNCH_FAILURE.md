# APPIMAGE LAUNCH FAILURE INVESTIGATION REPORT

**Date:** 2026-11-24  
**Target:** `SubwaySurfers-AutoSave-Fixed-x86_64.AppImage` (Initial Repair Release)  
**Host Environment:** Linux x86-64 (Kernel 6.8+, Ubuntu/Debian based)  
**Status:** ROOT CAUSE IDENTIFIED & REPRODUCED  

---

## 1. Executive Summary

Following the initial repair release of the Subway Surfers Linux AutoSave system, attempts to execute the packaged AppImage (`SubwaySurfers-AutoSave-Fixed-x86_64.AppImage`) resulted in an immediate launch failure with exit code `127`. No graphical window opened, and the application terminated prior to executing any Electron or Unity code.

An exhaustive read-only inspection confirmed that the failure was caused by a **SquashFS compression format mismatch** between the filesystem payload and the embedded AppImage Type 2 ELF runtime decompressor.

---

## 2. Execution Traces & Diagnostic Evidence

### 2.1 Direct Execution

```bash
$ ./SubwaySurfers-AutoSave-Fixed-x86_64.AppImage
Squashfs image uses (null) compression, this version supports only xz, zlib.
Cannot mount AppImage, please check your FUSE setup.
You might still be able to extract the contents of this AppImage 
if you run it with the --appimage-extract option. 
See https://github.com/AppImage/AppImageKit/wiki/FUSE 
for more information
open dir error: No such file or directory
$ echo $?
127
```

### 2.2 Extraction Attempt (`--appimage-extract`)

```bash
$ ./SubwaySurfers-AutoSave-Fixed-x86_64.AppImage --appimage-extract
Squashfs image uses (null) compression, this version supports only xz, zlib.
Failed to open squashfs image
$ echo $?
1
```

### 2.3 Filesystem Inspection

Inspection of the compiled SquashFS payload (`build/app.squashfs`) using `file`:
```bash
$ file SubwaySurfers-Linux-Repair/build/app.squashfs
Squashfs filesystem, little endian, version 4.0, zstd compressed, 128577292 bytes, 112 inodes, blocksize: 131072 bytes
```

Inspection of the original upstream AppImage (`SubwaySurfers-x86-64.AppImage`):
```bash
$ unsquashfs -s -o 189632 SubwaySurfers-x86-64.AppImage
Found a valid SQUASHFS 4:0 superblock on SubwaySurfers-x86-64.AppImage.
Creation or last append time Thu Jun 26 23:21:29 2025
Filesystem size 140279847 bytes (133.78 Mbytes)
Compression gzip
Block size 131072
```

---

## 3. Technical Root Cause Analysis

1. **AppImage Type 2 Architecture:**
   An AppImage Type 2 file begins with a 189,632-byte ELF binary (the runtime). When executed, the runtime reads the SquashFS superblock at offset 189,632, mounts the filesystem using `libsquashfuse`, and executes `AppRun`.
2. **Runtime Decompressor Constraints:**
   The embedded runtime's `libsquashfuse` library was built supporting only two compression formats: `xz` and `zlib` (`gzip`). It does **not** contain decompressor routines for `zstd`, `lzo`, or `lz4`.
3. **Packaging Defect:**
   During the previous packaging pipeline, `mksquashfs` compressed the root directory using `zstd` (either by default or via flag). When `libsquashfuse` inspected the compression flag in the superblock, it returned a null compression handler:
   `Squashfs image uses (null) compression, this version supports only xz, zlib.`
4. **Cascade Failure:**
   Because the filesystem could not be mounted, FUSE mounting aborted, no root directory could be opened (`open dir error`), and the runtime exited with status 127 without launching `AppRun` or Electron.

---

## 4. Contributing Secondary Defects Identified

1. **Dangling Symlink Failure in `main.js`:**
   When an AppImage exits abruptly, the symlink `/tmp/SubwaySurfers` targeting the temporary mount directory `/tmp/.mount_SubwayXXXXXX/html` is left behind as a dangling link. On subsequent launches, `fs.existsSync('/tmp/SubwaySurfers')` returned `false`, but `fs.symlinkSync` failed with `EEXIST`. The application fell back to dynamic mount paths, mutating the origin URL and breaking save path resolution.
2. **Monolithic Error in `4399.js` Directory Pre-Creation:**
   In Emscripten MEMFS, `/tmp` already exists. Grouping `FS.mkdir('/tmp')` with `/file:/tmp/SubwaySurfers` in a single try block resulted in an immediate unhandled `EEXIST` jump, preventing `/file:/tmp/SubwaySurfers` from being created and causing `[FileUtil]` errors.

---

## 5. Resolution Strategy

1. Rebuild the SquashFS filesystem using `mksquashfs` with `-comp gzip -b 131072 -root-owned -noappend`.
2. Re-concatenate the original Type 2 runtime header with the newly compressed gzip SquashFS image.
3. Harden `main.js` to inspect and unlink dangling `/tmp/SubwaySurfers` symlinks before creating fresh links.
4. Replace the monolithic `FS.mkdir` calls in `4399.js` with idempotent `safeMkdir` checks.

# Troubleshooting Guide — `SubwaySurfers-Linux`

## 1. "Save Storage Locked" Error on Launch
- **Cause:** Another version (`SanFrancisco`, `Beijing`, or `Zurich`) or a second instance is currently running and holds `~/.local/share/SubwaySurfers-Linux/Save/.storage.lock`.
- **Fix:** Close the already-running Subway Surfers window first. If the previous process crashed and nothing is running, relaunching automatically clears dead-PID stale locks.

## 2. "Save Migration Conflict" Error on First Launch
- **Cause:** Legacy saves existed in multiple old profile directories (`~/.config/SubwaySurfersSanfrancisco`, `SubwaySurfersBeijing2`, or `SubwaySurfersZurich`). To avoid overwriting player progress, automatic migration stopped and backed up all detected profiles to `~/.local/share/SubwaySurfers-Linux/migration/backups/`.
- **Fix:** Launch once with your explicit choice:
  ```bash
  subwaysurfers-sanfrancisco --migrate-source=sanfrancisco
  # OR
  subwaysurfers-beijing --migrate-source=beijing
  # OR
  subwaysurfers-zurich --migrate-source=zurich
  ```

## 3. Running on Dual-GPU Laptops (Intel + NVIDIA PRIME Offload)
- Default Intel Mesa OpenGL runs out of the box (`ANGLE (Intel, Mesa Intel(R) Graphics ...)`).
- To force NVIDIA RTX GPU rendering:
  ```bash
  __NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia subwaysurfers-zurich
  ```

## 4. AppImage Won't Launch on Ubuntu 24.04+ (`userns` / FUSE)
- **AppArmor userns restriction:** All three `AppRun` scripts automatically detect `/proc/sys/kernel/apparmor_restrict_unprivileged_userns == 1` and pass `--no-sandbox`.
- **Missing FUSE:** Install `libfuse2` / `libfuse2t64`, or run with `--appimage-extract-and-run`.

## 5. Logs Location
Runtime diagnostics are written to:
- `~/.local/state/SubwaySurfers-Linux/sanfrancisco/runtime.log`
- `~/.local/state/SubwaySurfers-Linux/beijing/runtime.log`
- `~/.local/state/SubwaySurfers-Linux/zurich/runtime.log`

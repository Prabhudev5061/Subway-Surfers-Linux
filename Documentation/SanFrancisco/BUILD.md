# Building `SubwaySurfers-SanFrancisco-Linux`

## Prerequisites
- Base upstream AppImage `SubwaySurfers-x86-64.AppImage` in the parent workspace directory (or set `SUBWAY_BASE_APPIMAGE=/path/to/SubwaySurfers-x86-64.AppImage`).
- Installed tools: `squashfs-tools` (`unsquashfs`, `mksquashfs`), `dpkg-deb`, `python3`, `sha256sum`.

## Build Command
```bash
./Scripts/build-sanfrancisco.sh
./Scripts/verify-checksums.sh --generate
```

## Outputs
- `App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage`
- `Debian installers/SubwaySurfers-SanFrancisco-Linux-amd64.deb`
- `Terminal-Bash-Installers/SanFrancisco/required-files/` (populated for standalone installation)

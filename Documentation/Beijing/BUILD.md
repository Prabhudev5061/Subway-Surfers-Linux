# Building `SubwaySurfers-Beijing-Linux`

## Prerequisites
- Verified local Beijing build files present under `Source/Beijing/web/Build/` (`Beijing_2.json`, `Beijing_2.data.unityweb`, `Beijing_2.wasm.code.unityweb`, `Beijing_2.wasm.framework.unityweb`) and `Source/Beijing/assets/4399.png`.
- Base Electron 36.5.0 runtime available via `../SubwaySurfers-x86-64.AppImage` (or `SUBWAY_BASE_APPIMAGE`).
- Installed tools: `squashfs-tools`, `dpkg-deb`, `python3`, `sha256sum`.

## Build Command
```bash
./Scripts/build-beijing.sh
./Scripts/verify-checksums.sh --generate
```

## Outputs
- `App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage`
- `Debian installers/SubwaySurfers-Beijing-Linux-amd64.deb`
- `Terminal-Bash-Installers/Beijing/required-files/` (populated for standalone installation)

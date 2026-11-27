# Building `SubwaySurfers-Zurich-Linux`

## Prerequisites
- Verified local Zurich build files present under `Source/Zurich/web/Build/` (`ZurichNewPrivacy.json`, `ZurichNewPrivacy.data.unityweb`, `ZurichNewPrivacy.wasm.code.unityweb`, `ZurichNewPrivacy.wasm.framework.unityweb`), `Source/Zurich/web/UnityLoader.2019.2.js`, `Source/Zurich/web/4399.js`, `Source/Zurich/assets/b3f5e1472e1bfbee1804c7e854546a08.png`, and `Source/Zurich/assets/subwaysurfers-zurich.png`.
- Base Electron 36.5.0 runtime available via `../SubwaySurfers-x86-64.AppImage` (or `SUBWAY_BASE_APPIMAGE`).
- Installed tools: `squashfs-tools`, `dpkg-deb`, `python3`, `sha256sum`.

## Build Command
```bash
./Scripts/build-zurich.sh
./Scripts/verify-checksums.sh --generate
```

## Outputs
- `App images/SubwaySurfers-Zurich-Linux-x86_64.AppImage`
- `Debian installers/SubwaySurfers-Zurich-Linux-amd64.deb`
- `Terminal-Bash-Installers/Zurich/required-files/` (populated for standalone installation)

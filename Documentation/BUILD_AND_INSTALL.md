# Build & Install Guide — `SubwaySurfers-Linux 1.0`

## 1. Building Locally

### Prerequisites
- Upstream San Francisco base AppImage at `../SubwaySurfers-x86-64.AppImage` (or set `SUBWAY_BASE_APPIMAGE`)
- Local proprietary Unity WebGL files present under:
  - `Source/SanFrancisco/web/Build/` + `Source/SanFrancisco/assets/subwaysurfers.png`
  - `Source/Beijing/web/Build/` + `Source/Beijing/assets/4399.png`
  - `Source/Zurich/web/Build/` + `Source/Zurich/assets/b3f5e1472e1bfbee1804c7e854546a08.png` + `Source/Zurich/assets/subwaysurfers-zurich.png`
- System tools: `squashfs-tools` (`unsquashfs`, `mksquashfs`), `dpkg-deb`, `python3`, `sha256sum`

### Build Commands

```bash
# Build all three versions (AppImage + .deb + standalone installer bundles) and regenerate SHA256SUMS
./Scripts/build-all.sh

# Or build a single version:
./Scripts/build-sanfrancisco.sh
./Scripts/build-beijing.sh
./Scripts/build-zurich.sh
./Scripts/verify-checksums.sh --generate
```

### Primary v1.0 Release Outputs
- `App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage`
- `App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage`
- `App images/SubwaySurfers-Zurich-Linux-x86_64.AppImage`
- `Debian installers/SubwaySurfers-SanFrancisco-Linux-amd64.deb`
- `Debian installers/SubwaySurfers-Beijing-Linux-amd64.deb`
- `Debian installers/SubwaySurfers-Zurich-Linux-amd64.deb`

## 2. Running Tests & Verifying Checksums

```bash
./Scripts/test-all.sh
./Scripts/verify-checksums.sh
```

## 3. Installing & Uninstalling

See [INSTALLATION.md](INSTALLATION.md) for AppImage, `.deb`, and standalone Bash installer commands. Neither installation nor uninstallation modifies or removes `~/.local/share/SubwaySurfers-Linux/Save/`.

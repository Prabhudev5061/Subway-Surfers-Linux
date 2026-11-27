# SubwaySurfers-Zurich-Linux

- **Game Build:** Subway Surfers World Tour: Zurich (`ZurichNewPrivacy`, `1.94.0`)
- **Unity Engine:** `2019.4.18f1` (`Build/ZurichNewPrivacy.json`)
- **Electron Runtime:** Electron `36.5.0` / Chromium `134`
- **Shared Save Location:** `~/.local/share/SubwaySurfers-Linux/Save/`
- **Original Logo:** `Source/Zurich/assets/b3f5e1472e1bfbee1804c7e854546a08.png` (`40x40` WebP, `1,054` bytes, SHA-256 `2ce9ec76c8503a9fbdb459d457ec1f140c97a443eae99f0cb12bc9ac0c15759a`)
- **Desktop/X11 PNG Icon:** `Source/Zurich/assets/subwaysurfers-zurich.png` (`256x256` RGBA PNG decoded from original logo, `91,301` bytes, SHA-256 `145baf5e11c4d42c8c9f920679db4d9ee7c0de92a202882c7d94008b77c1ce23`)

## Overview
Integrates the verified `ZurichNewPrivacy` WebGL build (`1.94.0`, Unity `2019.4.18f1`) into the unified `SubwaySurfers-Linux` collection with clean-room offline runtime shims (`poki-sdk-cleanroom.js` in `'adblock'` mode, `unity_2019_4_compat.js`, `runtime_bootstrap.js`), minimal full-viewport UI, fullscreen startup (`F11` toggle, `Escape` preserved), original Zurich branding, and shared `~/.local/share/SubwaySurfers-Linux/Save/` persistence.

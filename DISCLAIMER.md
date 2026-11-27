# Disclaimer & Provenance Notice — SubwaySurfers-Linux

**SubwaySurfers-Linux** is an independent, unofficial Linux desktop integration project. I put it together for personal, educational, and preservation-oriented use so all three available 1.94.0 WebGL builds (*San Francisco*, *Beijing*, and *Zurich*) can run cleanly on Linux with WASD controls, a minimal fullscreen window, offline ad-free wrappers, and one shared save directory.

## No Affiliation or Endorsement

This project is **not** affiliated with, endorsed by, sponsored by, or approved by **SYBO Games ApS** or **Kiloo Games**. No written permission, license agreement, or redistribution authorization from SYBO Games or Kiloo Games exists for the proprietary game assets.

## Intellectual Property Boundaries

- **Original Game Assets:** *Subway Surfers*, its characters, names, logos, artwork, audio, 3D models, and compiled Unity WebGL game bundles (`.unityweb` files, Unity loaders, and `4399.js` runtime glue) remain the intellectual property of **SYBO Games ApS**, **Kiloo Games**, and their respective owners.
- **Linux Integration Work:** My original Linux desktop integration code (Electron shell, shared save storage bridge, process locking, autosave/crash recovery logic, WASD controls remapping, build/packaging scripts, tests, and documentation) is separate from the original game intellectual property and is licensed under the MIT License in [LICENSE](LICENSE). Removing online advertising wrappers or promotional popups from the local desktop runtime does not represent any claim of ownership over the original game.

## Provenance & Distribution Restrictions

- **San Francisco base AppImage foundation:** Originated from an existing Linux AppImage uploaded by Drizzle on AppImageHub (`https://www.appimagehub.com/p/2299024`). That link records where the upstream Linux wrapper came from; it does not grant permission to redistribute *Subway Surfers* game assets.
- **Beijing & Zurich WebGL builds:** Sourced from archived third-party WebGL mirrors (`Beijing_2` and `ZurichNewPrivacy`, both game version `1.94.0`) without upstream rights-holder redistribution clearance.
- **Public Git & Binary Redistribution:** Because redistribution rights for the proprietary Unity game bundles and artwork have not been verified or granted by the rights holders, all `.unityweb` bundles, logos, compiled `.AppImage` executables, and `.deb` packages are excluded from Git tracking via `.gitignore` and are **not** published for public download.
- Users should obtain and use original game assets only where they have the legal right to do so under applicable law and rights-holder permissions. Saying a project is for educational or personal use does not make public redistribution of copyrighted assets lawful.

## No Warranty

This software and its packaging scripts are provided as-is, without warranties or guarantees of any kind.

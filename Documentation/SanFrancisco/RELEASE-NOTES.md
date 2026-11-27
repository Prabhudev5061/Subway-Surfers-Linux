# Release Notes — `SubwaySurfers-SanFrancisco-Linux` (`SubwaySurfers-Linux 1.0`, Game `1.94.0`)

- Updated movement controls to **WASD** (`W` jump, `A` left, `S` roll, `D` right) via `Source/Shared/controls_wasd.js`, disabling physical arrow keys as primary movement while preserving `Space`, `Escape`, `F11`, mouse, touch, gamepad, text input, and Electron shortcuts.
- Packaged as part of **SubwaySurfers-Linux 1.0** (`1.0.0` package metadata; underlying game build remains `1.94.0`).
- Migrated save persistence from Chromium IndexedDB (`~/.config/SubwaySurfersSanfrancisco`) to shared canonical host storage (`~/.local/share/SubwaySurfers-Linux/Save/`).
- Upgraded Electron wrapper to shared hardened `127.0.0.1` HTTP shell (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, strict CSP, outbound blocking).
- Standardized application name (`SubwaySurfers-SanFrancisco-Linux`) and corrected `SanFranciso` spelling everywhere.

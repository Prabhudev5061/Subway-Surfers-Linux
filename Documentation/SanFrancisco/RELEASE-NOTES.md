# Release Notes — `SubwaySurfers-SanFrancisco-Linux` (`1.94.0-unified1`)

- Consolidated into unified `SubwaySurfers-Linux` repository.
- Migrated save persistence from Chromium IndexedDB (`~/.config/SubwaySurfersSanfrancisco`) to shared canonical host storage (`~/.local/share/SubwaySurfers-Linux/Save/`).
- Upgraded Electron wrapper to shared hardened `127.0.0.1` HTTP shell (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, strict CSP, outbound blocking).
- Standardized application name (`SubwaySurfers-SanFrancisco-Linux`) and corrected `SanFranciso` spelling everywhere.
- Built portable AppImage, `.deb` package, and self-contained Bash installer bundle.

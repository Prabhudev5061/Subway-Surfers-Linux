# Architecture Overview — `SubwaySurfers-Linux 1.0`

## 1. High-Level Structure

All three versions share one Electron runtime shell, one input remapper, and one host-filesystem persistence layer while keeping version-specific Unity builds, icons, and packaging metadata separate:

```text
Source/
├── Shared/
│   ├── electron_shell.js       # 127.0.0.1 HTTP server, CSP, outbound blocking, window lifecycle
│   ├── preload_shared.js       # ContextBridge IPC (contextIsolation: true, sandbox: true)
│   ├── controls_wasd.js        # Unified WASD -> Arrow remapper + blur/visibility keyup cleanup
│   ├── host_idbfs_bridge.js    # Replaces Chromium IndexedDB /idbfs with host Save/ IPC
│   ├── autosave_manager.js     # FS.close/FS.rename hooks, 150ms debounce, shutdown flush
│   ├── shared_storage.js       # Atomic POSIX writes, SHA-1/UnityPrf validation, recovery/
│   ├── storage_lock.js         # Exclusive .storage.lock with /proc/<pid>/stat stale detection
│   ├── migration.js            # Safe first-launch legacy IndexedDB migration + conflict guard
│   ├── sha1_header.js          # 28-byte Kiloo BsonFileSaver SHA-1 validator/encoder
│   └── bson_adapter.py         # Lossless BSON parser/serializer for audits & verification
├── SanFrancisco/               # Unity 2019.4.18f1 (game v1.94.0), port 47322
├── Beijing/                    # Unity 2019.2.0f1 (Beijing_2 v1.94.0), port 47321, offline adblock
└── Zurich/                     # Unity 2019.4.18f1 (ZurichNewPrivacy v1.94.0), port 47323, offline adblock
```

## 2. WASD Controls Architecture (`Source/Shared/controls_wasd.js`)

All three Unity WebGL builds route browser keyboard events through Emscripten's `JSEvents.registerKeyEventCallback` inside `4399.js`:
- `SubwayControls.processKeyEvent(eventType, rawEvent)` intercepts events at the `JSEvents` boundary:
  - **WASD (`KeyW`, `KeyA`, `KeyS`, `KeyD`)**: Translated cleanly to `ArrowUp` (`38`), `ArrowLeft` (`37`), `ArrowDown` (`40`), and `ArrowRight` (`39`) on `keydown` and `keyup`, while suppressing `keypress` so stray `'w'/'a'/'s'/'d'` characters never leak into Unity text listeners.
  - **Physical Arrow keys (`ArrowUp`, `ArrowLeft`, `ArrowDown`, `ArrowRight`)**: Suppressed during gameplay so WASD is the primary movement scheme.
  - **Preserved Controls**: `Space` (`32`), `Escape` (`27`), `F11` (`122`), `Enter` (`13`), mouse/touch/gamepad events, modifier shortcuts (`Ctrl`/`Alt`/`Meta`), and text inputs (`<input>`, `<textarea>`, `<select>`, `contentEditable`) pass through untouched.
  - **Focus-Loss Safety**: `window.blur`, `document.visibilitychange` (`hidden`), and `window.pagehide` automatically synthesize `keyup` events via `JSEvents` for any held WASD keys and clear tracking state so movement never sticks.

## 3. Version-Specific Details

- **San Francisco:** [SanFrancisco/ARCHITECTURE.md](SanFrancisco/ARCHITECTURE.md)
- **Beijing:** [Beijing/ARCHITECTURE.md](Beijing/ARCHITECTURE.md)
- **Zurich:** [Zurich/ARCHITECTURE.md](Zurich/ARCHITECTURE.md)

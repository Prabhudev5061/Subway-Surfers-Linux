# KNOWN ISSUES & OPERATIONAL CONSIDERATIONS

**Application:** Subway Surfers Linux (World Tour: San Francisco 1.94.0) — Fixed Release  
**Version:** `1.94.0-autosave2-fixed`  

---

## 1. Known Operational Considerations

### AppArmor User Namespace Restrictions on Linux Kernels (Ubuntu 24.04+, Debian 12+)
- **Symptom:** Running the AppImage directly without `AppRun` on newer kernels may trigger:  
  `The setuid sandbox provides API for unprivileged user namespaces...`
- **Mitigation:** The provided `AppRun` launcher, `.deb` launcher `/usr/bin/subwaysurfers`, and `install.sh` automatically detect kernel AppArmor restrictions and append `--no-sandbox` seamlessly. No user action is required when using the standard launchers.

### Multiple Simultaneous Instances
- **Behavior:** Launching two instances of Subway Surfers concurrently sharing the same user profile (`~/.config/SubwaySurfersSanfrancisco`) is not recommended.
- **Explanation:** Chromium IndexedDB relies on LevelDB, which enforces process-exclusive file locks (`LOCK`). A second instance sharing the profile directory will fail to acquire the database lock.
- **Mitigation:** For multi-instance or local co-op testing, run secondary instances with `--user-data-dir=/tmp/subway_instance2`.

### First Boot Cold Start
- **Behavior:** First launch after installation decompresses WebAssembly bytecode and compiles shaders, taking 3–6 seconds. Subsequent launches initialize in under 2 seconds.

---

## 2. Unresolved / Upstream Game Limitations

### In-App Video Advertisements
- **Status:** Expected limitation of offline WebGL builds.
- **Details:** The original mobile game relied on live ad network SDKs to reward bonus keys/revives. In this standalone Linux desktop port, video ad fetches gracefully fail and return standard rewards without stalling gameplay.

### Online Multiplayer / Social Friends Leaderboards
- **Status:** Expected limitation of offline builds.
- **Details:** Facebook and Game Center friend synchronization APIs are offline. Local high scores and local leaderboard records are fully persisted.

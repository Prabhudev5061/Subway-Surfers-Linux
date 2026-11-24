# Security and Behavioral Static Analysis

## 1. Executive Summary

This document provides a defensive static security assessment of the **Subway Surfers AppImage**. The analysis inspects embedded launcher scripts, Electron configuration files, network endpoints, hardcoded strings, permission models, and potential behavioral risks.

**Key Findings:**
1. **Low Risk Application**: The core game is an offline-capable Unity WebGL export running inside an Electron wrapper.
2. **Predictable Symlink Flaw in `/tmp/`**: `AppRun` creates a global symlink at `/tmp/SubwaySurfers`, creating potential local denial-of-service or symlink collision risks on multi-user systems.
3. **Automated Sandbox Disabling**: `AppRun` downgrades Chromium security by appending `--no-sandbox` if AppArmor restricts unprivileged user namespaces.
4. **Dormant Web Telemetry Endpoints**: Legacy analytics, ad networks, and developer server URLs exist in the WebAssembly data and web scripts, but core assets are bundled locally and ad calls are shimmed.

---

## 2. Static Script & Launcher Audit

### 2.1 `AppRun` Startup Script Review

```bash
HERE="$(dirname "$(readlink -f "${0}")")"
restriction=$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns)
if [ "$restriction" = "1" ]; then
    sandbox="--no-sandbox"
fi
export appimage=true
check_symlink() {
    local path="$1"
    if [ -L "$path" ]; then
        rm "$path"
    fi
}
check_symlink "/tmp/SubwaySurfers"
ln -s "$HERE/html" /tmp/SubwaySurfers
"$HERE/SubwaySurfers" "$sandbox" "$@"
check_symlink "/tmp/SubwaySurfers"
```

#### Vulnerability Assessment: `/tmp/SubwaySurfers` Insecure Symlink Creation
- **Mechanism**: The script creates a static symlink at `/tmp/SubwaySurfers` pointing to the extracted `html` directory.
- **Risk Analysis**:
  - `/tmp` is a world-writable directory shared by all local users.
  - If a malicious local user pre-creates a directory or file named `/tmp/SubwaySurfers` before the victim launches the game, `ln -s` will fail, resulting in a local Denial of Service (DoS).
  - While `check_symlink` checks if the path is a symlink (`-L`), it leaves existing non-symlink directories or regular files untouched.
- **Recommendation**: Replace `/tmp/SubwaySurfers` with an isolated path inside the user's `$XDG_RUNTIME_DIR` (e.g., `/run/user/$UID/SubwaySurfers`) or reference the local directory directly via `path.join(__dirname, 'html')` inside Electron without symlinking.

#### Sandbox Disabling (`--no-sandbox`)
- **Mechanism**: If `/proc/sys/kernel/apparmor_restrict_unprivileged_userns` reads `1`, `--no-sandbox` is passed to Electron.
- **Risk Analysis**: Passing `--no-sandbox` disables Chromium's multi-process sandboxing barrier between the renderer process and the operating system. In this context, because the renderer loads local HTML and local WebAssembly rather than untrusted third-party websites, the exploit surface is minimal. However, it violates defense-in-depth principles.

---

### 2.2 Electron Process Configuration (`resources/app/main.js`)

```javascript
win = new BrowserWindow({
  autoHideMenuBar: true,
  width: 1080,
  height: 720,
  icon: path.join(__dirname, 'icon.png'),
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
  }
})
```

#### Security Properties:
- **`nodeIntegration`**: Defaults to `false` in Electron 36.5.0.
- **`contextIsolation`**: Defaults to `true` in Electron 36.5.0.
- **`sandbox`**: Not explicitly enabled in `webPreferences`, but governed by Electron defaults.
- **Preload Script**: `resources/app/preload.js` contains commented-out boilerplate and no privileged bridge methods exposed via `contextBridge`.
- **Verdict**: The Electron configuration adheres to modern security defaults, preventing the renderer process from having arbitrary Node.js filesystem or shell execution access.

---

## 3. Network and Hardcoded Endpoint Analysis

### 3.1 Hardcoded URL Classification

A total of 52 URLs and network endpoints were identified in `global-metadata.dat` and web scripts. They fall into distinct functional groups:

#### Category A: Game Developer & Studio Infrastructure
- `http://build.sybogames.local:8080` (Internal SYBO CI/CD server)
- `http://docker.sybogames.local:11000/sybot/analytics-check` (Internal Docker analytics testing bot)
- `https://subwaysurf.dev.bladesofbrim.com` (SYBO development endpoint)
- `https://subwaysurf.prod.bladesofbrim.com` (SYBO production endpoint)

#### Category B: Kiloo Backend Services (Legacy)
- `https://subwaysurfers.kiloo-games.com/api/v3` (Game API v3)
- `https://cloudsave2-subwaysurfers.kiloo-games.com/` (Cloud save synchronization)
- `https://onlinesettings.kiloo-games.com/` (Remote game balance settings)
- `https://auth.kiloo-games.com/` (Authentication service)
- `https://purchasevalidation.kiloo-games.com/` (In-app purchase validation)
- `http://logger.kiloo-games.com/` (Crash/event logger)
- `http://hoodrunner.kiloo.com/hr_dailyquests2.php` (Daily quests backend)
- `http://subway.azureedge.net/subway/` (Azure CDN for game assets)

#### Category C: Google Apps Script Endpoints
- `https://script.google.com/macros/s/AKfycbz2lBaGXHu05CgN1mXAr217sresz20BwK_3YwuHO2sHx_eJu5g/exec`
- `https://script.google.com/macros/s/AKfycbzysbyZuNXvOTJh5llqjN4N2dP4PAXusuwfaHjvTD3ESkx5Sas/exec`
*(Commonly used in web game distributions for telemetry logging, high-score tracking, or analytics aggregation).*

#### Category D: Web Ad & Portal Integrations
- `https://game-cdn.poki.com/loaders/v2/unity/static/UnityLoader.js`
- `https://prebid.adnxs.com/pbc/v1/cache`
- `https://securepubads.g.doubleclick.net/...`
- `https://t.poki.io/ge`

### 3.2 Offline Independence Verification
- **Confirmed Fact**: All required game engine assets (`SanFrancisco.data.unityweb`, `SanFrancisco.wasm.code.unityweb`, `SanFrancisco.wasm.framework.unityweb`, `UnityLoader.2019.2.js`) are bundled locally within `html/Build/`.
- **Confirmed Fact**: In `master-loader.js`, remote loader resolution is explicitly overridden:
  `window.config.unityWebglLoaderUrl = "./UnityLoader.2019.2.js"`.
- **Confirmed Fact**: `html/prebid4.12.0.js` is 0 bytes, neutralizing ad bidding.
- **Confirmed Fact**: `html/poki-sdk.js` implements auto-resolving promises for rewarded and commercial ad breaks (`handleAutoResolvePromise`, `rewardedBreak` returns `Promise.resolve(false)`).
- **Hypothesis / Requires Dynamic Verification**: Whether the game attempts outbound HTTP calls to Google Apps Script or Kiloo APIs if network access is present.

---

## 4. File and Permission Security

### 4.1 Setuid Binary (`chrome-sandbox`)
- Extracted permission: `-rwxr-xr-x` (mode `0755`, owned by user).
- It is **not** setuid root (`4755`).
- In environments where user namespaces are restricted, Chromium requires a root-owned SUID sandbox binary. Because SUID is not configured, `AppRun` relies on `--no-sandbox` as a fallback.

### 4.2 User Data and Local Storage
- Local data is stored inside the standard user profile directory:
  `~/.config/SubwaySurfersSanfrancisco/`
- No evidence of writes to host system directories (`/etc`, `/usr`, `/boot`, `/var`) was detected.
- The only directory modified outside the user home is `/tmp/SubwaySurfers`.

---

## 5. Proposed Dynamic Analysis Test Plan

If dynamic testing is conducted in the future, the following isolation guidelines are recommended:

1. **Network Isolation**: Execute within an isolated Linux network namespace with no default gateway or internet connectivity:
   ```bash
   ip netns add isolated_test
   ip netns exec isolated_test ./SubwaySurfers-x86-64.AppImage
   ```
2. **Filesystem Monitoring**: Monitor filesystem events using `strace` or `btrace` to verify all open, read, and write operations:
   ```bash
   strace -f -e trace=file -o trace_output.log ./SubwaySurfers-x86-64.AppImage
   ```
3. **Network Sniffing**: If testing network activity in a controlled environment, route traffic through a local proxy (e.g., `mitmproxy`) to inspect any attempted outbound HTTP/HTTPS requests.

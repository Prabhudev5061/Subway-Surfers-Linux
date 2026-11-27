/**
 * Unified Hardened Electron Shell for SubwaySurfers-Linux
 *
 * Shared by both SubwaySurfers-SanFrancisco-Linux and SubwaySurfers-Beijing-Linux.
 * Provides:
 * - Exclusive shared save lock (~/.local/share/SubwaySurfers-Linux/Save/.storage.lock)
 * - First-launch legacy save migration with conflict protection
 * - Direct host-filesystem save IPC (shared_storage.js)
 * - Embedded 127.0.0.1 HTTP server with path traversal protection
 * - Strict CSP, sandbox: true, contextIsolation: true, nodeIntegration: false
 * - Outbound network blocking & navigation blocking
 * - Automatic fullscreen startup, persistent window_state.json, F11 toggle, Escape preserved
 * - Clean graceful close save flush without ERR_STREAM_WRITE_AFTER_END
 */
const { app, BrowserWindow, dialog, ipcMain, nativeImage, session } = require('electron');
const crypto = require('crypto');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const { getCanonicalRootDir, getCanonicalSaveDir, loadAllSaves, commitSaves } = require('./shared_storage');
const { acquireStorageLock } = require('./storage_lock');
const { performFirstLaunchMigration } = require('./migration');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm',
    '.unityweb': 'application/octet-stream',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff'
};

function parseArgValue(prefix) {
    const found = process.argv.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : null;
}

/**
 * Internal helper mode used ONLY during first-launch migration to safely extract
 * /idbfs entries from a temporary copy of a legacy Chromium IndexedDB profile.
 */
async function runInternalLegacyExtractor() {
    const originUrl = parseArgValue('--extract-origin=');
    const outJson = parseArgValue('--extract-out=');
    if (!originUrl || !outJson) {
        process.exit(1);
    }

    await app.whenReady();
    let srv = null;
    let loadTarget = originUrl;
    if (originUrl.startsWith('http://127.0.0.1:')) {
        const port = Number(new URL(originUrl).port || 47321);
        srv = http.createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<!doctype html><html><body>extract</body></html>');
        });
        await new Promise((resolve) => srv.listen(port, '127.0.0.1', resolve));
        loadTarget = `${originUrl}/index.html`;
    } else {
        const tmpHtml = path.join(path.dirname(outJson), '_extract.html');
        fs.writeFileSync(tmpHtml, '<!doctype html><html><body>extract</body></html>');
        loadTarget = `file://${tmpHtml}`;
    }

    const win = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    });
    await win.loadURL(loadTarget);
    const entries = await win.webContents.executeJavaScript(`
        new Promise((resolve) => {
            try {
                const req = indexedDB.open('/idbfs', 21);
                req.onerror = () => resolve([]);
                req.onsuccess = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains('FILE_DATA')) return resolve([]);
                    const tx = db.transaction(['FILE_DATA'], 'readonly');
                    const store = tx.objectStore('FILE_DATA');
                    const out = [];
                    store.openCursor().onsuccess = (ev) => {
                        const cursor = ev.target.result;
                        if (!cursor) return resolve(out);
                        const val = cursor.value;
                        let b64 = null;
                        if (val && val.contents) {
                            const u8 = new Uint8Array(val.contents);
                            let bin = '';
                            for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
                            b64 = btoa(bin);
                        }
                        out.push({
                            key: String(cursor.primaryKey),
                            timestamp: val && val.timestamp ? new Date(val.timestamp).toISOString() : null,
                            b64
                        });
                        cursor.continue();
                    };
                };
            } catch (e) { resolve([]); }
        })
    `);
    fs.writeFileSync(outJson, JSON.stringify(entries), 'utf8');
    if (srv) srv.close();
    app.quit();
}

function createLegacyExtractorFn(appEntryPath) {
    return async (profileInfo) => {
        const tmpRoot = fs.mkdtempSync(path.join(require('os').tmpdir(), 'subway-legacy-extract-'));
        const tmpProf = path.join(tmpRoot, 'prof');
        const outJson = path.join(tmpRoot, 'extracted.json');
        try {
            fs.mkdirSync(path.join(tmpProf, 'IndexedDB'), { recursive: true });
            const srcIdb = path.join(profileInfo.profileDir, 'IndexedDB');
            fs.cpSync(srcIdb, path.join(tmpProf, 'IndexedDB'), { recursive: true });
            // Remove LOCK on temporary copy only
            const idbSub = path.join(tmpProf, 'IndexedDB', path.basename(profileInfo.indexedDbDir));
            const lockCopy = path.join(idbSub, 'LOCK');
            if (fs.existsSync(lockCopy)) fs.unlinkSync(lockCopy);

            await new Promise((resolve, reject) => {
                const args = [];
                if (appEntryPath && process.execPath.endsWith('electron')) {
                    args.push(appEntryPath);
                }
                args.push(
                    '--no-sandbox',
                    '--internal-extract-legacy-idbfs',
                    `--user-data-dir=${tmpProf}`,
                    `--extract-origin=${profileInfo.originUrl}`,
                    `--extract-out=${outJson}`
                );
                const child = spawn(process.execPath, args, { stdio: 'ignore' });
                const timer = setTimeout(() => {
                    try { child.kill('SIGKILL'); } catch (e) {}
                    reject(new Error('Legacy extractor timed out'));
                }, 15000);
                child.once('exit', (code) => {
                    clearTimeout(timer);
                    if (code === 0 && fs.existsSync(outJson)) resolve();
                    else reject(new Error(`Legacy extractor exited with code ${code}`));
                });
            });

            const parsed = JSON.parse(fs.readFileSync(outJson, 'utf8'));
            return parsed
                .filter((e) => e.b64)
                .map((e) => ({
                    key: e.key,
                    timestamp: e.timestamp,
                    data: Buffer.from(e.b64, 'base64')
                }));
        } finally {
            fs.rmSync(tmpRoot, { recursive: true, force: true });
        }
    };
}

function launchUnifiedGame(config) {
    if (process.argv.includes('--internal-extract-legacy-idbfs')) {
        runInternalLegacyExtractor().catch(() => process.exit(1));
        return;
    }

    const {
        appId,              // 'SubwaySurfers-SanFrancisco-Linux' or 'SubwaySurfers-Beijing-Linux'
        versionSlug,        // 'sanfrancisco' or 'beijing'
        windowTitle,        // 'Subway Surfers' or 'Subway Surfers: Beijing'
        webRoot,
        sharedRoot,
        iconPath,
        preferredPort = 47321,
        backgroundColor = '#231F20',
        preloadPath = path.join(__dirname, 'preload_shared.js'),
        appEntryPath = null
    } = config;

    app.setName(appId);

    const hasUserDataFlag = process.argv.some((a) => a.startsWith('--user-data-dir'));
    if (!hasUserDataFlag) {
        const configHome = process.env.XDG_CONFIG_HOME || path.join(app.getPath('home'), '.config');
        app.setPath('userData', path.join(configHome, 'SubwaySurfers-Linux', versionSlug));
    }

    let win = null;
    let localServer = null;
    let boundPort = 0;
    let isQuitting = false;
    let savePending = false;
    let closeTimeout = null;
    let logFileStream = null;
    let storageLock = null;
    let lastSaveCompleted = null;

    const saveDir = getCanonicalSaveDir();
    const sharedRootDir = getCanonicalRootDir();

    function getWindowStatePath() {
        return path.join(app.getPath('userData'), 'window_state.json');
    }

    function loadWindowState() {
        if (process.argv.includes('--windowed')) {
            return { fullscreen: false };
        }
        try {
            const raw = fs.readFileSync(getWindowStatePath(), 'utf8');
            const parsed = JSON.parse(raw);
            if (typeof parsed.fullscreen === 'boolean') {
                return { fullscreen: parsed.fullscreen };
            }
        } catch (e) {}
        return { fullscreen: true };
    }

    function saveWindowState(isFullScreen) {
        try {
            const statePath = getWindowStatePath();
            fs.mkdirSync(path.dirname(statePath), { recursive: true });
            fs.writeFileSync(statePath, JSON.stringify({ fullscreen: Boolean(isFullScreen) }, null, 2) + '\n', 'utf8');
        } catch (e) {}
    }

    function initLogging() {
        try {
            const stateHome = process.env.XDG_STATE_HOME || path.join(app.getPath('home'), '.local', 'state');
            const logDir = path.join(stateHome, 'SubwaySurfers-Linux', versionSlug);
            fs.mkdirSync(logDir, { recursive: true });
            logFileStream = fs.createWriteStream(path.join(logDir, 'runtime.log'), { flags: 'a' });
            logFileStream.on('error', () => { logFileStream = null; });
        } catch (e) {}
    }

    function logDiag(level, msg) {
        const line = `[${new Date().toISOString()}] [${appId}] [${level}] ${msg}`;
        if (level === 'ERROR') console.error(line);
        else console.log(line);
        if (logFileStream && !logFileStream.writableEnded && !logFileStream.destroyed) {
            try { logFileStream.write(line + '\n'); } catch (e) {}
        }
    }

    function closeLogStream() {
        if (!logFileStream) return;
        const stream = logFileStream;
        logFileStream = null;
        try {
            if (!stream.writableEnded && !stream.destroyed) stream.end();
        } catch (e) {}
    }

    function releaseLockSafe() {
        if (storageLock && typeof storageLock.release === 'function') {
            try {
                if (storageLock.release()) {
                    logDiag('INFO', `Released shared storage lock: ${storageLock.lockPath}`);
                }
            } catch (e) {}
        }
    }

    function startLocalHttpServer() {
        const resolvedWebRoot = path.resolve(webRoot);
        const resolvedSharedRoot = path.resolve(sharedRoot);
        const allowedSharedFiles = new Set([
            '/shared/sha1_header.js',
            '/shared/host_idbfs_bridge.js',
            '/shared/autosave_manager.js'
        ]);

        const handler = (req, res) => {
            const rawUrl = (req.url || '/').split('?')[0];
            let decodedPath = '/';
            try {
                decodedPath = decodeURIComponent(rawUrl === '/' ? '/index.html' : rawUrl);
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('400 Bad Request');
                return;
            }

            let targetFile = null;
            if (allowedSharedFiles.has(decodedPath)) {
                targetFile = path.join(resolvedSharedRoot, path.basename(decodedPath));
            } else {
                const candidate = path.resolve(resolvedWebRoot, '.' + decodedPath);
                if (candidate.startsWith(resolvedWebRoot + path.sep) || candidate === path.join(resolvedWebRoot, 'index.html')) {
                    targetFile = candidate;
                }
            }

            const stat = (targetFile && fs.existsSync(targetFile)) ? fs.statSync(targetFile) : null;
            if (!targetFile || !stat || !stat.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
                res.end('404 Not Found');
                return;
            }

            const ext = path.extname(targetFile).toLowerCase();
            res.writeHead(200, {
                'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
                'Content-Length': String(stat.size),
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff'
            });
            fs.createReadStream(targetFile).pipe(res);
        };

        return new Promise((resolve, reject) => {
            const srv = http.createServer(handler);
            srv.on('error', (err) => {
                if (err.code === 'EADDRINUSE' && preferredPort !== 0) {
                    const fallback = http.createServer(handler);
                    fallback.on('error', reject);
                    fallback.listen(0, '127.0.0.1', () => {
                        localServer = fallback;
                        boundPort = fallback.address().port;
                        resolve(boundPort);
                    });
                } else {
                    reject(err);
                }
            });
            srv.listen(preferredPort, '127.0.0.1', () => {
                localServer = srv;
                boundPort = srv.address().port;
                resolve(boundPort);
            });
        });
    }

    function stopLocalHttpServer() {
        if (!localServer) return;
        try {
            if (typeof localServer.closeAllConnections === 'function') {
                localServer.closeAllConnections();
            }
            localServer.close();
        } catch (e) {}
        localServer = null;
    }

    function applySecurityPolicies(ses, localOrigin) {
        const cspValue = [
            "default-src 'self'",
            "script-src 'self' 'wasm-unsafe-eval' blob:",
            "worker-src 'self' blob:",
            "connect-src 'self' blob: data:",
            "img-src 'self' data: blob:",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data:",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "base-uri 'self'"
        ].join('; ');

        ses.webRequest.onHeadersReceived((details, callback) => {
            const headers = Object.assign({}, details.responseHeaders || {}, {
                'Content-Security-Policy': [cspValue],
                'X-Content-Type-Options': ['nosniff']
            });
            callback({ responseHeaders: headers });
        });

        ses.webRequest.onBeforeRequest((details, callback) => {
            const url = details.url || '';
            const allowed = (
                url.startsWith(localOrigin + '/') ||
                url === localOrigin ||
                url.startsWith('blob:') ||
                url.startsWith('data:') ||
                url.startsWith('devtools://')
            );
            if (!allowed) {
                logDiag('WARN', `Blocked outbound network request: ${url}`);
            }
            callback({ cancel: !allowed });
        });

        ses.setPermissionRequestHandler((_wc, _perm, callback) => callback(false));
        if (typeof ses.setDevicePermissionHandler === 'function') {
            ses.setDevicePermissionHandler(() => false);
        }
    }

    function initiateCloseFlush() {
        if (isQuitting) return;
        isQuitting = true;
        logDiag('INFO', 'Window close intercepted; flushing shared save...');
        try {
            if (win && !win.isDestroyed()) {
                win.webContents.send('force-save-before-exit');
            }
        } catch (err) {
            logDiag('ERROR', `Error sending force-save-before-exit: ${err.message}`);
        }
        closeTimeout = setTimeout(() => {
            logDiag('WARN', 'Save flush timeout reached (2500ms); destroying window.');
            if (win && !win.isDestroyed()) win.destroy();
        }, 2500);
    }

    let lastFullscreenToggleAt = 0;
    function toggleWindowFullscreen() {
        const now = Date.now();
        if (now - lastFullscreenToggleAt < 80) return;
        lastFullscreenToggleAt = now;
        if (win && !win.isDestroyed()) {
            win.setFullScreen(!win.isFullScreen());
        }
    }

    function createWindow(port) {
        const localOrigin = `http://127.0.0.1:${port}`;
        const entryUrl = `${localOrigin}/index.html`;
        const initialState = loadWindowState();

        logDiag('INFO', `Booting ${appId} from ${entryUrl} (sharedSave=${saveDir}, fullscreen=${initialState.fullscreen})`);

        let windowIcon = iconPath;
        try {
            if (iconPath && fs.existsSync(iconPath)) {
                const img = nativeImage.createFromPath(iconPath);
                if (!img.isEmpty()) {
                    const sz = img.getSize();
                    windowIcon = (sz.width > 256 || sz.height > 256) ? img.resize({ width: 256, height: 256 }) : img;
                }
            }
        } catch (e) {}

        win = new BrowserWindow({
            width: 1080,
            height: 720,
            minWidth: 640,
            minHeight: 480,
            show: false,
            fullscreen: initialState.fullscreen,
            fullscreenable: true,
            autoHideMenuBar: true,
            backgroundColor,
            title: windowTitle,
            icon: windowIcon,
            webPreferences: {
                preload: preloadPath,
                contextIsolation: true,
                nodeIntegration: false,
                nodeIntegrationInWorker: false,
                sandbox: true,
                webSecurity: true,
                allowRunningInsecureContent: false
            }
        });

        win.setMenuBarVisibility(false);

        win.once('ready-to-show', () => {
            if (!win || win.isDestroyed()) return;
            if (initialState.fullscreen && !win.isFullScreen()) {
                win.setFullScreen(true);
            }
            win.show();
            win.focus();
            win.webContents.focus();
            win.webContents.send('fullscreen-changed', win.isFullScreen());
        });

        win.on('enter-full-screen', () => {
            win.setMenuBarVisibility(false);
            saveWindowState(true);
            if (win && !win.isDestroyed()) {
                win.webContents.send('fullscreen-changed', true);
                win.webContents.focus();
                win.webContents.executeJavaScript("window.dispatchEvent(new Event('resize'));", true).catch(() => {});
            }
        });

        win.on('leave-full-screen', () => {
            saveWindowState(false);
            if (win && !win.isDestroyed()) {
                win.webContents.send('fullscreen-changed', false);
                win.webContents.focus();
                win.webContents.executeJavaScript("window.dispatchEvent(new Event('resize'));", true).catch(() => {});
            }
        });

        win.webContents.setWindowOpenHandler(({ url }) => {
            logDiag('WARN', `Blocked window.open: ${url}`);
            return { action: 'deny' };
        });

        win.webContents.on('will-navigate', (event, targetUrl) => {
            if (!targetUrl.startsWith(localOrigin + '/')) {
                logDiag('WARN', `Blocked external navigation: ${targetUrl}`);
                event.preventDefault();
            }
        });

        win.webContents.on('before-input-event', (event, input) => {
            if (input.type === 'keyDown' && input.key === 'F11' && !input.isAutoRepeat) {
                toggleWindowFullscreen();
                event.preventDefault();
            }
        });

        win.webContents.on('did-fail-load', (_e, code, desc, url) => {
            logDiag('ERROR', `Renderer did-fail-load ${code}: ${desc} (${url})`);
        });

        win.webContents.on('console-message', (_e, level, msg, line, src) => {
            logDiag('RENDERER', `[L${level}] ${msg} (${src}:${line})`);
        });

        win.loadURL(entryUrl);

        win.on('close', (e) => {
            if (win && !win.isDestroyed()) {
                saveWindowState(win.isFullScreen());
            }
            if (isQuitting) return;
            e.preventDefault();
            initiateCloseFlush();
        });
    }

    ipcMain.handle('shared-save:load', () => {
        const localOrigin = `http://127.0.0.1:${boundPort}`;
        const originHash = crypto.createHash('md5').update(localOrigin).digest('hex');
        const loaded = loadAllSaves(saveDir);
        if (loaded.recovered.length > 0) {
            logDiag('WARN', `Recovered corrupted save(s) on load: ${JSON.stringify(loaded.recovered)}`);
        }
        if (loaded.rejectedBackups.length > 0) {
            logDiag('WARN', `Rejected corrupted backup(s): ${JSON.stringify(loaded.rejectedBackups)}`);
        }
        const filesOut = {};
        for (const [k, buf] of Object.entries(loaded.files)) {
            filesOut[k] = new Uint8Array(buf);
        }
        return {
            originHash,
            saveDir,
            files: filesOut,
            mtimes: loaded.mtimes,
            recovered: loaded.recovered
        };
    });

    ipcMain.handle('shared-save:commit', (_event, entries) => {
        const result = commitSaves(entries, saveDir);
        if (result.committed.length > 0) {
            logDiag('INFO', `Committed shared save files: ${result.committed.map((c) => `${c.diskRel}(${c.size}B)`).join(', ')}`);
        }
        if (result.rejected.length > 0) {
            logDiag('WARN', `Rejected invalid save writes: ${JSON.stringify(result.rejected)}`);
        }
        return result;
    });

    ipcMain.handle('shared-save:info', () => ({
        appId,
        versionSlug,
        saveDir,
        userDataPath: app.getPath('userData'),
        localOrigin: boundPort ? `http://127.0.0.1:${boundPort}` : null
    }));

    ipcMain.on('toggle-fullscreen', () => toggleWindowFullscreen());

    ipcMain.on('request-close', () => {
        if (win && !win.isDestroyed()) win.close();
        else app.quit();
    });

    ipcMain.on('save-status', (_e, status) => {
        savePending = Boolean(status && (status.syncing || status.dirty));
    });

    ipcMain.on('save-completed', (_e, info) => {
        savePending = false;
        lastSaveCompleted = info || { timestamp: Date.now() };
        logDiag('INFO', `Save completed: reason=${info && info.reason} seq=${info && info.sequenceId} ms=${info && info.durationMs}`);
    });

    ipcMain.on('save-flushed', () => {
        savePending = false;
        logDiag('INFO', 'Save queue drained.');
        if (isQuitting) {
            if (closeTimeout) clearTimeout(closeTimeout);
            if (win && !win.isDestroyed()) win.destroy();
        }
    });

    ipcMain.handle('get-window-state', () => ({
        isFullScreen: win && !win.isDestroyed() ? win.isFullScreen() : false,
        persisted: loadWindowState()
    }));

    app.whenReady().then(async () => {
        initLogging();

        // 1. Acquire exclusive shared storage lock BEFORE migration or launching Unity
        storageLock = acquireStorageLock(saveDir, { appName: appId, version: versionSlug });
        if (!storageLock.acquired) {
            logDiag('ERROR', storageLock.message);
            if (!process.env.SUBWAY_NO_LOCK_DIALOG) {
                try {
                    dialog.showErrorBox(`${appId} — Save Storage Locked`, storageLock.message);
                } catch (e) {}
            }
            closeLogStream();
            app.exit(2);
            return;
        }
        logDiag('INFO', `Acquired shared storage lock (PID ${process.pid}): ${storageLock.lockPath}`);

        // 2. First-launch legacy save migration check
        try {
            const explicitSource = parseArgValue('--migrate-source=');
            const migResult = await performFirstLaunchMigration({
                extractLegacyProfileFn: createLegacyExtractorFn(appEntryPath),
                saveDir,
                rootDir: sharedRootDir,
                explicitSource
            });
            logDiag('INFO', `Migration check status: ${migResult.status}`);
            if (migResult.status === 'conflict') {
                const msg =
                    `Existing saves were detected in both legacy San Francisco and Beijing profiles.\n\n` +
                    `To prevent losing progress, automatic migration was stopped and backups were saved.\n` +
                    `Launch with --migrate-source=sanfrancisco or --migrate-source=beijing to select one.`;
                logDiag('ERROR', msg);
                if (!process.env.SUBWAY_NO_LOCK_DIALOG) {
                    try { dialog.showErrorBox(`${appId} — Save Migration Conflict`, msg); } catch (e) {}
                }
                releaseLockSafe();
                closeLogStream();
                app.exit(3);
                return;
            }
        } catch (migErr) {
            logDiag('ERROR', `Migration check failed: ${migErr.message}`);
            releaseLockSafe();
            closeLogStream();
            app.exit(4);
            return;
        }

        // 3. Start embedded 127.0.0.1 HTTP server & launch game window
        const port = await startLocalHttpServer();
        applySecurityPolicies(session.defaultSession, `http://127.0.0.1:${port}`);
        createWindow(port);

        const triggerGracefulClose = (sig) => {
            logDiag('INFO', `Received ${sig}; initiating graceful close...`);
            if (win && !win.isDestroyed()) win.close();
            else {
                releaseLockSafe();
                app.quit();
            }
        };
        process.on('SIGTERM', () => triggerGracefulClose('SIGTERM'));
        process.on('SIGINT', () => triggerGracefulClose('SIGINT'));

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow(port);
        });
    });

    app.on('before-quit', (e) => {
        if (!isQuitting && win && !win.isDestroyed()) {
            e.preventDefault();
            initiateCloseFlush();
        }
    });

    app.on('window-all-closed', () => {
        stopLocalHttpServer();
        releaseLockSafe();
        closeLogStream();
        if (process.platform !== 'darwin') app.quit();
    });

    app.on('will-quit', () => {
        releaseLockSafe();
        closeLogStream();
    });
}

module.exports = { launchUnifiedGame, MIME_TYPES };

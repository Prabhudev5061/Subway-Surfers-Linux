/**
 * Live End-to-End Integration, Cross-Version Switching, Locking, Crash Recovery & UI Tests
 *
 * Tests the FINAL built AppImages:
 *   - App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage
 *   - App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../..');
const SF_APPIMAGE = path.join(REPO_ROOT, 'App images', 'SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage');
const BJ_APPIMAGE = path.join(REPO_ROOT, 'App images', 'SubwaySurfers-Beijing-Linux-x86_64.AppImage');
const FIXTURES_DIR = path.join(REPO_ROOT, 'Tests', 'fixtures');
const { wrapWithSha1Header, verifyHeaderAndSha1 } = require(path.join(REPO_ROOT, 'Source', 'Shared', 'sha1_header.js'));

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function httpGetJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function waitForCdp(port) {
    for (let i = 0; i < 60; i++) {
        await delay(250);
        try {
            const targets = await httpGetJson(`http://127.0.0.1:${port}/json`);
            const page = targets.find((t) => t.type === 'page');
            if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
        } catch (e) {}
    }
    throw new Error(`Timed out waiting for CDP on port ${port}`);
}

class CDP {
    constructor(wsUrl) {
        this.ws = new WebSocket(wsUrl);
        this.id = 1;
        this.handlers = new Map();
        this.ws.onmessage = (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.handlers.has(msg.id)) {
                const cb = this.handlers.get(msg.id);
                this.handlers.delete(msg.id);
                cb(msg);
            }
        };
    }
    ready() {
        return new Promise((resolve, reject) => {
            this.ws.onopen = resolve;
            this.ws.onerror = (e) => reject(new Error('CDP WebSocket error: ' + (e.message || e.type || 'unknown')));
            this.ws.onclose = () => reject(new Error('CDP WebSocket closed before open'));
        });
    }
    call(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.id++;
            this.handlers.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }
    async eval(expr) {
        const res = await this.call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (res.exceptionDetails) {
            throw new Error(res.exceptionDetails.text || JSON.stringify(res.exceptionDetails));
        }
        return res.result ? res.result.value : undefined;
    }
    close() { try { this.ws.close(); } catch (e) {} }
}

function makeSandboxEnv(homeDir) {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    env.HOME = homeDir;
    env.XDG_DATA_HOME = path.join(homeDir, '.local', 'share');
    env.XDG_CONFIG_HOME = path.join(homeDir, '.config');
    env.XDG_STATE_HOME = path.join(homeDir, '.local', 'state');
    env.SUBWAY_NO_LOCK_DIALOG = '1';
    return env;
}

function launchApp(appImage, env, port, extraArgs = []) {
    const proc = spawn(appImage, [
        '--no-sandbox',
        `--remote-debugging-port=${port}`,
        '--remote-allow-origins=*',
        ...extraArgs
    ], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = '';
    proc.stdout.on('data', (d) => { logs += d.toString(); });
    proc.stderr.on('data', (d) => { logs += d.toString(); });
    return { proc, getLogs: () => logs };
}

function stopGracefully(proc, timeoutMs = 10000) {
    return new Promise((resolve) => {
        if (!proc || proc.exitCode !== null) return resolve(proc ? proc.exitCode : 0);
        const timer = setTimeout(() => {
            try { proc.kill('SIGKILL'); } catch (e) {}
            resolve(-1);
        }, timeoutMs);
        proc.once('exit', (code) => {
            clearTimeout(timer);
            resolve(code);
        });
        try { proc.kill('SIGTERM'); } catch (e) {}
    });
}

async function waitForUnityReady(cdp) {
    for (let i = 0; i < 60; i++) {
        await delay(500);
        const state = await cdp.eval(`(async () => {
            const canvas = document.querySelector('canvas');
            const fsObj = window.FS;
            const hashes = fsObj && window.AutoSaveManager ? window.AutoSaveManager.listHashDirectories(fsObj) : [];
            const hasCloud = hashes.length > 0 && fsObj.analyzePath('/idbfs/' + hashes[0] + '/Save/cloud').exists;
            if (!canvas || canvas.width === 0 || !hasCloud) return { waiting: true };
            const info = window.subwayIPC ? await window.subwayIPC.getStorageInfo() : null;
            const winState = window.subwayIPC ? await window.subwayIPC.getWindowState() : null;
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            const dbg = gl ? gl.getExtension('WEBGL_debug_renderer_info') : null;
            const gpuRenderer = gl ? (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'none';
            const webglVer = gl ? gl.getParameter(gl.VERSION) : 'none';

            let externalBlocked = false;
            try { await fetch('https://example.com/'); } catch (e) { externalBlocked = true; }

            return {
                waiting: false,
                origin: window.location.origin,
                hash: hashes[0],
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                clientWidth: canvas.clientWidth,
                clientHeight: canvas.clientHeight,
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                hasToolbar: Boolean(document.getElementById('toolbar')),
                hasDiagDrawer: Boolean(document.getElementById('diagnostics-drawer')),
                extraButtons: document.querySelectorAll('button:not(#btn-retry-boot)').length,
                nodeExposed: (typeof require !== 'undefined') || (typeof process !== 'undefined'),
                externalBlocked,
                info,
                winState,
                webglVer,
                gpuRenderer
            };
        })()`);
        if (state && !state.waiting) return state;
    }
    throw new Error('Timed out waiting for Unity WebGL canvas and Save/cloud');
}

function mutateBsonCoinCountViaPython(saveCloudPath, newCoins, newHighScore) {
    const pyScript = `
import sys
from pathlib import Path
sys.path.insert(0, ${JSON.stringify(path.join(REPO_ROOT, 'Source', 'Shared'))})
import bson_adapter
p = Path(${JSON.stringify(saveCloudPath)})
doc, _ = bson_adapter.unwrap_and_validate_save(p.read_bytes())
doc["obfuscatedCoins"] = bson_adapter.BsonValue(bson_adapter.BSON_INT32, ${newCoins})
doc["highScore"] = bson_adapter.BsonValue(bson_adapter.BSON_INT32, ${newHighScore})
out, sha = bson_adapter.wrap_save(doc)
print(out.hex())
`;
    const hex = execSync('python3 -', { input: pyScript, encoding: 'utf8' }).trim();
    return Buffer.from(hex, 'hex');
}

function readBsonStatsViaPython(saveCloudPath) {
    return readBsonStatsFromBuffer(fs.readFileSync(saveCloudPath));
}

function readBsonStatsFromBuffer(buf) {
    const pyScript = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(REPO_ROOT, 'Source', 'Shared'))})
import bson_adapter
raw = bytes.fromhex(${JSON.stringify(buf.toString('hex'))})
doc, sha = bson_adapter.unwrap_and_validate_save(raw)
print(json.dumps({
    "sha1": sha,
    "coins": doc["obfuscatedCoins"].value,
    "highScore": doc["highScore"].value,
    "keys": len(doc)
}))
`;
    return JSON.parse(execSync('python3 -', { input: pyScript, encoding: 'utf8' }).trim());
}

async function run() {
    console.log('[Integration Tests] Starting comprehensive cross-version, locking, UI & recovery suite...');
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'subway-e2e-home-'));
    const env = makeSandboxEnv(tmpHome);
    const sharedSaveDir = path.join(tmpHome, '.local', 'share', 'SubwaySurfers-Linux', 'Save');
    const legacyConfigNames = ['SubwaySurfersSanfrancisco', 'SubwaySurfersBeijing', 'SubwaySurfersBeijing2'];

    try {
        // =========================================================================
        // PART 1: Launch San Francisco, verify UI/Security/Fullscreen/WebGL, mutate save, test lock
        // =========================================================================
        console.log('[1/6] Launching San Francisco (fullscreen startup)...');
        const sf1 = launchApp(SF_APPIMAGE, env, 9261);
        const wsSf1 = await waitForCdp(9261);
        const cdpSf1 = new CDP(wsSf1);
        await cdpSf1.ready();
        const sfState1 = await waitForUnityReady(cdpSf1);

        assert.strictEqual(sfState1.hasToolbar, false, 'SF must have no developer toolbar');
        assert.strictEqual(sfState1.hasDiagDrawer, false, 'SF must have no diagnostics drawer');
        assert.strictEqual(sfState1.extraButtons, 0, 'SF must have zero extra overlay buttons');
        assert.strictEqual(sfState1.nodeExposed, false, 'nodeIntegration must be false');
        assert.strictEqual(sfState1.externalBlocked, true, 'External URL requests must be blocked');
        assert.strictEqual(sfState1.info.saveDir, sharedSaveDir, 'SF must resolve to canonical Save dir');
        assert.strictEqual(sfState1.winState.isFullScreen, true, 'SF must launch in fullscreen by default');
        assert(sfState1.canvasWidth > 0 && sfState1.canvasHeight > 0, 'SF canvas must render');

        // Test F11 fullscreen toggle & Escape preservation
        await cdpSf1.eval(`window.subwayIPC.toggleFullscreen()`);
        await delay(400);
        const afterToggle = await cdpSf1.eval(`window.subwayIPC.getWindowState()`);
        assert.strictEqual(afterToggle.isFullScreen, false, 'toggleFullscreen must switch out of fullscreen');
        await cdpSf1.eval(`window.subwayIPC.toggleFullscreen()`);
        await delay(400);
        const afterRestore = await cdpSf1.eval(`window.subwayIPC.getWindowState()`);
        assert.strictEqual(afterRestore.isFullScreen, true, 'toggleFullscreen must restore fullscreen');

        // Dispatch Escape key -> app must stay alive
        await cdpSf1.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await cdpSf1.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await delay(200);
        assert.strictEqual(sf1.proc.exitCode, null, 'Escape must NOT terminate San Francisco');

        // Concurrent lock test: try launching Beijing while SF owns the lock!
        console.log('[2/6] Testing concurrent lock rejection (launching Beijing while SF runs)...');
        const lockTestCode = await new Promise((resolve) => {
            const p = spawn(BJ_APPIMAGE, ['--no-sandbox', '--windowed'], { env, stdio: 'ignore' });
            const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch (e) {} resolve(-1); }, 8000);
            p.once('exit', (code) => { clearTimeout(t); resolve(code); });
        });
        assert.strictEqual(lockTestCode, 2, 'Second instance (Beijing) must exit with code 2 when SF holds save lock');

        // Mutate real SF Save/cloud in MEMFS via FS.close + FS.rename using valid BSON + SHA-1
        const sfUpdatedBytes = mutateBsonCoinCountViaPython(path.join(sharedSaveDir, 'cloud'), 7777, 123456);
        const sfUpdatedB64 = sfUpdatedBytes.toString('base64');
        await cdpSf1.eval(`(() => {
            const bin = atob(${JSON.stringify(sfUpdatedB64)});
            const u8 = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            const tmpPath = '/idbfs/${sfState1.hash}/Save/cloud_new';
            const dstPath = '/idbfs/${sfState1.hash}/Save/cloud';
            const stream = window.FS.open(tmpPath, 'w+');
            window.FS.write(stream, u8, 0, u8.length, 0);
            window.FS.close(stream);
            window.FS.rename(tmpPath, dstPath);
        })()`);
        cdpSf1.close();

        // Close SF gracefully -> verify flush on exit + lock released + zero ERR_STREAM_WRITE_AFTER_END
        const sfExit1 = await stopGracefully(sf1.proc);
        assert.strictEqual(sfExit1, 0, 'SF must exit cleanly with code 0');
        assert(!sf1.getLogs().includes('ERR_STREAM_WRITE_AFTER_END'), 'No ERR_STREAM_WRITE_AFTER_END in SF');
        assert(!fs.existsSync(path.join(sharedSaveDir, '.storage.lock')), 'Lock file must be released on SF exit');
        const statsAfterSf = readBsonStatsViaPython(path.join(sharedSaveDir, 'cloud'));
        assert.strictEqual(statsAfterSf.coins, 7777);
        assert.strictEqual(statsAfterSf.highScore, 123456);
        console.log('  SF flushed coins=7777, highScore=123456, WebGL=', sfState1.webglVer, 'GPU=', sfState1.gpuRenderer);

        // =========================================================================
        // PART 2: Switch to Beijing -> verify exact same Save/cloud loaded -> update in Beijing
        // =========================================================================
        console.log('[3/6] Switching to Beijing (SF -> Beijing)...');
        const bj1 = launchApp(BJ_APPIMAGE, env, 9262);
        const wsBj1 = await waitForCdp(9262);
        const cdpBj1 = new CDP(wsBj1);
        await cdpBj1.ready();
        const bjState1 = await waitForUnityReady(cdpBj1);

        assert.strictEqual(bjState1.hasToolbar, false, 'Beijing must have no developer toolbar');
        assert.strictEqual(bjState1.hasDiagDrawer, false, 'Beijing must have no diagnostics drawer');
        assert.strictEqual(bjState1.extraButtons, 0, 'Beijing must have zero extra buttons');
        assert.strictEqual(bjState1.nodeExposed, false, 'Beijing nodeIntegration must be false');
        assert.strictEqual(bjState1.externalBlocked, true, 'Beijing external URLs must be blocked');
        assert.strictEqual(bjState1.info.saveDir, sharedSaveDir, 'Beijing must resolve to canonical Save dir');
        assert.strictEqual(bjState1.winState.isFullScreen, true, 'Beijing must launch in fullscreen by default');

        // Verify Beijing MEMFS Save/cloud has SF's exact coins & highScore
        const bjLoadedB64 = await cdpBj1.eval(`(() => {
            const bytes = window.FS.readFile('/idbfs/${bjState1.hash}/Save/cloud');
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            return btoa(bin);
        })()`);
        const bjLoadedStats = readBsonStatsFromBuffer(Buffer.from(bjLoadedB64, 'base64'));
        assert.strictEqual(bjLoadedStats.coins, 7777, 'Beijing must load SF-flushed coins=7777');
        assert.strictEqual(bjLoadedStats.highScore, 123456, 'Beijing must load SF-flushed highScore=123456');

        // Update progress in Beijing (coins=8888, highScore=654321)
        const bjUpdatedBytes = mutateBsonCoinCountViaPython(path.join(sharedSaveDir, 'cloud'), 8888, 654321);
        const bjUpdatedB64 = bjUpdatedBytes.toString('base64');
        await cdpBj1.eval(`(() => {
            const bin = atob(${JSON.stringify(bjUpdatedB64)});
            const u8 = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            const tmpPath = '/idbfs/${bjState1.hash}/Save/cloud_new';
            const dstPath = '/idbfs/${bjState1.hash}/Save/cloud';
            const stream = window.FS.open(tmpPath, 'w+');
            window.FS.write(stream, u8, 0, u8.length, 0);
            window.FS.close(stream);
            window.FS.rename(tmpPath, dstPath);
        })()`);
        cdpBj1.close();

        const bjExit1 = await stopGracefully(bj1.proc);
        assert.strictEqual(bjExit1, 0, 'Beijing must exit cleanly with code 0');
        assert(!bj1.getLogs().includes('ERR_STREAM_WRITE_AFTER_END'), 'No ERR_STREAM_WRITE_AFTER_END in Beijing');
        assert(!fs.existsSync(path.join(sharedSaveDir, '.storage.lock')), 'Lock file must be released on Beijing exit');
        const statsAfterBj = readBsonStatsViaPython(path.join(sharedSaveDir, 'cloud'));
        assert.strictEqual(statsAfterBj.coins, 8888);
        assert.strictEqual(statsAfterBj.highScore, 654321);
        console.log('  Beijing flushed coins=8888, highScore=654321, WebGL=', bjState1.webglVer);

        // =========================================================================
        // PART 3: Switch back to San Francisco (Beijing -> SF) -> verify Beijing progress intact
        // =========================================================================
        console.log('[4/6] Switching back to San Francisco (Beijing -> SF)...');
        const sf2 = launchApp(SF_APPIMAGE, env, 9263);
        const wsSf2 = await waitForCdp(9263);
        const cdpSf2 = new CDP(wsSf2);
        await cdpSf2.ready();
        const sfState2 = await waitForUnityReady(cdpSf2);

        const sfLoadedB64 = await cdpSf2.eval(`(() => {
            const bytes = window.FS.readFile('/idbfs/${sfState2.hash}/Save/cloud');
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            return btoa(bin);
        })()`);
        const sfLoadedStats = readBsonStatsFromBuffer(Buffer.from(sfLoadedB64, 'base64'));
        assert.strictEqual(sfLoadedStats.coins, 8888, 'SF must load Beijing-flushed coins=8888');
        assert.strictEqual(sfLoadedStats.highScore, 654321, 'SF must load Beijing-flushed highScore=654321');

        // Reverse sequence test: SF -> update -> Beijing verifies
        const sfUpdated2 = mutateBsonCoinCountViaPython(path.join(sharedSaveDir, 'cloud'), 9999, 999999);
        await cdpSf2.eval(`(() => {
            const bin = atob(${JSON.stringify(sfUpdated2.toString('base64'))});
            const u8 = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
            const tmpPath = '/idbfs/${sfState2.hash}/Save/cloud_new';
            const dstPath = '/idbfs/${sfState2.hash}/Save/cloud';
            const stream = window.FS.open(tmpPath, 'w+');
            window.FS.write(stream, u8, 0, u8.length, 0);
            window.FS.close(stream);
            window.FS.rename(tmpPath, dstPath);
        })()`);
        cdpSf2.close();
        assert.strictEqual(await stopGracefully(sf2.proc), 0);

        // =========================================================================
        // PART 4: Crash Recovery (Corrupted cloud + SIGKILL stale lock recovery)
        // =========================================================================
        console.log('[5/6] Testing live crash recovery (corrupted primary Save/cloud + SIGKILL lock recovery)...');
        const validBeforeCorrupt = fs.readFileSync(path.join(sharedSaveDir, 'cloud'));
        const expectedRecoverySha1 = verifyHeaderAndSha1(fs.readFileSync(path.join(sharedSaveDir, 'recovery', 'cloud.recovery'))).computedSha1;
        // Corrupt primary Save/cloud on disk AND leave a dead stale lock
        const corrupted = Buffer.from(validBeforeCorrupt);
        corrupted[30] ^= 0xff;
        fs.writeFileSync(path.join(sharedSaveDir, 'cloud'), corrupted);
        fs.writeFileSync(path.join(sharedSaveDir, '.storage.lock'), JSON.stringify({ pid: 9999999, startTimeTicks: '1', appName: 'Crashed', hostname: os.hostname() }));

        const bj2 = launchApp(BJ_APPIMAGE, env, 9264);
        const wsBj2 = await waitForCdp(9264);
        const cdpBj2 = new CDP(wsBj2);
        await cdpBj2.ready();
        const bjState2 = await waitForUnityReady(cdpBj2);

        const recoveredB64 = await cdpBj2.eval(`(() => {
            const bytes = window.FS.readFile('/idbfs/${bjState2.hash}/Save/cloud');
            let bin = '';
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            return btoa(bin);
        })()`);
        const recoveredStats = readBsonStatsFromBuffer(Buffer.from(recoveredB64, 'base64'));
        const expectedRecoveryStats = readBsonStatsViaPython(path.join(sharedSaveDir, 'recovery', 'cloud.recovery'));
        assert.strictEqual(recoveredStats.coins, expectedRecoveryStats.coins, 'Beijing must recover coins from recovery/cloud.recovery');
        assert.strictEqual(recoveredStats.highScore, expectedRecoveryStats.highScore, 'Beijing must recover highScore from recovery/cloud.recovery');
        cdpBj2.close();

        // Simulate forced termination (SIGKILL) and verify SF recovers lock cleanly on next boot
        bj2.proc.kill('SIGKILL');
        await delay(500);
        assert(fs.existsSync(path.join(sharedSaveDir, '.storage.lock')), 'SIGKILL leaves stale lock file');

        const sf3 = launchApp(SF_APPIMAGE, env, 9265);
        const wsSf3 = await waitForCdp(9265);
        const cdpSf3 = new CDP(wsSf3);
        await cdpSf3.ready();
        await waitForUnityReady(cdpSf3);
        cdpSf3.close();
        assert.strictEqual(await stopGracefully(sf3.proc), 0);

        // =========================================================================
        // PART 5: Verify NO legacy active directories were created
        // =========================================================================
        console.log('[6/6] Verifying zero legacy save directories created...');
        for (const legacy of legacyConfigNames) {
            assert(!fs.existsSync(path.join(tmpHome, '.config', legacy)), `Legacy directory ${legacy} must NOT be created`);
            assert(!fs.existsSync(path.join(tmpHome, '.local', 'share', legacy)), `Legacy share directory ${legacy} must NOT be created`);
        }

        console.log('[PASS] All live cross-version switching, locking, UI, security, and crash recovery tests passed!');
    } finally {
        fs.rmSync(tmpHome, { recursive: true, force: true });
    }
}

run().catch((err) => {
    console.error('[FAIL]', err);
    process.exit(1);
});

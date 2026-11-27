/**
 * Live End-to-End Integration, 6-Way Cross-Version Switching, Locking, Crash Recovery & UI Tests
 *
 * Tests the FINAL built AppImages:
 *   - App images/SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage
 *   - App images/SubwaySurfers-Beijing-Linux-x86_64.AppImage
 *   - App images/SubwaySurfers-Zurich-Linux-x86_64.AppImage
 */
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../..');
const APPS = {
    sanfrancisco: {
        name: 'San Francisco',
        appImage: path.join(REPO_ROOT, 'App images', 'SubwaySurfers-SanFrancisco-Linux-x86_64.AppImage'),
        appId: 'SubwaySurfers-SanFrancisco-Linux',
        hasCleanroomPoki: false
    },
    beijing: {
        name: 'Beijing',
        appImage: path.join(REPO_ROOT, 'App images', 'SubwaySurfers-Beijing-Linux-x86_64.AppImage'),
        appId: 'SubwaySurfers-Beijing-Linux',
        hasCleanroomPoki: true
    },
    zurich: {
        name: 'Zurich',
        appImage: path.join(REPO_ROOT, 'App images', 'SubwaySurfers-Zurich-Linux-x86_64.AppImage'),
        appId: 'SubwaySurfers-Zurich-Linux',
        hasCleanroomPoki: true
    }
};

const { verifyHeaderAndSha1 } = require(path.join(REPO_ROOT, 'Source', 'Shared', 'sha1_header.js'));

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
            const overlay = document.getElementById('loading-overlay');
            const overlayHidden = overlay ? overlay.classList.contains('hidden') : true;
            if (!canvas || canvas.width === 0 || !hasCloud || !overlayHidden) return { waiting: true };
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
                viewportWidth: window.innerWidth,
                viewportHeight: window.innerHeight,
                hasToolbar: Boolean(document.getElementById('toolbar')),
                hasDiagDrawer: Boolean(document.getElementById('diagnostics-drawer')),
                hasMoreG: Boolean(document.getElementById('more_g')),
                hasGameLock: Boolean(document.getElementById('game_lock')),
                adDivCount: document.querySelectorAll('[id^="PokiUnitySDK_Ad_"]').length,
                extraButtons: document.querySelectorAll('button:not(#btn-retry-boot)').length,
                nodeExposed: (typeof require !== 'undefined') || (typeof process !== 'undefined'),
                pokiAdBlock: window.pokiAdBlock,
                pokiReady: window.pokiReady,
                externalBlocked,
                info,
                winState,
                webglVer,
                gpuRenderer
            };
        })()`);
        if (state && !state.waiting) return state;
    }
    throw new Error('Timed out waiting for Unity WebGL canvas, loading overlay hide, and Save/cloud');
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

async function readMemfsCloudStats(cdp, hash) {
    const b64 = await cdp.eval(`(() => {
        const bytes = window.FS.readFile('/idbfs/${hash}/Save/cloud');
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    })()`);
    return readBsonStatsFromBuffer(Buffer.from(b64, 'base64'));
}

async function writeMemfsCloudProgress(cdp, hash, sharedSaveDir, coins, highScore) {
    const updatedBytes = mutateBsonCoinCountViaPython(path.join(sharedSaveDir, 'cloud'), coins, highScore);
    const updatedB64 = updatedBytes.toString('base64');
    await cdp.eval(`(() => {
        const bin = atob(${JSON.stringify(updatedB64)});
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const tmpPath = '/idbfs/${hash}/Save/cloud_new';
        const dstPath = '/idbfs/${hash}/Save/cloud';
        const stream = window.FS.open(tmpPath, 'w+');
        window.FS.write(stream, u8, 0, u8.length, 0);
        window.FS.close(stream);
        window.FS.rename(tmpPath, dstPath);
    })()`);
}

async function verifyLiveWasdControls(cdp, appProc, spec) {
    const sendKey = async (type, key, code, vk, repeat = false) => {
        await cdp.call('Input.dispatchKeyEvent', {
            type,
            key,
            code,
            windowsVirtualKeyCode: vk,
            nativeVirtualKeyCode: vk,
            autoRepeat: repeat
        });
    };

    // Start run via Space (must pass through unchanged)
    await sendKey('keyDown', ' ', 'Space', 32);
    await delay(70);
    await sendKey('keyUp', ' ', 'Space', 32);
    await delay(500);

    // Physical Arrow key must be suppressed
    await sendKey('keyDown', 'ArrowLeft', 'ArrowLeft', 37);
    await delay(50);
    await sendKey('keyUp', 'ArrowLeft', 'ArrowLeft', 37);

    // W, A, S, D (including repeated keydown and release)
    for (const [k, c, vk] of [['w', 'KeyW', 87], ['a', 'KeyA', 65], ['s', 'KeyS', 83], ['d', 'KeyD', 68]]) {
        await sendKey('keyDown', k, c, vk, false);
        await delay(50);
        await sendKey('keyDown', k, c, vk, true);
        await delay(40);
        await sendKey('keyUp', k, c, vk, false);
        await delay(60);
    }

    // Hold W + D then trigger blur -> must release both without stuck keys
    await sendKey('keyDown', 'w', 'KeyW', 87);
    await sendKey('keyDown', 'd', 'KeyD', 68);
    await delay(40);
    const heldBeforeBlur = await cdp.eval('window.SubwayControls.getActiveMappedKeys()');
    assert.deepStrictEqual(heldBeforeBlur.sort(), ['KeyD', 'KeyW'], `${spec.name} must track held WASD keys`);
    await cdp.eval('window.dispatchEvent(new Event("blur"))');
    await delay(40);
    const heldAfterBlur = await cdp.eval('window.SubwayControls.getActiveMappedKeys()');
    assert.strictEqual(heldAfterBlur.length, 0, `${spec.name} must release held WASD keys on blur`);

    // Escape must pause/pass through without closing app
    await sendKey('keyDown', 'Escape', 'Escape', 27);
    await delay(60);
    await sendKey('keyUp', 'Escape', 'Escape', 27);
    await delay(120);
    assert.strictEqual(appProc.exitCode, null, `Escape must NOT terminate ${spec.name}`);

    const trace = await cdp.eval('window.SubwayControls.getTrace()');
    const remaps = trace.filter((t) => t.to).map((t) => `${t.type}:${t.phys}->${t.to}`);
    assert(remaps.includes('keydown:KeyW->ArrowUp'), `${spec.name} W keydown -> ArrowUp`);
    assert(remaps.includes('keydown:KeyA->ArrowLeft'), `${spec.name} A keydown -> ArrowLeft`);
    assert(remaps.includes('keydown:KeyS->ArrowDown'), `${spec.name} S keydown -> ArrowDown`);
    assert(remaps.includes('keydown:KeyD->ArrowRight'), `${spec.name} D keydown -> ArrowRight`);
    assert(remaps.includes('keyup:KeyW->ArrowUp'), `${spec.name} W keyup -> ArrowUp`);
    assert(remaps.includes('keyup:KeyD->ArrowRight'), `${spec.name} D keyup -> ArrowRight`);
    assert(trace.some((t) => t.suppressed && t.phys === 'ArrowLeft'), `${spec.name} must suppress physical ArrowLeft`);
}

function assertUiAndSecurity(verKey, state, sharedSaveDir) {
    const spec = APPS[verKey];
    assert.strictEqual(state.hasToolbar, false, `${spec.name} must have no developer toolbar`);
    assert.strictEqual(state.hasDiagDrawer, false, `${spec.name} must have no diagnostics drawer`);
    assert.strictEqual(state.hasMoreG, false, `${spec.name} must have no portal #more_g overlay`);
    assert.strictEqual(state.hasGameLock, false, `${spec.name} must have no portal #game_lock overlay`);
    assert.strictEqual(state.adDivCount, 0, `${spec.name} must have zero Poki ad containers`);
    assert.strictEqual(state.extraButtons, 0, `${spec.name} must have zero extra overlay buttons`);
    assert.strictEqual(state.nodeExposed, false, `${spec.name} nodeIntegration must be false`);
    assert.strictEqual(state.externalBlocked, true, `${spec.name} external URLs must be blocked`);
    assert.strictEqual(state.info.saveDir, sharedSaveDir, `${spec.name} must resolve to canonical Save dir`);
    assert.strictEqual(state.winState.isFullScreen, true, `${spec.name} must launch in fullscreen by default`);
    assert(state.canvasWidth > 0 && state.canvasHeight > 0, `${spec.name} canvas must render`);
    if (spec.hasCleanroomPoki) {
        assert.strictEqual(state.pokiAdBlock, true, `${spec.name} must keep pokiAdBlock=true`);
        assert.strictEqual(state.pokiReady, false, `${spec.name} must keep pokiReady=false`);
    }
}

async function testConcurrentReject(blockedKey, env) {
    const exitCode = await new Promise((resolve) => {
        const p = spawn(APPS[blockedKey].appImage, ['--no-sandbox', '--windowed'], { env, stdio: 'ignore' });
        const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch (e) {} resolve(-1); }, 8000);
        p.once('exit', (code) => { clearTimeout(t); resolve(code); });
    });
    assert.strictEqual(exitCode, 2, `Second instance (${APPS[blockedKey].name}) must exit with code 2 when lock held`);
}

async function run() {
    console.log('[Integration Tests] Starting comprehensive 3-version, 6-transition, locking, UI & recovery suite...');
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'subway-e2e-3v-'));
    const env = makeSandboxEnv(tmpHome);
    const sharedSaveDir = path.join(tmpHome, '.local', 'share', 'SubwaySurfers-Linux', 'Save');
    const legacyConfigNames = ['SubwaySurfersSanfrancisco', 'SubwaySurfersBeijing', 'SubwaySurfersBeijing2', 'SubwaySurfersZurich'];

    // Sequence covering ALL 6 directed transitions:
    // SF -> Beijing -> SF -> Zurich -> SF (already covered SF->BJ, BJ->SF, SF->ZR, ZR->SF)
    // plus Beijing -> Zurich -> Beijing!
    const sequence = [
        { key: 'sanfrancisco', writeCoins: 1111, writeScore: 100100, checkLocks: ['beijing', 'zurich'], testWindowControls: true },
        { key: 'beijing',      expectCoins: 1111, expectScore: 100100, writeCoins: 2222, writeScore: 200200, checkLocks: ['sanfrancisco', 'zurich'], testWindowControls: true },
        { key: 'sanfrancisco', expectCoins: 2222, expectScore: 200200, writeCoins: 3333, writeScore: 300300 },
        { key: 'zurich',       expectCoins: 3333, expectScore: 300300, writeCoins: 4444, writeScore: 400400, checkLocks: ['sanfrancisco', 'beijing'], testWindowControls: true },
        { key: 'sanfrancisco', expectCoins: 4444, expectScore: 400400, writeCoins: 5555, writeScore: 500500 },
        { key: 'beijing',      expectCoins: 5555, expectScore: 500500, writeCoins: 6666, writeScore: 600600 },
        { key: 'zurich',       expectCoins: 6666, expectScore: 600600, writeCoins: 7777, writeScore: 700700 },
        { key: 'beijing',      expectCoins: 7777, expectScore: 700700, writeCoins: 8888, writeScore: 800800 }
    ];

    let port = 9261;
    try {
        for (let stepIdx = 0; stepIdx < sequence.length; stepIdx++) {
            const step = sequence[stepIdx];
            const spec = APPS[step.key];
            console.log(`[${stepIdx + 1}/${sequence.length}] Launching ${spec.name}...`);

            const app = launchApp(spec.appImage, env, port);
            const wsUrl = await waitForCdp(port++);
            const cdp = new CDP(wsUrl);
            await cdp.ready();
            const state = await waitForUnityReady(cdp);

            assertUiAndSecurity(step.key, state, sharedSaveDir);

            if (step.testWindowControls) {
                await verifyLiveWasdControls(cdp, app.proc, spec);

                await cdp.eval(`window.subwayIPC.toggleFullscreen()`);
                await delay(350);
                const afterToggle = await cdp.eval(`window.subwayIPC.getWindowState()`);
                assert.strictEqual(afterToggle.isFullScreen, false, `${spec.name} F11/toggleFullscreen must exit fullscreen`);
                await cdp.eval(`window.subwayIPC.toggleFullscreen()`);
                await delay(350);
                const afterRestore = await cdp.eval(`window.subwayIPC.getWindowState()`);
                assert.strictEqual(afterRestore.isFullScreen, true, `${spec.name} F11/toggleFullscreen must restore fullscreen`);

                await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
                await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
                await delay(150);
                assert.strictEqual(app.proc.exitCode, null, `Escape must NOT terminate ${spec.name}`);
            }

            if (step.checkLocks) {
                for (const lockedKey of step.checkLocks) {
                    await testConcurrentReject(lockedKey, env);
                }
            }

            if (step.expectCoins !== undefined) {
                const loadedStats = await readMemfsCloudStats(cdp, state.hash);
                assert.strictEqual(loadedStats.coins, step.expectCoins, `${spec.name} must load coins=${step.expectCoins}`);
                assert.strictEqual(loadedStats.highScore, step.expectScore, `${spec.name} must load highScore=${step.expectScore}`);
            }

            await writeMemfsCloudProgress(cdp, state.hash, sharedSaveDir, step.writeCoins, step.writeScore);
            cdp.close();

            const exitCode = await stopGracefully(app.proc);
            assert.strictEqual(exitCode, 0, `${spec.name} must exit cleanly with code 0`);
            assert(!app.getLogs().includes('ERR_STREAM_WRITE_AFTER_END'), `No ERR_STREAM_WRITE_AFTER_END in ${spec.name}`);
            assert(!fs.existsSync(path.join(sharedSaveDir, '.storage.lock')), `Lock file must be released on ${spec.name} exit`);
            if (step.key === 'beijing') {
                assert(!app.getLogs().includes('commercialBreak'), 'Beijing must not trigger commercialBreak');
            }

            const diskStats = readBsonStatsViaPython(path.join(sharedSaveDir, 'cloud'));
            assert.strictEqual(diskStats.coins, step.writeCoins);
            assert.strictEqual(diskStats.highScore, step.writeScore);
            console.log(`  ${spec.name} OK (coins=${diskStats.coins}, highScore=${diskStats.highScore}, WebGL=${state.webglVer})`);
        }

        // Crash Recovery (Corrupted cloud + corrupted local + SIGKILL stale lock recovery)
        console.log('[Recovery] Testing live crash recovery (corrupted Save/cloud + Save/local + SIGKILL lock recovery)...');
        const validCloud = fs.readFileSync(path.join(sharedSaveDir, 'cloud'));
        const validLocal = fs.readFileSync(path.join(sharedSaveDir, 'local'));
        const badCloud = Buffer.from(validCloud); badCloud[30] ^= 0xff;
        const badLocal = Buffer.from(validLocal); badLocal[30] ^= 0xff;
        fs.writeFileSync(path.join(sharedSaveDir, 'cloud'), badCloud);
        fs.writeFileSync(path.join(sharedSaveDir, 'local'), badLocal);
        fs.writeFileSync(path.join(sharedSaveDir, '.storage.lock'), JSON.stringify({ pid: 9999999, startTimeTicks: '1', appName: 'Crashed', hostname: os.hostname() }));

        const zrRec = launchApp(APPS.zurich.appImage, env, port++);
        const wsRec = await waitForCdp(port - 1);
        const cdpRec = new CDP(wsRec);
        await cdpRec.ready();
        const stateRec = await waitForUnityReady(cdpRec);

        const recStats = await readMemfsCloudStats(cdpRec, stateRec.hash);
        const expectedRec = readBsonStatsViaPython(path.join(sharedSaveDir, 'recovery', 'cloud.recovery'));
        assert.strictEqual(recStats.coins, expectedRec.coins, 'Zurich must recover coins from recovery/cloud.recovery');
        assert.strictEqual(recStats.highScore, expectedRec.highScore, 'Zurich must recover highScore from recovery/cloud.recovery');
        assert.strictEqual(verifyHeaderAndSha1(fs.readFileSync(path.join(sharedSaveDir, 'local'))).valid, true, 'Save/local must recover cleanly');
        cdpRec.close();

        // Simulate SIGKILL -> verify Beijing recovers stale lock cleanly on next boot
        zrRec.proc.kill('SIGKILL');
        await delay(500);
        assert(fs.existsSync(path.join(sharedSaveDir, '.storage.lock')), 'SIGKILL leaves stale lock file');

        const bjAfterKill = launchApp(APPS.beijing.appImage, env, port++);
        const wsBjKill = await waitForCdp(port - 1);
        const cdpBjKill = new CDP(wsBjKill);
        await cdpBjKill.ready();
        await waitForUnityReady(cdpBjKill);
        cdpBjKill.close();
        assert.strictEqual(await stopGracefully(bjAfterKill.proc), 0);

        // Verify zero legacy active directories created
        for (const legacy of legacyConfigNames) {
            assert(!fs.existsSync(path.join(tmpHome, '.config', legacy)), `Legacy directory ${legacy} must NOT be created`);
            assert(!fs.existsSync(path.join(tmpHome, '.local', 'share', legacy)), `Legacy share directory ${legacy} must NOT be created`);
        }

        console.log('[PASS] All 3-version, 6-transition, locking, UI, ad-removal, security, and crash recovery tests passed!');
    } finally {
        fs.rmSync(tmpHome, { recursive: true, force: true });
    }
}

run().catch((err) => {
    console.error('[FAIL]', err);
    process.exit(1);
});

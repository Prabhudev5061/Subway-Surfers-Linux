/**
 * AutoSave & HostIDBFS Integration Unit Tests (SubwaySurfers-Linux)
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const SHARED_DIR = path.join(REPO_ROOT, 'Source', 'Shared');

function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function run() {
    console.log('[AutoSave & HostIDBFS Tests] Starting...');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'subway-autosave-test-'));
    const saveDir = path.join(tmpRoot, 'Save');

    try {
        global.window = global;
        global.document = { hidden: false, addEventListener: () => {} };
        global.window.addEventListener = () => {};

        require(path.join(SHARED_DIR, 'sha1_header.js'));
        require(path.join(SHARED_DIR, 'host_idbfs_bridge.js'));
        require(path.join(SHARED_DIR, 'autosave_manager.js'));
        const sharedStorage = require(path.join(SHARED_DIR, 'shared_storage.js'));

        const ASM = global.AutoSaveManager;
        const HostIDBFS = global.HostIDBFS;
        const originHash = crypto.createHash('md5').update('http://127.0.0.1:47321').digest('hex');

        let flushedCount = 0;
        let completedCount = 0;
        let lastCommitted = null;
        let simulatedCommitFailures = 0;

        global.window.subwayIPC = {
            loadSharedSaves: async () => {
                const loaded = sharedStorage.loadAllSaves(saveDir);
                return { originHash, saveDir, files: loaded.files, mtimes: loaded.mtimes };
            },
            commitSharedSaves: async (entries) => {
                if (simulatedCommitFailures > 0) {
                    simulatedCommitFailures--;
                    throw new Error('Simulated transient IPC commit error');
                }
                const res = sharedStorage.commitSaves(entries, saveDir);
                lastCommitted = res;
                return res;
            },
            sendSaveStatus: () => {},
            sendSaveCompleted: () => { completedCount++; },
            sendSaveFlushed: () => { flushedCount++; },
            onForceSave: () => {}
        };

        // Mock Emscripten MEMFS
        const nodes = new Map();
        const memFS = {
            analyzePath: (p) => ({ exists: nodes.has(p), object: { mounted: p === '/idbfs' } }),
            mkdir: (p) => nodes.set(p, { isFolder: true, mode: 0o40755, timestamp: Date.now() }),
            readdir: (p) => {
                if (p === '/idbfs') {
                    const children = [];
                    for (const k of nodes.keys()) {
                        const m = /^\/idbfs\/([^/]+)$/.exec(k);
                        if (m) children.push(m[1]);
                    }
                    return ['.', '..', ...children];
                }
                const prefix = p + '/';
                const children = [];
                for (const k of nodes.keys()) {
                    if (k.startsWith(prefix)) {
                        const rest = k.slice(prefix.length);
                        if (!rest.includes('/')) children.push(rest);
                    }
                }
                return ['.', '..', ...children];
            },
            lookupPath: (p) => ({ node: nodes.get(p) }),
            stat: (p) => {
                const n = nodes.get(p);
                return { mode: n.mode, mtime: new Date(n.timestamp || 0) };
            },
            isDir: (m) => (m & 0o40000) === 0o40000,
            isFile: (m) => (m & 0o100000) === 0o100000,
            readFile: (p) => nodes.get(p).contents,
            writeFile: (p, data) => nodes.set(p, { isFolder: false, mode: 0o100666, timestamp: Date.now(), contents: new Uint8Array(data) }),
            utime: (p, _a, m) => { if (nodes.has(p)) nodes.get(p).timestamp = m; },
            close: () => {},
            rename: (oldP, newP) => {
                const n = nodes.get(oldP);
                nodes.delete(oldP);
                nodes.set(newP, n);
            },
            syncfs: (populate, cb) => HostIDBFS.syncfs(memFS, {}, populate, cb)
        };

        // Seed initial valid save in shared storage
        const cloudV1 = Buffer.from(ASM.wrapWithSha1Header(Buffer.from('SESSION_1_COINS_500')));
        sharedStorage.commitSaves([{ path: 'Save/cloud', data: cloudV1 }], saveDir);

        // 1. Populate MEMFS from shared storage on mount
        nodes.set('/idbfs', { isFolder: true, mode: 0o40755, timestamp: 100 });
        await new Promise((resolve, reject) => {
            memFS.syncfs(true, (err) => (err ? reject(err) : resolve()));
        });
        ASM.onMountComplete(memFS);
        const memCloud = memFS.readFile(`/idbfs/${originHash}/Save/cloud`);
        assert.deepStrictEqual(Buffer.from(memCloud), cloudV1, 'HostIDBFS must populate MEMFS from canonical Save/cloud');

        // 2. Rapid sequential FS.close + FS.rename writes coalesce into 1 commit
        const dir = `/idbfs/${originHash}/Save`;
        for (let i = 0; i < 6; i++) {
            const tmp = { isFolder: false, mode: 0o100666, timestamp: 50, contents: ASM.wrapWithSha1Header(Buffer.from(`RAPID_${i}`)) };
            nodes.set(`${dir}/cloud_new`, tmp);
            memFS.close({ path: `${dir}/cloud_new`, node: tmp });
            memFS.rename(`${dir}/cloud_new`, `${dir}/cloud`);
        }
        await delay(260);
        assert.strictEqual(completedCount, 1, '6 rapid writes within debounce window must coalesce into 1 commit');
        assert.deepStrictEqual(
            fs.readFileSync(path.join(saveDir, 'cloud')),
            Buffer.from(ASM.wrapWithSha1Header(Buffer.from('RAPID_5'))),
            'Canonical Save/cloud on disk updated atomically'
        );

        // 3. Transient failure retry recovery
        simulatedCommitFailures = 2;
        const retryBytes = ASM.wrapWithSha1Header(Buffer.from('RETRY_RECOVERED'));
        nodes.set(`${dir}/cloud`, { isFolder: false, mode: 0o100666, timestamp: Date.now(), contents: retryBytes });
        await new Promise((resolve, reject) => {
            ASM.forceSyncNow('retry-test', (err) => (err ? reject(err) : resolve()));
        });
        assert.deepStrictEqual(fs.readFileSync(path.join(saveDir, 'cloud')), Buffer.from(retryBytes));

        // 4. forceFlushAndExit drains pending debounce queue immediately
        flushedCount = 0;
        const exitBytes = ASM.wrapWithSha1Header(Buffer.from('EXIT_DRAINED'));
        nodes.set(`${dir}/cloud_new`, { isFolder: false, mode: 0o100666, timestamp: Date.now(), contents: exitBytes });
        memFS.rename(`${dir}/cloud_new`, `${dir}/cloud`);
        assert(ASM.debounceTimer !== null);
        ASM.forceFlushAndExit();
        await delay(100);
        assert(flushedCount >= 1, 'forceFlushAndExit must drain queue and send save-flushed');
        assert.deepStrictEqual(fs.readFileSync(path.join(saveDir, 'cloud')), Buffer.from(exitBytes));

        if (ASM.watchdogTimer) clearInterval(ASM.watchdogTimer);
        console.log('[PASS] AutoSave & HostIDBFS tests passed.');
    } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
}

run().catch((err) => {
    console.error('[FAIL]', err);
    process.exit(1);
});

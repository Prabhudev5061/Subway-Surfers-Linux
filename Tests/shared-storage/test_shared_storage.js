/**
 * Shared Storage Unit & Locking Tests (SubwaySurfers-Linux)
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../..');
const SHARED_DIR = path.join(REPO_ROOT, 'Source', 'Shared');

const { wrapWithSha1Header, verifyHeaderAndSha1 } = require(path.join(SHARED_DIR, 'sha1_header.js'));
const {
    getCanonicalSaveDir,
    resolveSafeSavePath,
    loadAllSaves,
    commitSaves
} = require(path.join(SHARED_DIR, 'shared_storage.js'));
const { acquireStorageLock } = require(path.join(SHARED_DIR, 'storage_lock.js'));

async function run() {
    console.log('[Shared Storage Tests] Starting...');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'subway-shared-test-'));
    const saveDir = path.join(tmpRoot, 'SubwaySurfers-Linux', 'Save');

    try {
        // 1. Canonical path resolution under XDG_DATA_HOME
        process.env.XDG_DATA_HOME = tmpRoot;
        delete process.env.SUBWAY_SHARED_SAVE_DIR;
        delete process.env.SUBWAY_SHARED_ROOT_DIR;
        assert.strictEqual(getCanonicalSaveDir(), saveDir, 'Canonical save dir must resolve to $XDG_DATA_HOME/SubwaySurfers-Linux/Save');

        // 2. Path traversal & allowlist protection
        assert.throws(() => resolveSafeSavePath(saveDir, '../evil'), /Path traversal|Invalid/);
        assert.throws(() => resolveSafeSavePath(saveDir, '/etc/passwd'), /Absolute/);
        assert.throws(() => resolveSafeSavePath(saveDir, 'Save/cloud\0bad'), /Invalid/);
        assert.throws(() => resolveSafeSavePath(saveDir, 'arbitrary.exe'), /Disallowed/);
        assert.strictEqual(resolveSafeSavePath(saveDir, 'Save/cloud').diskRel, 'cloud');
        assert.strictEqual(resolveSafeSavePath(saveDir, 'PlayerPrefs').diskRel, 'PlayerPrefs');

        // 3. Atomic commit + validation + rolling recovery backup
        const payload1 = Buffer.from(JSON.stringify({ coins: 100, run: 1 }));
        const cloud1 = Buffer.from(wrapWithSha1Header(payload1));
        const pp1 = Buffer.concat([Buffer.from('UnityPrf\x00\x00\x01\x00\x00\x00'), Buffer.from('test1')]);

        const res1 = commitSaves([
            { path: 'Save/cloud', data: cloud1 },
            { path: 'PlayerPrefs', data: pp1 }
        ], saveDir);
        assert.strictEqual(res1.committed.length, 2);
        assert.strictEqual(res1.rejected.length, 0);
        assert(fs.existsSync(path.join(saveDir, 'cloud')));
        assert(fs.existsSync(path.join(saveDir, 'PlayerPrefs')));

        // Overwrite with updated valid save -> previous valid save goes to recovery/cloud.recovery
        const cloud2 = Buffer.from(wrapWithSha1Header(Buffer.from(JSON.stringify({ coins: 250, run: 2 }))));
        const res2 = commitSaves([{ path: 'Save/cloud', data: cloud2 }], saveDir);
        assert.strictEqual(res2.committed.length, 1);
        assert(fs.existsSync(path.join(saveDir, 'recovery', 'cloud.recovery')), 'Previous valid cloud save preserved in recovery/');
        assert.deepStrictEqual(fs.readFileSync(path.join(saveDir, 'recovery', 'cloud.recovery')), cloud1);

        // Corrupted write must be rejected without touching disk
        const badCloud = Buffer.from(cloud2);
        badCloud[30] ^= 0xff;
        const resBad = commitSaves([{ path: 'Save/cloud', data: badCloud }], saveDir);
        assert.strictEqual(resBad.rejected.length, 1);
        assert.deepStrictEqual(fs.readFileSync(path.join(saveDir, 'cloud')), cloud2, 'Corrupted write did not overwrite valid cloud');

        // 4. Crash recovery on load: corrupt primary cloud -> auto-recovered from recovery/cloud.recovery
        fs.writeFileSync(path.join(saveDir, 'cloud'), badCloud);
        const loaded = loadAllSaves(saveDir);
        assert.strictEqual(loaded.recovered.length, 1, 'Corrupted primary cloud must auto-recover');
        assert.strictEqual(verifyHeaderAndSha1(loaded.files['Save/cloud']).valid, true);
        assert.deepStrictEqual(loaded.files['Save/cloud'], cloud1);

        // Corrupted backup rejection: corrupt BOTH primary and cloud_old, ensure recovery/cloud.recovery is used & corrupt cloud_old rejected
        fs.writeFileSync(path.join(saveDir, 'cloud'), badCloud);
        fs.writeFileSync(path.join(saveDir, 'cloud_old'), badCloud);
        const loaded2 = loadAllSaves(saveDir);
        assert.strictEqual(loaded2.recovered.length, 1);
        assert(loaded2.rejectedBackups.some((b) => b.backup === 'cloud_old'), 'Corrupted cloud_old must be rejected');
        assert.deepStrictEqual(loaded2.files['Save/cloud'], cloud1);

        // 5. Exclusive locking across all 3 versions + stale lock recovery
        const lock1 = acquireStorageLock(saveDir, { appName: 'SubwaySurfers-SanFrancisco-Linux', version: 'sanfrancisco' });
        assert.strictEqual(lock1.acquired, true);

        // Spawn child processes for Beijing & Zurich trying to acquire the same lock -> MUST fail
        for (const contender of ['SubwaySurfers-Beijing-Linux', 'SubwaySurfers-Zurich-Linux']) {
            const childCode = await new Promise((resolve) => {
                const c = spawn(process.execPath, [
                    '-e',
                    `const { acquireStorageLock } = require(${JSON.stringify(path.join(SHARED_DIR, 'storage_lock.js'))});
                     const r = acquireStorageLock(${JSON.stringify(saveDir)}, { appName: ${JSON.stringify(contender)} });
                     process.exit(r.acquired ? 0 : 2);`
                ], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
                c.on('exit', resolve);
            });
            assert.strictEqual(childCode, 2, `Concurrent ${contender} instance must fail to acquire lock`);
        }
        assert.strictEqual(lock1.release(), true, 'Lock release on normal shutdown');

        // Simulate stale lock left by dead PID 9999999
        fs.writeFileSync(
            path.join(saveDir, '.storage.lock'),
            JSON.stringify({ pid: 9999999, startTimeTicks: '1', appName: 'CrashedApp', hostname: os.hostname() })
        );
        const lockAfterCrash = acquireStorageLock(saveDir, { appName: 'SubwaySurfers-Zurich-Linux', version: 'zurich' });
        assert.strictEqual(lockAfterCrash.acquired, true, 'Must recover stale lock after crash');
        assert.strictEqual(lockAfterCrash.recoveredStale, true);
        lockAfterCrash.release();

        // 6. Unknown BSON field & exact type preservation round-trip via bson_adapter.py
        const pyRoundTrip = `
import sys
from pathlib import Path
sys.path.insert(0, ${JSON.stringify(SHARED_DIR)})
import bson_adapter
src_raw = Path(${JSON.stringify(path.join(REPO_ROOT, 'Tests', 'fixtures', 'synthetic_source_save_cloud.bin'))}).read_bytes()
tgt_raw = Path(${JSON.stringify(path.join(REPO_ROOT, 'Tests', 'fixtures', 'synthetic_target_save_cloud.bin'))}).read_bytes()
src_doc, _ = bson_adapter.unwrap_and_validate_save(src_raw)
tgt_doc, _ = bson_adapter.unwrap_and_validate_save(tgt_raw)
tgt_doc["customZurichEventField"] = bson_adapter.BsonValue(bson_adapter.BSON_STRING, "zurich_easter_2021")
tgt_doc["customInt64Counter"] = bson_adapter.BsonValue(bson_adapter.BSON_INT64, 9876543210123)
merged, report = bson_adapter.sync_save_cloud_documents(src_doc, tgt_doc)
out_bytes, _ = bson_adapter.wrap_save(merged)
decoded, _ = bson_adapter.unwrap_and_validate_save(out_bytes)
assert decoded["customZurichEventField"].bson_type == bson_adapter.BSON_STRING
assert decoded["customZurichEventField"].value == "zurich_easter_2021"
assert decoded["customInt64Counter"].bson_type == bson_adapter.BSON_INT64
assert decoded["customInt64Counter"].value == 9876543210123
print("BSON_ROUNDTRIP_OK")
`;
        const rtOut = execSync('python3 -', { input: pyRoundTrip, encoding: 'utf8' }).trim();
        assert.strictEqual(rtOut, 'BSON_ROUNDTRIP_OK', 'Unknown BSON fields must survive round-trip');

        console.log('[PASS] Shared storage & locking tests passed.');
    } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
}

run().catch((err) => {
    console.error('[FAIL]', err);
    process.exit(1);
});

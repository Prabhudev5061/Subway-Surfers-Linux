/**
 * Test Suite 2: AutoSaveManager State Machine, Queueing, and Synchronization
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== RUNNING TEST SUITE 2: AUTOSAVEMANAGER STATE & QUEUE ===');

let testsPassed = 0;
let testsTotal = 0;

function runAsyncTest(name, fn) {
    testsTotal++;
    return new Promise((resolve, reject) => {
        fn((err) => {
            if (err) {
                console.error(`[FAIL] ${name}:`, err.message);
                reject(err);
            } else {
                console.log(`[PASS] ${name}`);
                testsPassed++;
                resolve();
            }
        });
    });
}

// Helper to create a fresh isolated instance of AutoSaveManager
function createIsolatedInstance(mockIPC, mockFS) {
    let asmPath = path.join(__dirname, '../source/autosave_manager.js');
    if (!fs.existsSync(asmPath)) {
        asmPath = path.join(__dirname, '../app/autosave_manager.js');
    }
    const asmCode = fs.readFileSync(asmPath, 'utf8');
    let mockWindow = {
        subwayIPC: mockIPC || {},
        addEventListener: () => {},
        removeEventListener: () => {}
    };
    eval('(function(window) { ' + asmCode + ' })(mockWindow);');
    const asm = mockWindow.AutoSaveManager;
    asm.DEBUG = false; // keep test logs clean
    asm.FS = mockFS;
    return { asm, mockWindow };
}

async function runAllTests() {
    // 1. Debounce and coalescing test
    await runAsyncTest('Debounce Coalescing: 5 rapid file writes trigger exactly 1 FS.syncfs call', (done) => {
        let syncCount = 0;
        const mockFS = {
            syncfs: (populate, cb) => {
                syncCount++;
                setTimeout(() => cb(null), 10);
            }
        };
        const { asm } = createIsolatedInstance(null, mockFS);
        asm.debounceDelay = 50; // set 50ms for fast test

        // Simulate 5 rapid file-closed events
        const dummyNode = { contents: new Uint8Array(50) };
        for (let i = 0; i < 5; i++) {
            asm.onFileClosed('/idbfs/test/PlayerPrefs', dummyNode);
        }

        // Wait 150ms and assert syncCount is 1
        setTimeout(() => {
            try {
                assert.strictEqual(syncCount, 1);
                assert.strictEqual(asm.dirty, false);
                assert.strictEqual(asm.isSyncing, false);
                done();
            } catch (e) {
                done(e);
            }
        }, 150);
    });

    // 2. Concurrency protection and pending sync draining
    await runAsyncTest('Concurrency Protection: Write during active sync enqueues and triggers subsequent sync', (done) => {
        let syncCount = 0;
        const mockFS = {
            syncfs: (populate, cb) => {
                syncCount++;
                // First sync takes 80ms, second takes 10ms
                const delay = syncCount === 1 ? 80 : 10;
                setTimeout(() => cb(null), delay);
            }
        };
        const { asm } = createIsolatedInstance(null, mockFS);
        asm.debounceDelay = 20;

        // Trigger 1st write
        asm.scheduleSync('write-1');

        // After 30ms, 1st sync will be active. Trigger 2nd write.
        setTimeout(() => {
            assert.strictEqual(asm.isSyncing, true, 'Sync should be active at 30ms');
            asm.scheduleSync('write-2'); // Should set pendingSync = true
        }, 30);

        // After 180ms, both syncs should have completed
        setTimeout(() => {
            try {
                assert.strictEqual(syncCount, 2, 'Should have executed 2 syncs in sequence');
                assert.strictEqual(asm.isSyncing, false);
                assert.strictEqual(asm.pendingSync, false);
                done();
            } catch (e) {
                done(e);
            }
        }, 180);
    });

    // 3. Retry logic with exponential backoff on failure
    await runAsyncTest('Retry Logic: Simulated failure triggers retry and eventual success', (done) => {
        let attempts = 0;
        const mockFS = {
            syncfs: (populate, cb) => {
                attempts++;
                if (attempts < 3) {
                    cb(new Error('Simulated IndexedDB I/O Error'));
                } else {
                    cb(null); // Success on 3rd attempt
                }
            }
        };
        const { asm } = createIsolatedInstance(null, mockFS);
        asm.debounceDelay = 10;

        asm.scheduleSync('initial-write');

        // Check after 2000ms (accounting for backoffs: 1*400ms + 2*400ms + margin)
        setTimeout(() => {
            try {
                assert.strictEqual(attempts, 3, 'Should have retried twice and succeeded on 3rd');
                assert.strictEqual(asm.retryCount, 0, 'Retry count reset to 0 on success');
                assert.strictEqual(asm.saveSequenceId, 1);
                done();
            } catch (e) {
                done(e);
            }
        }, 2000);
    });

    // 4. Force sync immediate bypasses debounce
    await runAsyncTest('Force Sync Now: Bypasses debounce timer immediately', (done) => {
        let syncCalled = false;
        const mockFS = {
            syncfs: (populate, cb) => {
                syncCalled = true;
                cb(null);
            }
        };
        const { asm } = createIsolatedInstance(null, mockFS);
        asm.debounceDelay = 5000; // 5s debounce

        asm.scheduleSync('normal-write');
        assert.notStrictEqual(asm.debounceTimer, null);

        asm.forceSyncNow('window-blur');
        assert.strictEqual(asm.debounceTimer, null);
        assert.strictEqual(syncCalled, true);
        done();
    });

    // 5. IPC Notification Verification
    await runAsyncTest('IPC Bridge: Emits save-status, save-completed, and save-flushed events', (done) => {
        let statusCalls = [];
        let completedCalls = [];
        let flushedCalls = 0;

        const mockIPC = {
            sendSaveStatus: (s) => statusCalls.push(s),
            sendSaveCompleted: (c) => completedCalls.push(c),
            sendSaveFlushed: () => flushedCalls++
        };

        const mockFS = {
            syncfs: (populate, cb) => setTimeout(() => cb(null), 10)
        };

        const { asm } = createIsolatedInstance(mockIPC, mockFS);
        asm.debounceDelay = 20;

        asm.scheduleSync('ipc-test');

        setTimeout(() => {
            try {
                assert(statusCalls.length >= 1, 'Should have sent save status');
                assert.strictEqual(completedCalls.length, 1, 'Should have sent save completed');
                assert.strictEqual(flushedCalls, 1, 'Should have sent save flushed');
                done();
            } catch (e) {
                done(e);
            }
        }, 80);
    });

    console.log(`\nTest Suite 2 Completed: ${testsPassed}/${testsTotal} Passed.`);
}

runAllTests().catch((err) => {
    console.error('Test Suite 2 encountered fatal error:', err);
    process.exit(1);
});

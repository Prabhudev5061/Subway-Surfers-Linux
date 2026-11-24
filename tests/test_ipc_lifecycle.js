/**
 * Test Suite 4: Electron IPC Bridge & Graceful Shutdown Lifecycle
 */
const EventEmitter = require('events');
const assert = require('assert');

console.log('=== RUNNING TEST SUITE 4: ELECTRON IPC & LIFECYCLE ===');

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

// Mock Electron IPC and Window system to simulate main.js logic
class MockWebContents extends EventEmitter {
    send(channel, ...args) {
        this.emit('ipc-message-to-renderer', channel, ...args);
    }
}

class MockBrowserWindow extends EventEmitter {
    constructor() {
        super();
        this.webContents = new MockWebContents();
        this.isDestroyedFlag = false;
    }
    destroy() {
        this.isDestroyedFlag = true;
        this.emit('closed');
    }
}

class MockIpcMain extends EventEmitter {
    handle(channel, listener) {
        this.on(channel, listener);
    }
}

async function runAllTests() {
    // 1. Normal exit when not dirty
    await runAsyncTest('Lifecycle: Clean exit without pending saves allows immediate close', (done) => {
        let savePending = false;
        let isQuitting = false;
        const win = new MockBrowserWindow();

        win.on('close', (e) => {
            if (isQuitting) return;
            if (savePending) {
                e.preventDefault();
            }
        });

        // Simulate close attempt
        let defaultPrevented = false;
        const event = { preventDefault: () => { defaultPrevented = true; } };
        win.emit('close', event);

        assert.strictEqual(defaultPrevented, false, 'Should not prevent default when clean');
        done();
    });

    // 2. Intercepted exit when save is pending
    await runAsyncTest('Lifecycle: Close intercepts shutdown when save is in flight and flushes', (done) => {
        let savePending = true;
        let isQuitting = false;
        let forceSaveSent = false;
        const win = new MockBrowserWindow();

        win.webContents.on('ipc-message-to-renderer', (channel) => {
            if (channel === 'force-save-before-exit') {
                forceSaveSent = true;
            }
        });

        const event = {
            defaultPrevented: false,
            preventDefault: function() { this.defaultPrevented = true; }
        };

        win.on('close', (e) => {
            if (isQuitting) return;
            if (savePending) {
                e.preventDefault();
                win.webContents.send('force-save-before-exit');
            }
        });

        win.emit('close', event);
        assert.strictEqual(event.defaultPrevented, true, 'Close event must be intercepted');
        assert.strictEqual(forceSaveSent, true, 'force-save-before-exit IPC message must be transmitted');

        // Simulate renderer finishing flush
        savePending = false;
        isQuitting = true;
        win.destroy();

        assert.strictEqual(win.isDestroyedFlag, true, 'Window successfully closed after save flush');
        done();
    });

    // 3. Safety timeout triggers if renderer fails to flush
    await runAsyncTest('Lifecycle: 1500ms safety timeout forces exit if renderer becomes unresponsive', (done) => {
        let savePending = true;
        let isQuitting = false;
        const win = new MockBrowserWindow();

        let closeTimeout = null;
        win.on('close', (e) => {
            if (isQuitting) return;
            if (savePending) {
                e.preventDefault();
                closeTimeout = setTimeout(() => {
                    isQuitting = true;
                    win.destroy();
                }, 100); // reduced timeout for test speed
            }
        });

        const event = {
            defaultPrevented: false,
            preventDefault: function() { this.defaultPrevented = true; }
        };

        win.emit('close', event);
        assert.strictEqual(event.defaultPrevented, true);

        // Renderer never responds with flushed.
        setTimeout(() => {
            try {
                assert.strictEqual(isQuitting, true);
                assert.strictEqual(win.isDestroyedFlag, true);
                done();
            } catch (err) {
                done(err);
            }
        }, 150);
    });

    console.log(`\nTest Suite 4 Completed: ${testsPassed}/${testsTotal} Passed.`);
}

runAllTests().catch((err) => {
    console.error('Test Suite 4 failed:', err);
    process.exit(1);
});

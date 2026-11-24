/**
 * Test Suite 1: Header Validation and SHA-1 Cryptographic Integrity
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

// Load AutoSaveManager
let asmPath = path.join(__dirname, '../source/autosave_manager.js');
if (!fs.existsSync(asmPath)) {
    asmPath = path.join(__dirname, '../app/autosave_manager.js');
}
const asmCode = fs.readFileSync(asmPath, 'utf8');
let mockWindow = {};
eval('(function(window) { ' + asmCode + ' })(mockWindow);');
const asm = mockWindow.AutoSaveManager;

console.log('=== RUNNING TEST SUITE 1: HEADER & SHA-1 INTEGRITY ===');

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
    testsTotal++;
    try {
        fn();
        console.log(`[PASS] ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`[FAIL] ${name}:`, err.message);
        throw err;
    }
}

// 1. SHA-1 Algorithm verification with standard test vectors
runTest('SHA-1 Standard Vector: empty string', () => {
    const input = new Uint8Array(0);
    const expected = crypto.createHash('sha1').update(input).digest('hex');
    const actual = asm.bytesToHex(asm.computeSha1(input));
    assert.strictEqual(actual, expected);
});

runTest('SHA-1 Standard Vector: "The quick brown fox jumps over the lazy dog"', () => {
    const input = Buffer.from('The quick brown fox jumps over the lazy dog');
    const expected = crypto.createHash('sha1').update(input).digest('hex');
    const actual = asm.bytesToHex(asm.computeSha1(new Uint8Array(input)));
    assert.strictEqual(actual, expected);
    assert.strictEqual(actual, '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12');
});

runTest('SHA-1 Standard Vector: 1MB repeating buffer', () => {
    const input = Buffer.alloc(1024 * 1024, 0x5a);
    const expected = crypto.createHash('sha1').update(input).digest('hex');
    const actual = asm.bytesToHex(asm.computeSha1(new Uint8Array(input)));
    assert.strictEqual(actual, expected);
});

// 2. Real Save File Fixture Verification
const realSavePath = path.resolve(__dirname, '../../analysis/evidence/save_PlayerPrefs.bin');
let realSaveBuf = null;

if (fs.existsSync(realSavePath)) {
    realSaveBuf = fs.readFileSync(realSavePath);

    runTest('Real Save Fixture: Header and SHA-1 Validation', () => {
        const result = asm.verifyHeaderAndSha1(new Uint8Array(realSaveBuf));
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.payloadLength, realSaveBuf.length - 28);
        assert.strictEqual(result.headerSha1, result.computedSha1);
    });

    runTest('Real Save Fixture: Node crypto vs AutoSaveManager bit-level match', () => {
        const payload = realSaveBuf.subarray(28);
        const nodeSha1 = crypto.createHash('sha1').update(payload).digest('hex');
        const jsSha1 = asm.bytesToHex(asm.computeSha1(new Uint8Array(payload)));
        assert.strictEqual(jsSha1, nodeSha1);
    });
} else {
    console.warn('[WARN] Real save fixture not found at ' + realSavePath);
}

// 3. Header Edge Cases and Corruption Detection
runTest('Corrupted Header: Buffer too short (<28 bytes)', () => {
    const shortBuf = new Uint8Array(20);
    const result = asm.verifyHeaderAndSha1(shortBuf);
    assert.strictEqual(result.valid, false);
    assert(result.reason.includes('File too small'));
});

runTest('Corrupted Header: Invalid hash length magic (expected 20)', () => {
    const corruptBuf = Buffer.from(realSaveBuf ? realSaveBuf : Buffer.alloc(100));
    corruptBuf.writeUInt32LE(16, 0); // Alter hash length field
    const result = asm.verifyHeaderAndSha1(new Uint8Array(corruptBuf));
    assert.strictEqual(result.valid, false);
    assert(result.reason.includes('Invalid hash length field'));
});

runTest('Corrupted Header: Payload length mismatch', () => {
    const corruptBuf = Buffer.from(realSaveBuf ? realSaveBuf : Buffer.alloc(100));
    corruptBuf.writeUInt32LE(99999, 24); // Tamper payload length
    const result = asm.verifyHeaderAndSha1(new Uint8Array(corruptBuf));
    assert.strictEqual(result.valid, false);
    assert(result.reason.includes('Payload length mismatch'));
});

runTest('Corrupted Header: Bit flip in SHA-1 checksum', () => {
    const corruptBuf = Buffer.from(realSaveBuf ? realSaveBuf : Buffer.alloc(100));
    corruptBuf[10] ^= 0xff; // Flip bits in stored SHA-1
    const result = asm.verifyHeaderAndSha1(new Uint8Array(corruptBuf));
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, 'SHA-1 checksum mismatch');
});

runTest('Corrupted Header: Bit flip in BSON payload', () => {
    const corruptBuf = Buffer.from(realSaveBuf ? realSaveBuf : Buffer.alloc(100));
    corruptBuf[50] ^= 0x01; // Flip byte in payload
    const result = asm.verifyHeaderAndSha1(new Uint8Array(corruptBuf));
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.reason, 'SHA-1 checksum mismatch');
});

console.log(`\nTest Suite 1 Completed: ${testsPassed}/${testsTotal} Passed.`);

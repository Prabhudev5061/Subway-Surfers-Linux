/**
 * Shared SHA-1 & Kiloo BsonFileSaver 28-byte Header Validator / Encoder
 * Works identically in Node.js (Electron Main) and Browser (Renderer).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SubwaySha1Header = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var HEADER_SIZE = 28;
    var EXPECTED_HASH_LEN = 20;

    function toUint8Array(bytes) {
        if (!bytes) return null;
        if (bytes instanceof Uint8Array) return bytes;
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(bytes)) {
            return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        }
        if (typeof ArrayBuffer !== 'undefined') {
            if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
            if (ArrayBuffer.isView(bytes)) {
                return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            }
        }
        if (Array.isArray(bytes)) return new Uint8Array(bytes);
        return null;
    }

    function computeSha1(input) {
        var bytes = typeof input === 'string'
            ? new TextEncoder().encode(input)
            : toUint8Array(input);
        if (!bytes) throw new TypeError('computeSha1 requires Uint8Array, Buffer, or string');

        var len = bytes.length;
        var bitLen = len * 8;
        var paddedLen = (((len + 8) >> 6) + 1) << 6;
        var words = new Uint32Array(paddedLen >> 2);
        var i, j;

        for (i = 0; i < len; i++) {
            words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
        }
        words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
        words[words.length - 1] = bitLen & 0xffffffff;
        words[words.length - 2] = Math.floor(bitLen / 0x100000000);

        var w = new Uint32Array(80);
        var a = 0x67452301;
        var b = 0xefcdab89;
        var c = 0x98badcfe;
        var d = 0x10325476;
        var e = 0xc3d2e1f0;

        for (i = 0; i < words.length; i += 16) {
            for (j = 0; j < 16; j++) w[j] = words[i + j];
            for (j = 16; j < 80; j++) {
                var val = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
                w[j] = (val << 1) | (val >>> 31);
            }
            var A = a, B = b, C = c, D = d, E = e;
            for (j = 0; j < 80; j++) {
                var f, k;
                if (j < 20) {
                    f = (B & C) | (~B & D);
                    k = 0x5a827999;
                } else if (j < 40) {
                    f = B ^ C ^ D;
                    k = 0x6ed9eba1;
                } else if (j < 60) {
                    f = (B & C) | (B & D) | (C & D);
                    k = 0x8f1bbcdc;
                } else {
                    f = B ^ C ^ D;
                    k = 0xca62c1d6;
                }
                var temp = (((A << 5) | (A >>> 27)) + f + E + k + w[j]) & 0xffffffff;
                E = D;
                D = C;
                C = (B << 30) | (B >>> 2);
                B = A;
                A = temp;
            }
            a = (a + A) & 0xffffffff;
            b = (b + B) & 0xffffffff;
            c = (c + C) & 0xffffffff;
            d = (d + D) & 0xffffffff;
            e = (e + E) & 0xffffffff;
        }

        var result = new Uint8Array(20);
        var h = [a, b, c, d, e];
        for (i = 0; i < 5; i++) {
            result[i * 4] = (h[i] >>> 24) & 0xff;
            result[i * 4 + 1] = (h[i] >>> 16) & 0xff;
            result[i * 4 + 2] = (h[i] >>> 8) & 0xff;
            result[i * 4 + 3] = h[i] & 0xff;
        }
        return result;
    }

    function bytesToHex(uint8Array) {
        var bytes = toUint8Array(uint8Array);
        if (!bytes) return '';
        var hex = '';
        for (var i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, '0');
        }
        return hex;
    }

    function verifyHeaderAndSha1(input) {
        var bytes = toUint8Array(input);
        if (!bytes) {
            return { valid: false, reason: 'Invalid byte array buffer' };
        }
        if (bytes.byteLength < HEADER_SIZE) {
            return { valid: false, reason: 'File too small (' + bytes.byteLength + ' bytes)' };
        }
        try {
            var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            var hashLen = view.getUint32(0, true);
            if (hashLen !== EXPECTED_HASH_LEN) {
                return { valid: false, reason: 'Invalid hash length field: ' + hashLen };
            }
            var expectedSha1 = bytes.subarray(4, 24);
            var payloadLen = view.getUint32(24, true);
            var actualPayloadLen = bytes.length - HEADER_SIZE;
            if (payloadLen !== actualPayloadLen) {
                return {
                    valid: false,
                    reason: 'Payload length mismatch (header: ' + payloadLen + ', actual: ' + actualPayloadLen + ')'
                };
            }
            var payload = bytes.subarray(HEADER_SIZE);
            var computedSha1 = computeSha1(payload);
            var match = true;
            for (var i = 0; i < EXPECTED_HASH_LEN; i++) {
                if (expectedSha1[i] !== computedSha1[i]) {
                    match = false;
                    break;
                }
            }
            return {
                valid: match,
                headerSha1: bytesToHex(expectedSha1),
                computedSha1: bytesToHex(computedSha1),
                payloadLength: payloadLen,
                reason: match ? 'OK' : 'SHA-1 checksum mismatch'
            };
        } catch (err) {
            return { valid: false, reason: 'Header parse exception: ' + err.message };
        }
    }

    function wrapWithSha1Header(payloadBytes) {
        var payload = toUint8Array(payloadBytes);
        if (!payload) throw new TypeError('wrapWithSha1Header requires byte array');
        var digest = computeSha1(payload);
        var out = new Uint8Array(HEADER_SIZE + payload.length);
        var view = new DataView(out.buffer);
        view.setUint32(0, EXPECTED_HASH_LEN, true);
        out.set(digest, 4);
        view.setUint32(24, payload.length, true);
        out.set(payload, HEADER_SIZE);
        return out;
    }

    function verifyPlayerPrefsHeader(input) {
        var bytes = toUint8Array(input);
        if (!bytes || bytes.length < 8) {
            return { valid: false, reason: 'PlayerPrefs too small (' + (bytes ? bytes.length : 0) + ' bytes)' };
        }
        // Magic: "UnityPrf"
        var magic = [0x55, 0x6e, 0x69, 0x74, 0x79, 0x50, 0x72, 0x66];
        for (var i = 0; i < magic.length; i++) {
            if (bytes[i] !== magic[i]) {
                return { valid: false, reason: 'Missing UnityPrf magic header' };
            }
        }
        return { valid: true, reason: 'OK' };
    }

    return {
        HEADER_SIZE: HEADER_SIZE,
        EXPECTED_HASH_LEN: EXPECTED_HASH_LEN,
        toUint8Array: toUint8Array,
        computeSha1: computeSha1,
        bytesToHex: bytesToHex,
        verifyHeaderAndSha1: verifyHeaderAndSha1,
        wrapWithSha1Header: wrapWithSha1Header,
        verifyPlayerPrefsHeader: verifyPlayerPrefsHeader
    };
}));

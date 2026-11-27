/**
 * Unified AutoSave & Synchronization Manager (SubwaySurfers-Linux)
 *
 * Shared by both San Francisco and Beijing:
 * - Pure-JS synchronous SHA-1 and 28-byte Kiloo BsonFileSaver header validation
 * - Non-invasive FS.close & FS.rename hooks
 * - MEMFS node timestamp updates for reliable sync reconciliation
 * - Startup crash recovery from _old backups
 * - Single-flight debounced FS.syncfs (routed through HostIDBFS to shared Save/)
 * - Non-blocking graceful flush on window close / exit via Electron IPC
 */
(function (globalScope) {
    'use strict';

    var shaHelper = globalScope.SubwaySha1Header || null;

    function computeSha1Fallback(bytes) {
        if (shaHelper) return shaHelper.computeSha1(bytes);
        if (typeof bytes === 'string') bytes = new TextEncoder().encode(bytes);
        var len = bytes.length;
        var bitLen = len * 8;
        var paddedLen = (((len + 8) >> 6) + 1) << 6;
        var words = new Uint32Array(paddedLen >> 2);
        var i, j;
        for (i = 0; i < len; i++) words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
        words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
        words[words.length - 1] = bitLen & 0xffffffff;
        words[words.length - 2] = Math.floor(bitLen / 0x100000000);
        var w = new Uint32Array(80);
        var a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476, e = 0xc3d2e1f0;
        for (i = 0; i < words.length; i += 16) {
            for (j = 0; j < 16; j++) w[j] = words[i + j];
            for (j = 16; j < 80; j++) {
                var val = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
                w[j] = (val << 1) | (val >>> 31);
            }
            var A = a, B = b, C = c, D = d, E = e;
            for (j = 0; j < 80; j++) {
                var f, k;
                if (j < 20) { f = (B & C) | (~B & D); k = 0x5a827999; }
                else if (j < 40) { f = B ^ C ^ D; k = 0x6ed9eba1; }
                else if (j < 60) { f = (B & C) | (B & D) | (C & D); k = 0x8f1bbcdc; }
                else { f = B ^ C ^ D; k = 0xca62c1d6; }
                var temp = (((A << 5) | (A >>> 27)) + f + E + k + w[j]) & 0xffffffff;
                E = D; D = C; C = (B << 30) | (B >>> 2); B = A; A = temp;
            }
            a = (a + A) & 0xffffffff; b = (b + B) & 0xffffffff;
            c = (c + C) & 0xffffffff; d = (d + D) & 0xffffffff; e = (e + E) & 0xffffffff;
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
        if (shaHelper) return shaHelper.bytesToHex(uint8Array);
        var hex = '';
        for (var i = 0; i < uint8Array.length; i++) {
            hex += uint8Array[i].toString(16).padStart(2, '0');
        }
        return hex;
    }

    function getIpcBridge() {
        if (typeof globalScope === 'undefined') return null;
        return globalScope.subwayIPC || globalScope.beijingIPC || null;
    }

    function isSavePath(fullPath) {
        if (!fullPath || typeof fullPath !== 'string') return false;
        var fileName = fullPath.split('/').pop();
        return (
            fileName === 'PlayerPrefs' ||
            fileName === 'local' ||
            fileName === 'cloud' ||
            fileName === 'local_new' ||
            fileName === 'cloud_new' ||
            fileName === 'local_old' ||
            fileName === 'cloud_old' ||
            fullPath.indexOf('/Save/') !== -1
        );
    }

    var AutoSaveManager = {
        VERSION: '4.0.0-unified-shared',
        DEBUG: true,
        FS: null,
        computeSha1: computeSha1Fallback,
        bytesToHex: bytesToHex,

        isSyncing: false,
        pendingSync: false,
        dirty: false,
        isInternalOperation: false,
        saveSequenceId: 0,
        retryCount: 0,
        maxRetries: 3,
        debounceDelay: 150,
        debounceTimer: null,
        watchdogTimer: null,
        completionCallbacks: [],
        _hookedFs: null,
        _listenersAttached: false,

        log: function (msg, data) {
            if (!this.DEBUG) return;
            if (data !== undefined) console.log('[AutoSaveManager] ' + msg, data);
            else console.log('[AutoSaveManager] ' + msg);
        },

        warn: function (msg, data) {
            if (data !== undefined) console.warn('[AutoSaveManager WARNING] ' + msg, data);
            else console.warn('[AutoSaveManager WARNING] ' + msg);
        },

        error: function (msg, data) {
            if (data !== undefined) console.error('[AutoSaveManager ERROR] ' + msg, data);
            else console.error('[AutoSaveManager ERROR] ' + msg);
        },

        verifyHeaderAndSha1: function (bytes) {
            if (shaHelper) return shaHelper.verifyHeaderAndSha1(bytes);
            if (!bytes || !(bytes instanceof Uint8Array || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(bytes)))) {
                return { valid: false, reason: 'Invalid byte array buffer' };
            }
            if (!bytes.buffer || typeof bytes.byteLength !== 'number' || bytes.byteLength < 28) {
                return { valid: false, reason: 'File too small (' + (bytes ? bytes.byteLength : 0) + ' bytes)' };
            }
            try {
                var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                var hashLen = view.getUint32(0, true);
                if (hashLen !== 20) return { valid: false, reason: 'Invalid hash length field: ' + hashLen };
                var expectedSha1 = bytes.subarray(4, 24);
                var payloadLen = view.getUint32(24, true);
                if (payloadLen !== bytes.length - 28) {
                    return { valid: false, reason: 'Payload length mismatch' };
                }
                var computedSha1 = computeSha1Fallback(bytes.subarray(28));
                for (var i = 0; i < 20; i++) {
                    if (expectedSha1[i] !== computedSha1[i]) {
                        return { valid: false, reason: 'SHA-1 checksum mismatch' };
                    }
                }
                return {
                    valid: true,
                    headerSha1: bytesToHex(expectedSha1),
                    computedSha1: bytesToHex(computedSha1),
                    payloadLength: payloadLen,
                    reason: 'OK'
                };
            } catch (err) {
                return { valid: false, reason: 'Header parse exception: ' + err.message };
            }
        },

        wrapWithSha1Header: function (payloadBytes) {
            if (shaHelper) return shaHelper.wrapWithSha1Header(payloadBytes);
            var payload = payloadBytes instanceof Uint8Array ? payloadBytes : new Uint8Array(payloadBytes);
            var digest = computeSha1Fallback(payload);
            var out = new Uint8Array(28 + payload.length);
            var view = new DataView(out.buffer);
            view.setUint32(0, 20, true);
            out.set(digest, 4);
            view.setUint32(24, payload.length, true);
            out.set(payload, 28);
            return out;
        },

        touchNode: function (node) {
            if (!node) return;
            var now = Date.now();
            node.timestamp = Math.max(now, (node.timestamp || 0) + 1000);
        },

        hookFilesystem: function (fs) {
            if (!fs || this._hookedFs === fs) return;
            var self = this;

            if (typeof fs.close === 'function' && !fs._autosaveCloseHooked && !fs._autosaveNativeHooks) {
                var origClose = fs.close.bind(fs);
                fs.close = function (stream) {
                    var closedNode = stream ? stream.node : null;
                    var closedPath = null;
                    try {
                        closedPath = (stream && stream.path) || (closedNode && typeof fs.getPath === 'function' ? fs.getPath(closedNode) : null);
                    } catch (pErr) {}
                    var res = origClose(stream);
                    try {
                        if (closedPath && closedNode) self.onFileClosed(closedPath, closedNode);
                    } catch (e) {}
                    return res;
                };
                fs._autosaveCloseHooked = true;
            }

            if (typeof fs.rename === 'function' && !fs._autosaveRenameHooked && !fs._autosaveNativeHooks) {
                var origRename = fs.rename.bind(fs);
                fs.rename = function (oldPath, newPath) {
                    var res = origRename(oldPath, newPath);
                    try {
                        if (fs.analyzePath && fs.analyzePath(newPath).exists) {
                            var lookup = fs.lookupPath(newPath);
                            if (lookup && lookup.node) self.onFileRenamed(oldPath, newPath, lookup.node);
                        }
                    } catch (e) {}
                    return res;
                };
                fs._autosaveRenameHooked = true;
            }

            this.FS = fs;
            this._hookedFs = fs;
            this.log('Filesystem hooks attached.');
        },

        onFileClosed: function (fullPath, node) {
            if (this.isInternalOperation || !fullPath || !node) return;
            try {
                if (node.isFolder || (node.mode && ((node.mode & 0x4000) === 0x4000))) return;
                if (!isSavePath(fullPath)) return;

                this.touchNode(node);
                this.dirty = true;
                var fileName = fullPath.split('/').pop();

                if (node.contents && node.contents.byteLength >= 28 && fileName !== 'PlayerPrefs') {
                    var v = this.verifyHeaderAndSha1(node.contents);
                    if (v.valid) {
                        this.log('Verified save integrity on close (' + fileName + '): ' + v.computedSha1);
                    }
                }
                this.scheduleSync('file-closed: ' + fileName);
            } catch (err) {
                this.error('Error processing onFileClosed:', err);
            }
        },

        onFileRenamed: function (oldPath, newPath, node) {
            if (this.isInternalOperation || !newPath || !node) return;
            try {
                if (!isSavePath(newPath)) return;
                var fileName = newPath.split('/').pop();
                this.log('Detected atomic save commit via rename: ' + oldPath + ' -> ' + newPath);
                this.touchNode(node);
                this.dirty = true;

                if (node.contents && node.contents.byteLength >= 28 && fileName !== 'PlayerPrefs') {
                    var v = this.verifyHeaderAndSha1(node.contents);
                    if (v.valid) {
                        this.log('Verified committed save integrity (' + fileName + '): ' + v.computedSha1);
                    }
                }
                this.scheduleSync('file-renamed: ' + fileName);
            } catch (err) {
                this.error('Error processing onFileRenamed:', err);
            }
        },

        scheduleSync: function (reason) {
            var self = this;
            this.dirty = true;
            if (this.debounceTimer) clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(function () {
                self.debounceTimer = null;
                self.processSync(reason);
            }, this.debounceDelay);

            var ipc = getIpcBridge();
            if (ipc && typeof ipc.sendSaveStatus === 'function') {
                ipc.sendSaveStatus({ syncing: self.isSyncing, dirty: true, reason: reason });
            }
        },

        forceSyncNow: function (reason, callback) {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = null;
            }
            this.dirty = true;
            this.processSync(reason, callback);
        },

        listHashDirectories: function (fs) {
            if (!fs || !fs.analyzePath || !fs.readdir) return [];
            if (!fs.analyzePath('/idbfs').exists) return [];
            var entries = fs.readdir('/idbfs');
            var hashes = [];
            for (var i = 0; i < entries.length; i++) {
                var e = entries[i];
                if (e !== '.' && e !== '..' && /^[a-f0-9]{32}$/i.test(e)) {
                    hashes.push(e);
                }
            }
            return hashes;
        },

        recoverCorruptedSaves: function (fs) {
            var recovered = [];
            this.isInternalOperation = true;
            try {
                var hashDirs = this.listHashDirectories(fs);
                var pairs = [
                    ['Save/cloud', 'Save/cloud_old'],
                    ['Save/local', 'Save/local_old']
                ];
                for (var h = 0; h < hashDirs.length; h++) {
                    var base = '/idbfs/' + hashDirs[h] + '/';
                    for (var p = 0; p < pairs.length; p++) {
                        var primaryPath = base + pairs[p][0];
                        var backupPath = base + pairs[p][1];
                        var primaryValid = false;
                        if (fs.analyzePath(primaryPath).exists) {
                            try {
                                primaryValid = this.verifyHeaderAndSha1(fs.readFile(primaryPath)).valid;
                            } catch (e1) {}
                        }
                        if (!primaryValid && fs.analyzePath(backupPath).exists) {
                            try {
                                var bBytes = fs.readFile(backupPath);
                                if (this.verifyHeaderAndSha1(bBytes).valid) {
                                    fs.writeFile(primaryPath, bBytes);
                                    var lk = fs.lookupPath(primaryPath);
                                    if (lk && lk.node) this.touchNode(lk.node);
                                    recovered.push(primaryPath);
                                    this.warn('Recovered corrupted primary save from valid backup: ' + primaryPath);
                                }
                            } catch (e2) {}
                        }
                    }
                }
            } finally {
                this.isInternalOperation = false;
            }
            return recovered;
        },

        ensureMirroredSaves: function (fs) {
            this.isInternalOperation = true;
            try {
                var hashDirs = this.listHashDirectories(fs);
                if (hashDirs.length < 2) return;
                var subpaths = ['Save/cloud', 'Save/local', 'Save/cloud_old', 'Save/local_old', 'PlayerPrefs'];
                for (var s = 0; s < subpaths.length; s++) {
                    var sub = subpaths[s];
                    var bestDir = null, bestBytes = null, bestTime = 0;
                    for (var h = 0; h < hashDirs.length; h++) {
                        var dir = hashDirs[h];
                        var fp = '/idbfs/' + dir + '/' + sub;
                        try {
                            if (!fs.analyzePath(fp).exists) continue;
                            var st = fs.stat(fp);
                            var mtime = (st && st.mtime) ? st.mtime.getTime() : 0;
                            var bytes = fs.readFile(fp);
                            if (!bytes || bytes.length === 0) continue;
                            if (sub !== 'PlayerPrefs' && !this.verifyHeaderAndSha1(bytes).valid) continue;
                            if (!bestBytes || mtime > bestTime) {
                                bestDir = dir; bestBytes = bytes; bestTime = mtime;
                            }
                        } catch (eRead) {}
                    }
                    if (bestBytes) {
                        for (var t = 0; t < hashDirs.length; t++) {
                            var targetDir = hashDirs[t];
                            if (targetDir === bestDir) continue;
                            var targetPath = '/idbfs/' + targetDir + '/' + sub;
                            try {
                                if (sub.indexOf('/') !== -1) {
                                    var parentDir = '/idbfs/' + targetDir + '/' + sub.split('/')[0];
                                    if (!fs.analyzePath(parentDir).exists) fs.mkdir(parentDir);
                                }
                                var curTime = 0;
                                if (fs.analyzePath(targetPath).exists) {
                                    var cst = fs.stat(targetPath);
                                    curTime = (cst && cst.mtime) ? cst.mtime.getTime() : 0;
                                }
                                if (curTime < bestTime) {
                                    fs.writeFile(targetPath, bestBytes);
                                    var lk = fs.lookupPath(targetPath);
                                    if (lk && lk.node) lk.node.timestamp = bestTime || Date.now();
                                }
                            } catch (eWrite) {}
                        }
                    }
                }
            } finally {
                this.isInternalOperation = false;
            }
        },

        touchAllSaveNodes: function (fs) {
            try {
                var hashDirs = this.listHashDirectories(fs);
                var now = Date.now();
                for (var i = 0; i < hashDirs.length; i++) {
                    var base = '/idbfs/' + hashDirs[i];
                    var targets = [
                        base + '/PlayerPrefs',
                        base + '/Save/cloud',
                        base + '/Save/local',
                        base + '/Save/cloud_old',
                        base + '/Save/local_old'
                    ];
                    for (var t = 0; t < targets.length; t++) {
                        try {
                            if (fs.analyzePath(targets[t]).exists) {
                                var lookup = fs.lookupPath(targets[t]);
                                if (lookup && lookup.node) {
                                    lookup.node.timestamp = Math.max(now, (lookup.node.timestamp || 0) + 1000);
                                }
                            }
                        } catch (pErr) {}
                    }
                }
            } catch (err) {}
        },

        processSync: function (triggerReason, callback) {
            var self = this;
            var fs = self.FS || (typeof FS !== 'undefined' ? FS : null);

            if (typeof callback === 'function') self.completionCallbacks.push(callback);
            if (!fs || typeof fs.syncfs !== 'function') {
                self.warn('FS.syncfs is not yet available in runtime');
                var missingFsCbs = self.completionCallbacks.slice();
                self.completionCallbacks = [];
                for (var m = 0; m < missingFsCbs.length; m++) {
                    try { missingFsCbs[m](new Error('FS.syncfs unavailable')); } catch (e) {}
                }
                return;
            }
            if (self.isSyncing) {
                self.pendingSync = true;
                return;
            }

            self.isSyncing = true;
            self.dirty = false;
            var startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

            self.ensureMirroredSaves(fs);
            self.touchAllSaveNodes(fs);

            fs.syncfs(false, function (err) {
                var endTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                var duration = Math.round(endTime - startTime);
                var ipc = getIpcBridge();

                if (err) {
                    self.error('Shared save sync failed (' + duration + 'ms):', err);
                    self.dirty = true;
                    if (self.retryCount < self.maxRetries) {
                        self.retryCount++;
                        var retryDelay = self.retryCount * 250;
                        setTimeout(function () {
                            self.isSyncing = false;
                            self.processSync('retry-' + self.retryCount);
                        }, retryDelay);
                        return;
                    }
                    self.error('Max synchronization retries exceeded.');
                } else {
                    self.retryCount = 0;
                    self.saveSequenceId++;
                    self.log('Shared save sync succeeded (' + duration + 'ms, seq: ' + self.saveSequenceId + ')');
                    if (ipc && typeof ipc.sendSaveCompleted === 'function') {
                        ipc.sendSaveCompleted({
                            sequenceId: self.saveSequenceId,
                            durationMs: duration,
                            reason: triggerReason,
                            timestamp: Date.now()
                        });
                    }
                }

                self.isSyncing = false;
                if (self.pendingSync) {
                    self.pendingSync = false;
                    self.processSync('pending-drained');
                } else {
                    if (ipc && typeof ipc.sendSaveStatus === 'function') {
                        ipc.sendSaveStatus({ syncing: false, dirty: self.dirty, idle: true });
                    }
                    if (ipc && typeof ipc.sendSaveFlushed === 'function') {
                        ipc.sendSaveFlushed();
                    }
                }

                var callbacks = self.completionCallbacks.slice();
                self.completionCallbacks = [];
                for (var c = 0; c < callbacks.length; c++) {
                    try { callbacks[c](err); } catch (cbErr) { self.error('Completion callback error:', cbErr); }
                }
            });
        },

        forceFlushAndExit: function () {
            var self = this;
            if (self.debounceTimer) {
                clearTimeout(self.debounceTimer);
                self.debounceTimer = null;
            }
            var ipc = getIpcBridge();
            var onFlushed = function () {
                if (ipc && typeof ipc.sendSaveFlushed === 'function') {
                    ipc.sendSaveFlushed();
                }
            };

            if (!self.FS || typeof self.FS.syncfs !== 'function') {
                onFlushed();
                return;
            }
            self.dirty = true;
            if (self.isSyncing) {
                self.pendingSync = true;
                self.completionCallbacks.push(onFlushed);
            } else {
                self.processSync('application-exit-flush', onFlushed);
            }
        },

        onMountComplete: function (fsInstance) {
            var fs = fsInstance || (typeof FS !== 'undefined' ? FS : null);
            this.hookFilesystem(fs);
            if (fs) {
                this.recoverCorruptedSaves(fs);
                this.ensureMirroredSaves(fs);
            }
            this.setupLifecycleListeners();
        },

        setupLifecycleListeners: function () {
            if (this._listenersAttached || typeof window === 'undefined') return;
            this._listenersAttached = true;
            var self = this;

            window.addEventListener('blur', function () {
                if (self.dirty || self.debounceTimer) self.forceSyncNow('window-blur');
            });
            if (typeof document !== 'undefined') {
                document.addEventListener('visibilitychange', function () {
                    if (document.hidden && (self.dirty || self.debounceTimer)) {
                        self.forceSyncNow('visibility-hidden');
                    }
                });
            }
            window.addEventListener('beforeunload', function () {
                if (self.dirty || self.debounceTimer) self.forceSyncNow('beforeunload');
            });
            window.addEventListener('pagehide', function () {
                if (self.dirty || self.debounceTimer) self.forceSyncNow('pagehide');
            });

            var ipc = getIpcBridge();
            if (ipc && typeof ipc.onForceSave === 'function') {
                ipc.onForceSave(function () {
                    self.forceFlushAndExit();
                });
            }

            if (!self.watchdogTimer) {
                self.watchdogTimer = setInterval(function () {
                    if (self.dirty || self.debounceTimer) {
                        self.forceSyncNow('watchdog-timer');
                    }
                }, 2500);
            }
        }
    };

    globalScope.AutoSaveManager = AutoSaveManager;
})(typeof window !== 'undefined' ? window : globalThis);

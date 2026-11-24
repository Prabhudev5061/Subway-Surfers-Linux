/**
 * Subway Surfers Linux - Dedicated AutoSave & Synchronization Manager
 * 
 * Provides reliable, event-based automatic persistence for player progress:
 * - Intercepts C# BsonFileSaver writes and atomic renames at the virtual filesystem layer
 * - Validates 28-byte SHA-1 integrity header and BSON payload
 * - Updates node timestamps so IDBFS reconciliation reliably syncs to IndexedDB
 * - Coalesces and debounces rapid sequential writes
 * - Mirrors save progress across all mounted URL hashes (/idbfs/9ca1650c... and others)
 * - Guarantees non-blocking clean flush on application shutdown via Electron IPC
 */

(function(window) {
    'use strict';

    // Pure JavaScript SHA-1 Implementation (Synchronous)
    function computeSha1(bytes) {
        if (typeof bytes === 'string') {
            bytes = new TextEncoder().encode(bytes);
        }
        var len = bytes.length;
        var bitLen = len * 8;
        var paddedLen = ((len + 8 >> 6) + 1) << 6;
        var words = new Uint32Array(paddedLen >> 2);
        for (var i = 0; i < len; i++) {
            words[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
        }
        words[len >> 2] |= 0x80 << (24 - (len % 4) * 8);
        words[words.length - 1] = bitLen & 0xffffffff;
        words[words.length - 2] = Math.floor(bitLen / 0x100000000);

        var w = new Uint32Array(80);
        var a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476, e = 0xc3d2e1f0;

        for (var i = 0; i < words.length; i += 16) {
            for (var j = 0; j < 16; j++) w[j] = words[i + j];
            for (var j = 16; j < 80; j++) {
                var val = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
                w[j] = (val << 1) | (val >>> 31);
            }

            var A = a, B = b, C = c, D = d, E = e;
            for (var j = 0; j < 80; j++) {
                var f, k;
                if (j < 20) { f = (B & C) | (~B & D); k = 0x5a827999; }
                else if (j < 40) { f = B ^ C ^ D; k = 0x6ed9eba1; }
                else if (j < 60) { f = (B & C) | (B & D) | (C & D); k = 0x8f1bbcdc; }
                else { f = B ^ C ^ D; k = 0xca62c1d6; }

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
        for (var i = 0; i < 5; i++) {
            result[i * 4] = (h[i] >>> 24) & 0xff;
            result[i * 4 + 1] = (h[i] >>> 16) & 0xff;
            result[i * 4 + 2] = (h[i] >>> 8) & 0xff;
            result[i * 4 + 3] = h[i] & 0xff;
        }
        return result;
    }

    function bytesToHex(uint8Array) {
        var hex = '';
        for (var i = 0; i < uint8Array.length; i++) {
            hex += uint8Array[i].toString(16).padStart(2, '0');
        }
        return hex;
    }

    var AutoSaveManager = {
        VERSION: '2.0.0-autosave-fixed',
        DEBUG: true,
        CANONICAL_HASH: '9ca1650cb5772c831cf4ccc5f0517c30',
        FS: null,
        computeSha1: computeSha1,
        bytesToHex: bytesToHex,

        // State machine
        isSyncing: false,
        pendingSync: false,
        dirty: false,
        isInternalOperation: false,
        saveSequenceId: 0,
        retryCount: 0,
        maxRetries: 3,
        debounceDelay: 150, // ms
        debounceTimer: null,
        watchdogTimer: null,
        completionCallbacks: [],

        log: function(msg, data) {
            if (!this.DEBUG) return;
            var text = '[AutoSaveManager] ' + msg;
            if (data !== undefined) {
                console.log(text, data);
            } else {
                console.log(text);
            }
        },

        warn: function(msg, data) {
            var text = '[AutoSaveManager WARNING] ' + msg;
            if (data !== undefined) {
                console.warn(text, data);
            } else {
                console.warn(text);
            }
        },

        error: function(msg, data) {
            var text = '[AutoSaveManager ERROR] ' + msg;
            if (data !== undefined) {
                console.error(text, data);
            } else {
                console.error(text);
            }
        },

        /**
         * Verifies the 28-byte binary integrity header of a save file.
         */
        verifyHeaderAndSha1: function(bytes) {
            if (!bytes || !(bytes instanceof Uint8Array || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(bytes)))) {
                return { valid: false, reason: 'Invalid byte array buffer' };
            }

            if (!bytes.buffer || typeof bytes.byteLength !== 'number' || bytes.byteLength < 28) {
                return { valid: false, reason: 'File too small (' + (bytes ? bytes.byteLength : 0) + ' bytes)' };
            }

            try {
                var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                var hashLen = view.getUint32(0, true);
                if (hashLen !== 20) {
                    return { valid: false, reason: 'Invalid hash length field: ' + hashLen };
                }

                var expectedSha1 = bytes.subarray(4, 24);
                var payloadLen = view.getUint32(24, true);
                var actualPayloadLen = bytes.length - 28;

                if (payloadLen !== actualPayloadLen) {
                    return {
                        valid: false,
                        reason: 'Payload length mismatch (header: ' + payloadLen + ', actual: ' + actualPayloadLen + ')'
                    };
                }

                var payload = bytes.subarray(28);
                var computedSha1 = computeSha1(payload);
                var match = true;
                for (var i = 0; i < 20; i++) {
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
        },

        /**
         * Touches node timestamp to guarantee IDBFS.reconcile recognizes it is newer than IndexedDB.
         */
        touchNode: function(node) {
            if (!node) return;
            var now = Date.now();
            node.timestamp = Math.max(now, (node.timestamp || 0) + 1000);
        },

        /**
         * Invoked whenever FS.close() closes a stream in the virtual filesystem.
         */
        onFileClosed: function(fullPath, node) {
            if (this.isInternalOperation) return;
            try {
                if (!fullPath || !node) return;

                // Ignore directories
                if (node.isFolder || (node.mode && ((node.mode & 0x4000) === 0x4000))) {
                    return;
                }

                var fileName = fullPath.split('/').pop();

                // Check if this is a save target
                var isSaveTarget = (fileName === 'PlayerPrefs' || fileName === 'local' || fileName === 'cloud' ||
                                    fileName === 'local_new' || fileName === 'cloud_new' ||
                                    fileName === 'local_old' || fileName === 'cloud_old' ||
                                    fullPath.indexOf('/Save/') !== -1);
                if (!isSaveTarget) {
                    return;
                }

                this.touchNode(node);
                this.dirty = true;

                var contents = node.contents;
                if (contents && (contents instanceof Uint8Array || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(contents)))) {
                    var verification = this.verifyHeaderAndSha1(contents);
                    if (verification.valid) {
                        this.log('Verified save integrity on close (' + fileName + '): SHA-1 ' + verification.computedSha1);
                    }
                }

                this.scheduleSync('file-closed: ' + fileName);
            } catch (err) {
                this.error('Error processing onFileClosed:', err);
            }
        },

        /**
         * Invoked on FS.rename() - catches atomic save commits (local_new -> local, cloud_new -> cloud).
         */
        onFileRenamed: function(oldPath, newPath, node) {
            if (this.isInternalOperation) return;
            try {
                if (!newPath || !node) return;

                var fileName = newPath.split('/').pop();
                var isSaveTarget = (fileName === 'PlayerPrefs' || fileName === 'local' || fileName === 'cloud' ||
                                    newPath.indexOf('/Save/') !== -1);
                if (!isSaveTarget) {
                    return;
                }

                this.log('Detected atomic save commit via rename: ' + oldPath + ' -> ' + newPath);
                this.touchNode(node);
                this.dirty = true;

                var contents = node.contents;
                if (contents && (contents instanceof Uint8Array || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(contents)))) {
                    var verification = this.verifyHeaderAndSha1(contents);
                    if (verification.valid) {
                        this.log('Verified committed save integrity (' + fileName + '): SHA-1 ' + verification.computedSha1);
                    }
                }

                this.scheduleSync('file-renamed: ' + fileName);
            } catch (err) {
                this.error('Error processing onFileRenamed:', err);
            }
        },

        /**
         * Coalesces and debounces rapid sequential save requests.
         */
        scheduleSync: function(reason) {
            var self = this;
            this.dirty = true;

            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = setTimeout(function() {
                self.debounceTimer = null;
                self.processSync(reason);
            }, this.debounceDelay);

            // Inform Electron main process that a save is pending
            if (window.subwayIPC && typeof window.subwayIPC.sendSaveStatus === 'function') {
                window.subwayIPC.sendSaveStatus({ syncing: self.isSyncing, dirty: true, reason: reason });
            }
        },

        /**
         * Forces immediate synchronization without debounce delay.
         */
        forceSyncNow: function(reason, callback) {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = null;
            }
            this.dirty = true;
            this.processSync(reason, callback);
        },

        /**
         * Mirrors save files across all hash directories under /idbfs/ to ensure
         * save files are available regardless of URL hash variations.
         */
        ensureMirroredSaves: function(fs) {
            this.isInternalOperation = true;
            try {
                if (!fs || !fs.analyzePath || !fs.readdir) return;
                if (!fs.analyzePath('/idbfs').exists) return;

                var entries = fs.readdir('/idbfs');
                var hashDirs = [];
                for (var i = 0; i < entries.length; i++) {
                    var e = entries[i];
                    if (e !== '.' && e !== '..' && e.length === 32) {
                        hashDirs.push(e);
                    }
                }

                if (hashDirs.length === 0) {
                    // Ensure canonical directory exists
                    try { fs.mkdir('/idbfs/' + this.CANONICAL_HASH); } catch (err) {}
                    try { fs.mkdir('/idbfs/' + this.CANONICAL_HASH + '/Save'); } catch (err) {}
                    hashDirs.push(this.CANONICAL_HASH);
                }

                // Make sure canonical hash is included
                if (hashDirs.indexOf(this.CANONICAL_HASH) === -1) {
                    try { fs.mkdir('/idbfs/' + this.CANONICAL_HASH); } catch (err) {}
                    try { fs.mkdir('/idbfs/' + this.CANONICAL_HASH + '/Save'); } catch (err) {}
                    hashDirs.push(this.CANONICAL_HASH);
                }

                var saveFileSubpaths = [
                    'Save/cloud',
                    'Save/local',
                    'Save/cloud_old',
                    'Save/local_old',
                    'PlayerPrefs'
                ];

                for (var s = 0; s < saveFileSubpaths.length; s++) {
                    var sub = saveFileSubpaths[s];
                    var bestDir = null;
                    var bestBytes = null;
                    var bestTime = 0;

                    // Find which directory has the newest/best file
                    for (var h = 0; h < hashDirs.length; h++) {
                        var dir = hashDirs[h];
                        var filePath = '/idbfs/' + dir + '/' + sub;
                        try {
                            if (fs.analyzePath(filePath).exists) {
                                var stat = fs.stat(filePath);
                                var time = (stat && stat.mtime) ? stat.mtime.getTime() : 0;
                                var bytes = fs.readFile(filePath);
                                if (bytes && bytes.length > 0) {
                                    if (!bestBytes || time > bestTime || (bytes.length > bestBytes.length && time === bestTime)) {
                                        bestTime = time;
                                        bestBytes = bytes;
                                        bestDir = dir;
                                    }
                                }
                            }
                        } catch (readErr) {}
                    }

                    // Mirror the best copy to all other directories
                    if (bestBytes && bestBytes.length > 0) {
                        for (var h = 0; h < hashDirs.length; h++) {
                            var targetDir = hashDirs[h];
                            if (targetDir !== bestDir) {
                                var targetPath = '/idbfs/' + targetDir + '/' + sub;
                                try {
                                    if (sub.indexOf('/') !== -1) {
                                        var parentDir = '/idbfs/' + targetDir + '/' + sub.split('/')[0];
                                        if (!fs.analyzePath(parentDir).exists) {
                                            fs.mkdir(parentDir);
                                        }
                                    }
                                    var needWrite = true;
                                    if (fs.analyzePath(targetPath).exists) {
                                        var curStat = fs.stat(targetPath);
                                        var curTime = (curStat && curStat.mtime) ? curStat.mtime.getTime() : 0;
                                        if (curTime >= bestTime) {
                                            needWrite = false;
                                        }
                                    }
                                    if (needWrite) {
                                        fs.writeFile(targetPath, bestBytes);
                                        try {
                                            var lookup = fs.lookupPath(targetPath);
                                            if (lookup && lookup.node) {
                                                lookup.node.timestamp = bestTime || Date.now();
                                            }
                                        } catch (tErr) {}
                                    }
                                } catch (writeErr) {}
                            }
                        }
                    }
                }
            } catch (err) {
                this.warn('ensureMirroredSaves exception:', err);
            } finally {
                this.isInternalOperation = false;
            }
        },

        /**
         * Ensures all existing save files under /idbfs/ have fresh timestamps so IDBFS.reconcile
         * commits them to IndexedDB.
         */
        touchAllSaveNodes: function(fs) {
            try {
                if (!fs || !fs.analyzePath || !fs.readdir) return;
                if (!fs.analyzePath('/idbfs').exists) return;

                var entries = fs.readdir('/idbfs');
                var now = Date.now();

                for (var i = 0; i < entries.length; i++) {
                    var e = entries[i];
                    if (e !== '.' && e !== '..' && e.length === 32) {
                        var base = '/idbfs/' + e;
                        var targets = [
                            base + '/PlayerPrefs',
                            base + '/Save/cloud',
                            base + '/Save/local',
                            base + '/Save/cloud_old',
                            base + '/Save/local_old'
                        ];

                        for (var t = 0; t < targets.length; t++) {
                            try {
                                var path = targets[t];
                                if (fs.analyzePath(path).exists) {
                                    var lookup = fs.lookupPath(path);
                                    if (lookup && lookup.node) {
                                        lookup.node.timestamp = Math.max(now, (lookup.node.timestamp || 0) + 1000);
                                    }
                                }
                            } catch (pErr) {}
                        }
                    }
                }
            } catch (err) {}
        },

        /**
         * Manages active synchronization to Chromium IndexedDB.
         */
        processSync: function(triggerReason, callback) {
            var self = this;
            var fs = self.FS || (typeof FS !== 'undefined' ? FS : null);

            if (typeof callback === 'function') {
                self.completionCallbacks.push(callback);
            }

            if (!fs || typeof fs.syncfs !== 'function') {
                self.warn('FS.syncfs is not yet available in runtime');
                return;
            }

            if (self.isSyncing) {
                self.pendingSync = true;
                self.log('Sync already in progress; enqueued pending sync for: ' + triggerReason);
                return;
            }

            self.isSyncing = true;
            self.dirty = false;
            var startTime = performance.now();

            self.log('Initiating IDBFS synchronization to IndexedDB...', { reason: triggerReason });

            // Ensure save files are mirrored and timestamps are updated
            self.ensureMirroredSaves(fs);
            self.touchAllSaveNodes(fs);

            fs.syncfs(false, function(err) {
                var duration = Math.round(performance.now() - startTime);

                if (err) {
                    self.error('IndexedDB synchronization failed (' + duration + 'ms):', err);
                    self.dirty = true;

                    if (self.retryCount < self.maxRetries) {
                        self.retryCount++;
                        var retryDelay = self.retryCount * 250;
                        self.warn('Retrying sync in ' + retryDelay + 'ms (attempt ' + self.retryCount + '/' + self.maxRetries + ')');
                        setTimeout(function() {
                            self.isSyncing = false;
                            self.processSync('retry-' + self.retryCount);
                        }, retryDelay);
                        return;
                    } else {
                        self.error('Max synchronization retries exceeded.');
                    }
                } else {
                    self.retryCount = 0;
                    self.saveSequenceId++;
                    self.log('IndexedDB synchronization SUCCESSFUL (' + duration + 'ms, seq: ' + self.saveSequenceId + ')');

                    // Notify Electron IPC
                    if (window.subwayIPC && typeof window.subwayIPC.sendSaveCompleted === 'function') {
                        window.subwayIPC.sendSaveCompleted({
                            sequenceId: self.saveSequenceId,
                            durationMs: duration,
                            reason: triggerReason,
                            timestamp: Date.now()
                        });
                    }
                }

                // Fire registered callbacks
                var callbacks = self.completionCallbacks.slice();
                self.completionCallbacks = [];
                for (var c = 0; c < callbacks.length; c++) {
                    try { callbacks[c](err); } catch (cbErr) {}
                }

                self.isSyncing = false;

                // Process queued pending requests
                if (self.pendingSync) {
                    self.pendingSync = false;
                    self.log('Processing queued pending sync request');
                    self.processSync('pending-drained');
                } else {
                    if (window.subwayIPC && typeof window.subwayIPC.sendSaveStatus === 'function') {
                        window.subwayIPC.sendSaveStatus({ syncing: false, dirty: self.dirty, idle: true });
                    }
                    if (window.subwayIPC && typeof window.subwayIPC.sendSaveFlushed === 'function') {
                        window.subwayIPC.sendSaveFlushed();
                    }
                }
            });
        },

        /**
         * Called on application exit request to guarantee all data is safely written before close.
         */
        forceFlushAndExit: function() {
            var self = this;
            self.log('Executing forceFlushAndExit before application termination...');

            if (self.debounceTimer) {
                clearTimeout(self.debounceTimer);
                self.debounceTimer = null;
            }

            self.dirty = true;

            var onFlushed = function() {
                self.log('Final exit flush complete. Notifying main process.');
                if (window.subwayIPC && typeof window.subwayIPC.sendSaveFlushed === 'function') {
                    window.subwayIPC.sendSaveFlushed();
                }
            };

            if (self.isSyncing) {
                self.pendingSync = true;
                self.completionCallbacks.push(onFlushed);
            } else {
                self.processSync('application-exit-flush', onFlushed);
            }
        },

        /**
         * Called when Emscripten mounts /idbfs at startup.
         */
        onMountComplete: function(fsInstance) {
            var self = this;
            self.FS = fsInstance || (typeof FS !== 'undefined' ? FS : null);
            self.log('IDBFS storage mount complete. Inspecting virtual save directory...');

            if (!self.FS) return;

            try {
                self.ensureMirroredSaves(self.FS);
            } catch (err) {
                self.warn('Save inspection/mirroring encountered an issue:', err);
            }

            self.setupLifecycleListeners();
        },

        /**
         * Sets up window, page, and Electron lifecycle event listeners.
         */
        setupLifecycleListeners: function() {
            var self = this;

            // Save immediately when player switches away from the game window
            window.addEventListener('blur', function() {
                self.log('Window blur event detected');
                if (self.dirty || self.debounceTimer) {
                    self.forceSyncNow('window-blur');
                }
            });

            // Save immediately when game tab or window becomes hidden
            document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                    self.log('Visibility change: hidden');
                    if (self.dirty || self.debounceTimer) {
                        self.forceSyncNow('visibility-hidden');
                    }
                }
            });

            // Save on page unload
            window.addEventListener('beforeunload', function() {
                self.log('Window beforeunload detected');
                self.forceSyncNow('beforeunload');
            });

            window.addEventListener('pagehide', function() {
                self.log('Window pagehide detected');
                self.forceSyncNow('pagehide');
            });

            // IPC listener from Electron main process
            if (window.subwayIPC && typeof window.subwayIPC.onForceSave === 'function') {
                window.subwayIPC.onForceSave(function() {
                    self.log('Received force-save IPC command from Electron main process');
                    self.forceFlushAndExit();
                });
            }

            // Watchdog timer: every 2.5 seconds, check if any writes are dirty
            if (!self.watchdogTimer) {
                self.watchdogTimer = setInterval(function() {
                    if (self.dirty || self.debounceTimer) {
                        self.log('Watchdog timer triggered flush for dirty state');
                        self.forceSyncNow('watchdog-timer');
                    }
                }, 2500);
            }

            self.log('All save lifecycle listeners successfully initialized.');
        }
    };

    // Expose globally
    window.AutoSaveManager = AutoSaveManager;

})(typeof window !== 'undefined' ? window : this);

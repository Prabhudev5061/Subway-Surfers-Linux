/**
 * Host-Filesystem IDBFS Bridge for SubwaySurfers-Linux
 *
 * Replaces per-origin Chromium IndexedDB persistence with direct, atomic
 * persistence to the canonical shared directory:
 *   ~/.local/share/SubwaySurfers-Linux/Save/
 *
 * Used identically by both San Francisco and Beijing inside Electron.
 */
(function (globalScope) {
    'use strict';

    var TARGET_LOGICAL_FILES = [
        'PlayerPrefs',
        'Save/cloud',
        'Save/cloud_old',
        'Save/local',
        'Save/local_old'
    ];

    function ensureMemfsDir(FS, dirPath) {
        var parts = dirPath.split('/').filter(Boolean);
        var cur = '';
        for (var i = 0; i < parts.length; i++) {
            cur += '/' + parts[i];
            try {
                if (!FS.analyzePath(cur).exists) {
                    FS.mkdir(cur);
                }
            } catch (e) {}
        }
    }

    function setMemfsTimestamp(FS, filePath, tsMs) {
        try {
            var lookup = FS.lookupPath(filePath);
            if (lookup && lookup.node) {
                lookup.node.timestamp = tsMs || Date.now();
            }
            if (typeof FS.utime === 'function' && tsMs) {
                FS.utime(filePath, tsMs, tsMs);
            }
        } catch (e) {}
    }

    function listHashDirs(FS) {
        if (!FS || !FS.analyzePath || !FS.readdir) return [];
        if (!FS.analyzePath('/idbfs').exists) return [];
        var entries = FS.readdir('/idbfs');
        var hashes = [];
        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];
            if (e !== '.' && e !== '..' && /^[a-f0-9]{32}$/i.test(e)) {
                hashes.push(e);
            }
        }
        return hashes;
    }

    function walkUnityAnalytics(FS, baseDir, relPrefix, outList) {
        try {
            if (!FS.analyzePath(baseDir).exists) return;
            var entries = FS.readdir(baseDir);
            for (var i = 0; i < entries.length; i++) {
                var e = entries[i];
                if (e === '.' || e === '..') continue;
                var full = baseDir + '/' + e;
                var rel = relPrefix ? relPrefix + '/' + e : e;
                var st = FS.stat(full);
                if (FS.isDir(st.mode)) {
                    walkUnityAnalytics(FS, full, rel, outList);
                } else if (FS.isFile(st.mode)) {
                    outList.push({ full: full, rel: rel, mtime: st.mtime ? st.mtime.getTime() : 0 });
                }
            }
        } catch (err) {}
    }

    var HostIDBFS = {
        _lastPopulatedOriginHash: null,

        isAvailable: function () {
            return Boolean(
                globalScope.subwayIPC &&
                typeof globalScope.subwayIPC.loadSharedSaves === 'function' &&
                typeof globalScope.subwayIPC.commitSharedSaves === 'function'
            );
        },

        populate: function (FS, callback) {
            var self = this;
            if (!self.isAvailable()) {
                return callback(new Error('Shared storage IPC bridge unavailable'));
            }
            globalScope.subwayIPC.loadSharedSaves()
                .then(function (payload) {
                    if (!payload || !payload.originHash) {
                        throw new Error('Invalid shared save payload from main process');
                    }
                    var hash = payload.originHash;
                    self._lastPopulatedOriginHash = hash;
                    var root = '/idbfs/' + hash;
                    ensureMemfsDir(FS, root);
                    ensureMemfsDir(FS, root + '/Save');

                    var files = payload.files || {};
                    var mtimes = payload.mtimes || {};
                    var keys = Object.keys(files);

                    if (globalScope.AutoSaveManager) {
                        globalScope.AutoSaveManager.isInternalOperation = true;
                    }
                    try {
                        for (var i = 0; i < keys.length; i++) {
                            var rel = keys[i];
                            var raw = files[rel];
                            if (raw === null || raw === undefined) continue;
                            var u8 = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
                            var dest = root + '/' + rel;
                            var parent = dest.slice(0, dest.lastIndexOf('/'));
                            ensureMemfsDir(FS, parent);
                            FS.writeFile(dest, u8, { canOwn: true });
                            setMemfsTimestamp(FS, dest, mtimes[rel] || Date.now());
                        }
                    } finally {
                        if (globalScope.AutoSaveManager) {
                            globalScope.AutoSaveManager.isInternalOperation = false;
                        }
                    }
                    callback(null);
                })
                .catch(function (err) {
                    callback(err || new Error('Failed to load shared saves'));
                });
        },

        persist: function (FS, callback) {
            var self = this;
            if (!self.isAvailable()) {
                return callback(new Error('Shared storage IPC bridge unavailable'));
            }
            try {
                var hashes = listHashDirs(FS);
                if (hashes.length === 0 && self._lastPopulatedOriginHash) {
                    hashes = [self._lastPopulatedOriginHash];
                }

                // Collect newest valid copy per logical save path across any hash dir in MEMFS
                var latestByLogical = {};
                for (var h = 0; h < hashes.length; h++) {
                    var base = '/idbfs/' + hashes[h];
                    for (var t = 0; t < TARGET_LOGICAL_FILES.length; t++) {
                        var logical = TARGET_LOGICAL_FILES[t];
                        var full = base + '/' + logical;
                        try {
                            if (!FS.analyzePath(full).exists) continue;
                            var st = FS.stat(full);
                            if (!FS.isFile(st.mode)) continue;
                            var bytes = FS.readFile(full);
                            if (!bytes || bytes.length === 0) continue;
                            var mtime = st.mtime ? st.mtime.getTime() : 0;
                            if (!latestByLogical[logical] || mtime >= latestByLogical[logical].mtime) {
                                latestByLogical[logical] = {
                                    path: logical,
                                    data: new Uint8Array(bytes),
                                    mtime: mtime
                                };
                            }
                        } catch (readErr) {}
                    }

                    // Also include Unity/Analytics/config if created
                    var unityFiles = [];
                    walkUnityAnalytics(FS, base + '/Unity', 'Unity', unityFiles);
                    for (var u = 0; u < unityFiles.length; u++) {
                        var uf = unityFiles[u];
                        try {
                            var uBytes = FS.readFile(uf.full);
                            latestByLogical[uf.rel] = {
                                path: uf.rel,
                                data: new Uint8Array(uBytes || []),
                                mtime: uf.mtime
                            };
                        } catch (uErr) {}
                    }
                }

                var entries = Object.keys(latestByLogical).map(function (k) {
                    return {
                        path: latestByLogical[k].path,
                        data: latestByLogical[k].data
                    };
                });

                if (entries.length === 0) {
                    return callback(null);
                }

                globalScope.subwayIPC.commitSharedSaves(entries)
                    .then(function (res) {
                        if (res && res.rejected && res.rejected.length > 0) {
                            console.warn('[HostIDBFS] Rejected invalid save writes:', res.rejected);
                        }
                        callback(null);
                    })
                    .catch(function (err) {
                        callback(err || new Error('Failed to commit shared saves'));
                    });
            } catch (err) {
                callback(err);
            }
        },

        syncfs: function (FS, _mount, populate, callback) {
            if (populate) {
                return this.populate(FS, callback);
            }
            return this.persist(FS, callback);
        }
    };

    globalScope.HostIDBFS = HostIDBFS;
})(typeof window !== 'undefined' ? window : globalThis);

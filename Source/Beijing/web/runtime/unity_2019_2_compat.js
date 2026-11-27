/**
 * Clean-Room Unity 2019.2.0f1 Compatibility, Viewport & Diagnostics Layer
 *
 * Handles:
 * - WebGL 2.0 / 1.0, WebAssembly, Worker, and IndexedDB capability probing
 * - WebAudio AudioContext creation & user-gesture unlock
 * - Responsive viewport resizing & fullscreen toggling
 * - Emscripten MEMFS safe directory initialization (Kiloo FileUtil OnlineSettings fix)
 * - IDBFS mount coordination with AutoSaveManager without modifying upstream JS
 */
(function (globalScope) {
    'use strict';

    function detectCapabilities() {
        var wasmSupported = typeof WebAssembly === 'object' &&
            typeof WebAssembly.instantiate === 'function';
        var idbSupported = typeof indexedDB !== 'undefined';
        var webglVersion = 'none';
        try {
            var testCanvas = document.createElement('canvas');
            if (testCanvas.getContext('webgl2')) webglVersion = 'WebGL 2.0';
            else if (testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl')) webglVersion = 'WebGL 1.0';
        } catch (e) {}

        return {
            wasmSupported: wasmSupported,
            indexedDBSupported: idbSupported,
            webglVersion: webglVersion,
            workerSupported: typeof Worker === 'function',
            blobSupported: typeof Blob === 'function'
        };
    }

    function ensureSafeDirTree(FS, dirPath) {
        if (!FS || !FS.analyzePath || !FS.mkdir || !dirPath) return;
        var parts = dirPath.split('/').filter(Boolean);
        var current = '';
        for (var i = 0; i < parts.length; i++) {
            current += '/' + parts[i];
            try {
                if (!FS.analyzePath(current).exists) {
                    FS.mkdir(current);
                }
            } catch (err) {}
        }
    }

    function installEmscriptenFsCompat(FS, IDBFS, baseUrl) {
        if (!FS) return false;
        ensureSafeDirTree(FS, '/idbfs');

        try {
            var parsed = new URL(baseUrl || globalScope.location.href);
            var protoDir = '/' + parsed.protocol;
            var cleanDir = parsed.pathname.replace(/\/[^/]*$/, '');
            ensureSafeDirTree(FS, protoDir + (parsed.host ? '/' + parsed.host : '') + cleanDir);
        } catch (e) {}

        if (IDBFS && typeof FS.mount === 'function') {
            try {
                var mountCheck = FS.analyzePath('/idbfs');
                if (mountCheck && mountCheck.object && !mountCheck.object.mounted) {
                    FS.mount(IDBFS, {}, '/idbfs');
                }
            } catch (mountErr) {}
        }

        if (globalScope.AutoSaveManager && typeof globalScope.AutoSaveManager.onMountComplete === 'function') {
            globalScope.AutoSaveManager.onMountComplete(FS);
        }
        return true;
    }

    function initAudioUnlock() {
        var Ctx = globalScope.AudioContext || globalScope.webkitAudioContext;
        if (!Ctx) return { supported: false, state: 'unsupported', resume: function () {} };
        var ctx = null;
        try {
            ctx = new Ctx();
        } catch (e) {
            return { supported: false, state: 'error', resume: function () {} };
        }
        var resume = function () {
            if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
                return ctx.resume().catch(function () {});
            }
            return Promise.resolve();
        };
        if (typeof globalScope.addEventListener === 'function') {
            globalScope.addEventListener('pointerdown', resume, { once: true });
            globalScope.addEventListener('keydown', resume, { once: true });
        }
        return { supported: true, state: ctx.state, context: ctx, resume: resume };
    }

    function computeViewportSize(stageWidth, stageHeight, minRatio, maxRatio) {
        var w = Math.max(320, stageWidth || 1080);
        var h = Math.max(240, stageHeight || 720);
        var ratio = w / h;
        if (maxRatio && ratio > maxRatio) {
            w = Math.round(h * maxRatio);
        } else if (minRatio && ratio < minRatio) {
            h = Math.round(w / minRatio);
        }
        return { width: w, height: h };
    }

    function toggleFullscreen(targetEl) {
        if (typeof document === 'undefined') return Promise.resolve(false);
        var el = targetEl || document.documentElement;
        if (document.fullscreenElement) {
            if (typeof document.exitFullscreen === 'function') {
                return document.exitFullscreen().then(function () { return false; }).catch(function () { return false; });
            }
            return Promise.resolve(false);
        }
        if (el && typeof el.requestFullscreen === 'function') {
            return el.requestFullscreen().then(function () { return true; }).catch(function () { return false; });
        }
        return Promise.resolve(false);
    }

    function createUnityProgressHandler(onProgress, onComplete) {
        return function (_unityInstance, progress) {
            var pct = Math.max(0, Math.min(100, Math.round((Number(progress) || 0) * 100)));
            if (typeof onProgress === 'function') onProgress(pct);
            if (pct >= 100 && typeof onComplete === 'function') onComplete();
        };
    }

    globalScope.Unity20192Compat = {
        detectCapabilities: detectCapabilities,
        ensureSafeDirTree: ensureSafeDirTree,
        installEmscriptenFsCompat: installEmscriptenFsCompat,
        initAudioUnlock: initAudioUnlock,
        computeViewportSize: computeViewportSize,
        toggleFullscreen: toggleFullscreen,
        createUnityProgressHandler: createUnityProgressHandler
    };
})(typeof window !== 'undefined' ? window : globalThis);

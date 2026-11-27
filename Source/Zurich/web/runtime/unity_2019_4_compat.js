/**
 * Clean-Room Unity 2019.4.18f1 Compatibility & Viewport Layer (Zurich)
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

    globalScope.Unity20194Compat = {
        detectCapabilities: detectCapabilities,
        initAudioUnlock: initAudioUnlock,
        computeViewportSize: computeViewportSize,
        toggleFullscreen: toggleFullscreen,
        createUnityProgressHandler: createUnityProgressHandler
    };
})(typeof window !== 'undefined' ? window : globalThis);

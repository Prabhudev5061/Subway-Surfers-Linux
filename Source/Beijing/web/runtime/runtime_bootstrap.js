/**
 * Clean-Room Standalone Application Bootstrapper
 *
 * Manages loading screen, error screen, viewport resizing, fullscreen (F11),
 * audio unlock, and local Beijing_2 WebGL initialization.
 */
(function (globalScope) {
    'use strict';

    var REQUIRED_ASSETS = [
        'Build/Beijing_2.json',
        'Build/Beijing_2.data.unityweb',
        'Build/Beijing_2.wasm.code.unityweb',
        'Build/Beijing_2.wasm.framework.unityweb',
        'loaders/v2/unity/static/UnityLoader.2019.2.js',
        '4399.js'
    ];

    globalScope.showUnitywebNoSupport = function (message) {
        var msg = message || 'Unity WebGL reported a browser or compatibility issue.';
        showErrorOverlay('Unity WebGL Runtime Error', String(msg));
    };

    function el(id) {
        return document.getElementById(id);
    }

    function setText(id, text) {
        var node = el(id);
        if (node) node.textContent = text;
    }

    function setProgress(pct) {
        var bar = el('loading-progress-bar');
        var track = bar ? bar.parentElement : null;
        if (bar) bar.style.width = pct + '%';
        if (track) track.setAttribute('aria-valuenow', String(pct));
    }

    function showErrorOverlay(title, message) {
        var loading = el('loading-overlay');
        var errorBox = el('error-overlay');
        if (loading) loading.classList.add('hidden');
        if (errorBox) errorBox.classList.remove('hidden');
        setText('error-title', title);
        setText('error-message', message);
    }

    function showLoadingOverlay(title, message) {
        var loading = el('loading-overlay');
        var errorBox = el('error-overlay');
        if (errorBox) errorBox.classList.add('hidden');
        if (loading) loading.classList.remove('hidden');
        setText('loading-title', title);
        setText('runtime-status-msg', message);
    }

    function updateViewportSize() {
        var stage = el('viewport-stage');
        var container = el('gameContainer');
        if (!stage || !container || !globalScope.Unity20192Compat) return;
        var rect = stage.getBoundingClientRect();
        var w = rect.width > 0 ? rect.width : (globalScope.innerWidth || 1080);
        var h = rect.height > 0 ? rect.height : (globalScope.innerHeight || 720);
        var dims = globalScope.Unity20192Compat.computeViewportSize(w, h, 9 / 16, 16 / 9);
        container.style.width = dims.width + 'px';
        container.style.height = dims.height + 'px';
    }

    function probeRequiredResources() {
        return Promise.all(REQUIRED_ASSETS.map(function (rel) {
            return fetch(rel, { method: 'HEAD', cache: 'no-store' })
                .then(function (r) { return r.ok ? null : rel; })
                .catch(function () { return rel; });
        })).then(function (results) {
            return results.filter(Boolean);
        });
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = function () { resolve(); };
            s.onerror = function () { reject(new Error('Failed to load script: ' + src)); };
            document.head.appendChild(s);
        });
    }

    function checkAndBootRuntime() {
        showLoadingOverlay('Subway Surfers: Beijing', 'Loading...');
        setProgress(15);

        probeRequiredResources().then(function (missing) {
            if (missing.length > 0) {
                setProgress(100);
                showErrorOverlay(
                    'Missing Game Files',
                    'Could not locate required local files: ' + missing.join(', ')
                );
                return;
            }

            setProgress(35);

            fetch('Build/Beijing_2.json', { cache: 'no-store' })
                .then(function (resp) {
                    if (!resp.ok) throw new Error('HTTP ' + resp.status);
                    return resp.json();
                })
                .then(function (manifest) {
                    if (!manifest || !manifest.wasmCodeUrl || !manifest.dataUrl) {
                        throw new Error('Malformed Build/Beijing_2.json manifest');
                    }
                    globalScope.config = {
                        loader: 'unity',
                        debug: false,
                        maxRatio: 16 / 9,
                        minRatio: 9 / 16,
                        title: 'Subway Surfers',
                        thumbnail: './4399.png',
                        numScreenshots: 4,
                        unityVersion: manifest.unityVersion || '2019.2.0f1',
                        unityWebglBuildUrl: 'Build/Beijing_2.json',
                        fileSize: 36,
                        cachedDecompressedFileSizes: {
                            'Beijing_2.data.unityweb': 29477323,
                            'Beijing_2.wasm.code.unityweb': 26477341,
                            'Beijing_2.wasm.framework.unityweb': 540326,
                            'Beijing_2.asm.code.unityweb': 9059136,
                            'Beijing_2.asm.framework.unityweb': 89457,
                            'Beijing_2.asm.memory.unityweb': 1007260
                        }
                    };
                    var bootUnity = function () {
                        var finished = false;
                        var markInitialized = function () {
                            if (finished) return;
                            finished = true;
                            setProgress(100);
                            var loading = el('loading-overlay');
                            if (loading) loading.classList.add('hidden');
                            updateViewportSize();
                            var canvas = document.querySelector('#gameContainer canvas');
                            if (canvas) {
                                canvas.setAttribute('tabindex', '0');
                                canvas.focus();
                            }
                        };
                        var onProgress = globalScope.Unity20192Compat.createUnityProgressHandler(
                            function (pct) { setProgress(Math.max(40, Math.min(98, pct))); },
                            null
                        );
                        globalScope.unityGame = globalScope.UnityLoader.instantiate(
                            'gameContainer',
                            'Build/Beijing_2.json',
                            {
                                onProgress: onProgress,
                                Module: {
                                    postRun: [function () {
                                        setTimeout(markInitialized, 250);
                                    }]
                                }
                            }
                        );
                    };

                    if (globalScope.UnityLoader) {
                        bootUnity();
                    } else {
                        loadScript('loaders/v2/unity/static/UnityLoader.2019.2.js').then(bootUnity).catch(function (err) {
                            showErrorOverlay('Unity Loader Error', err.message);
                        });
                    }
                })
                .catch(function (err) {
                    showErrorOverlay('Unity Manifest Error', err.message);
                });
        });
    }

    function boot() {
        var caps = globalScope.Unity20192Compat.detectCapabilities();
        globalScope.Unity20192Compat.initAudioUnlock();

        if (!caps.wasmSupported || caps.webglVersion === 'none') {
            showErrorOverlay(
                'WebGL Not Supported',
                'WebGL (' + caps.webglVersion + ') and WebAssembly are required.'
            );
            return;
        }

        if (globalScope.AutoSaveManager) {
            globalScope.AutoSaveManager.setupLifecycleListeners();
        }

        updateViewportSize();
        globalScope.addEventListener('resize', updateViewportSize);

        if (el('btn-retry-boot')) el('btn-retry-boot').addEventListener('click', checkAndBootRuntime);

        if (globalScope.beijingIPC && typeof globalScope.beijingIPC.onFullscreenChanged === 'function') {
            globalScope.beijingIPC.onFullscreenChanged(function () {
                updateViewportSize();
            });
        }

        globalScope.addEventListener('keydown', function (ev) {
            if (ev.key === 'F11') {
                if (!globalScope.beijingIPC || typeof globalScope.beijingIPC.toggleFullscreen !== 'function') {
                    ev.preventDefault();
                    globalScope.Unity20192Compat.toggleFullscreen(el('viewport-stage'));
                }
            }
        });

        checkAndBootRuntime();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(typeof window !== 'undefined' ? window : globalThis);

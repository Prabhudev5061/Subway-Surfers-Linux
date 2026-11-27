/**
 * Clean-Room Standalone Application Bootstrapper (Zurich)
 *
 * Manages loading overlay, error handling, viewport resizing, fullscreen (F11),
 * audio unlock, and local ZurichNewPrivacy WebGL initialization.
 */
(function (globalScope) {
    'use strict';

    var REQUIRED_ASSETS = [
        'Build/ZurichNewPrivacy.json',
        'Build/ZurichNewPrivacy.data.unityweb',
        'Build/ZurichNewPrivacy.wasm.code.unityweb',
        'Build/ZurichNewPrivacy.wasm.framework.unityweb',
        'UnityLoader.2019.2.js',
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
        if (!stage || !container || !globalScope.Unity20194Compat) return;
        var rect = stage.getBoundingClientRect();
        var w = rect.width > 0 ? rect.width : (globalScope.innerWidth || 1080);
        var h = rect.height > 0 ? rect.height : (globalScope.innerHeight || 720);
        var cfg = globalScope.config || {};
        var dims = globalScope.Unity20194Compat.computeViewportSize(
            w,
            h,
            cfg.minRatio || (9 / 16),
            cfg.maxRatio || (16 / 9)
        );
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
        var cfg = globalScope.config || {};
        var buildUrl = cfg.unityWebglBuildUrl || 'Build/ZurichNewPrivacy.json';
        var loaderUrl = cfg.unityWebglLoaderUrl || './UnityLoader.2019.2.js';

        showLoadingOverlay(cfg.title || 'Subway Surfers: Zurich', 'Loading...');
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

            fetch(buildUrl, { cache: 'no-store' })
                .then(function (resp) {
                    if (!resp.ok) throw new Error('HTTP ' + resp.status);
                    return resp.json();
                })
                .then(function (manifest) {
                    if (!manifest || !manifest.wasmCodeUrl || !manifest.dataUrl) {
                        throw new Error('Malformed ' + buildUrl + ' manifest');
                    }

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
                        var onProgress = globalScope.Unity20194Compat.createUnityProgressHandler(
                            function (pct) { setProgress(Math.max(40, Math.min(98, pct))); },
                            null
                        );
                        globalScope.unityGame = globalScope.UnityLoader.instantiate(
                            'gameContainer',
                            buildUrl,
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
                        loadScript(loaderUrl).then(bootUnity).catch(function (err) {
                            console.error('[Zurich] Unity loader error:', err);
                            showErrorOverlay('Unity Loader Error', err.message);
                        });
                    }
                })
                .catch(function (err) {
                    console.error('[Zurich] Unity manifest error:', err);
                    showErrorOverlay('Unity Manifest Error', err.message);
                });
        });
    }

    function boot() {
        var caps = globalScope.Unity20194Compat.detectCapabilities();
        globalScope.Unity20194Compat.initAudioUnlock();

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

        if (globalScope.subwayIPC && typeof globalScope.subwayIPC.onFullscreenChanged === 'function') {
            globalScope.subwayIPC.onFullscreenChanged(function () {
                updateViewportSize();
            });
        }

        globalScope.addEventListener('keydown', function (ev) {
            if (ev.key === 'F11') {
                if (!globalScope.subwayIPC || typeof globalScope.subwayIPC.toggleFullscreen !== 'function') {
                    ev.preventDefault();
                    globalScope.Unity20194Compat.toggleFullscreen(el('viewport-stage'));
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

/**
 * Unified WASD Movement Controls Remapping Layer for SubwaySurfers-Linux
 *
 * Shared across San Francisco, Beijing, and Zurich.
 * Maps directional movement to WASD at the Emscripten JSEvents boundary:
 *   W / KeyW -> ArrowUp    (keyCode 38) : Jump / move up
 *   A / KeyA -> ArrowLeft  (keyCode 37) : Move left
 *   S / KeyS -> ArrowDown  (keyCode 40) : Roll / move down
 *   D / KeyD -> ArrowRight (keyCode 39) : Move right
 *
 * Safety & compatibility guarantees:
 * - Suppresses physical Arrow keys as primary movement controls during gameplay.
 * - Preserves Space (start / hoverboard), Escape (pause / back), F11 (fullscreen),
 *   mouse, touch, gamepad, and all Electron / browser shortcuts (Ctrl/Alt/Meta).
 * - Leaves text fields (<input>, <textarea>, <select>, contentEditable) untouched.
 * - Tracks held keys by physical code and synthesizes clean keyup events on
 *   window blur, visibilitychange (hidden), or pagehide to prevent stuck keys.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SubwayControls = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var WASD_TO_ARROW = {
        KeyW: { physCode: 'KeyW', key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, which: 38, charCode: 0, location: 0 },
        KeyA: { physCode: 'KeyA', key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, which: 37, charCode: 0, location: 0 },
        KeyS: { physCode: 'KeyS', key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, charCode: 0, location: 0 },
        KeyD: { physCode: 'KeyD', key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39, charCode: 0, location: 0 }
    };

    var KEY_FALLBACK_TO_CODE = {
        w: 'KeyW',
        a: 'KeyA',
        s: 'KeyS',
        d: 'KeyD'
    };

    var BLOCKED_ARROW_CODES = {
        ArrowUp: true,
        ArrowLeft: true,
        ArrowDown: true,
        ArrowRight: true
    };

    var BLOCKED_ARROW_KEYCODES = {
        37: true,
        38: true,
        39: true,
        40: true
    };

    function isEditableElement(el) {
        if (!el || typeof el !== 'object') return false;
        if (el.isContentEditable) return true;
        var tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    }

    function hasModifierShortcut(e) {
        return Boolean(e && (e.ctrlKey || e.altKey || e.metaKey));
    }

    function resolveWasdMapping(e) {
        if (!e) return null;
        if (typeof e.code === 'string' && WASD_TO_ARROW[e.code]) {
            return WASD_TO_ARROW[e.code];
        }
        if (typeof e.key === 'string') {
            var code = KEY_FALLBACK_TO_CODE[e.key.toLowerCase()];
            if (code && WASD_TO_ARROW[code]) {
                return WASD_TO_ARROW[code];
            }
        }
        return null;
    }

    function isBlockedArrowEvent(e) {
        if (!e || e.__subwayRemapped) return false;
        if (typeof e.code === 'string' && BLOCKED_ARROW_CODES[e.code]) return true;
        if (typeof e.key === 'string' && BLOCKED_ARROW_CODES[e.key]) return true;
        var kc = Number(e.keyCode || e.which || 0);
        return Boolean(BLOCKED_ARROW_KEYCODES[kc]);
    }

    function buildTranslatedEvent(rawEvent, mapped, eventType) {
        return {
            __subwayRemapped: true,
            key: mapped.key,
            code: mapped.code,
            location: mapped.location,
            ctrlKey: false,
            shiftKey: Boolean(rawEvent && rawEvent.shiftKey),
            altKey: false,
            metaKey: false,
            repeat: eventType === 'keyup' ? false : Boolean(rawEvent && rawEvent.repeat),
            locale: (rawEvent && rawEvent.locale) || '',
            char: '',
            charCode: 0,
            keyCode: mapped.keyCode,
            which: mapped.which
        };
    }

    function createControlsController(win, doc) {
        var activeKeys = {};
        var keyupDispatchers = [];
        var listenersAttached = false;
        var lastTranslated = [];

        function recordTrace(entry) {
            lastTranslated.push(entry);
            if (lastTranslated.length > 50) lastTranslated.shift();
        }

        function registerKeyupDispatcher(fn) {
            if (typeof fn !== 'function') return;
            if (keyupDispatchers.indexOf(fn) === -1) {
                keyupDispatchers.push(fn);
            }
        }

        function clearKeyupDispatchers() {
            keyupDispatchers = [];
        }

        function releaseAllHeldKeys(reason) {
            var keys = Object.keys(activeKeys);
            if (keys.length === 0) return 0;
            var released = 0;
            for (var i = 0; i < keys.length; i++) {
                var phys = keys[i];
                var mapped = activeKeys[phys];
                delete activeKeys[phys];
                if (!mapped) continue;
                var syntheticUp = buildTranslatedEvent(null, mapped, 'keyup');
                recordTrace({ type: 'keyup', phys: phys, to: mapped.code, keyCode: mapped.keyCode, reason: reason || 'blur' });
                for (var d = 0; d < keyupDispatchers.length; d++) {
                    try { keyupDispatchers[d](syntheticUp); } catch (err) {}
                }
                released++;
            }
            return released;
        }

        function attachLifecycleListeners() {
            if (listenersAttached) return;
            if (!win || typeof win.addEventListener !== 'function') return;
            listenersAttached = true;

            win.addEventListener('blur', function () {
                releaseAllHeldKeys('window-blur');
            });
            win.addEventListener('pagehide', function () {
                releaseAllHeldKeys('pagehide');
            });
            if (doc && typeof doc.addEventListener === 'function') {
                doc.addEventListener('visibilitychange', function () {
                    if (doc.hidden) {
                        releaseAllHeldKeys('visibility-hidden');
                    }
                });
            }
        }

        function processKeyEvent(eventType, rawEvent) {
            attachLifecycleListeners();
            if (!rawEvent) return { action: 'passthrough', event: rawEvent };

            var activeEl = doc ? doc.activeElement : null;
            if (hasModifierShortcut(rawEvent) || isEditableElement(rawEvent.target) || isEditableElement(activeEl)) {
                return { action: 'passthrough', event: rawEvent };
            }

            var mapped = resolveWasdMapping(rawEvent);
            if (mapped) {
                if (eventType === 'keypress') {
                    return { action: 'suppress', reason: 'wasd-keypress-suppressed' };
                }
                if (eventType === 'keydown') {
                    activeKeys[mapped.physCode] = mapped;
                } else if (eventType === 'keyup') {
                    delete activeKeys[mapped.physCode];
                }
                var translated = buildTranslatedEvent(rawEvent, mapped, eventType);
                recordTrace({
                    type: eventType,
                    phys: mapped.physCode,
                    to: mapped.code,
                    keyCode: mapped.keyCode,
                    repeat: translated.repeat
                });
                return { action: 'remap', event: translated };
            }

            if (isBlockedArrowEvent(rawEvent)) {
                recordTrace({
                    type: eventType,
                    phys: rawEvent.code || rawEvent.key,
                    suppressed: true
                });
                return { action: 'suppress', reason: 'arrow-key-disabled' };
            }

            return { action: 'passthrough', event: rawEvent };
        }

        function getActiveMappedKeys() {
            return Object.keys(activeKeys);
        }

        function getTrace() {
            return lastTranslated.slice();
        }

        attachLifecycleListeners();

        return {
            WASD_TO_ARROW: WASD_TO_ARROW,
            createControlsController: createControlsController,
            processKeyEvent: processKeyEvent,
            registerKeyupDispatcher: registerKeyupDispatcher,
            clearKeyupDispatchers: clearKeyupDispatchers,
            releaseAllHeldKeys: releaseAllHeldKeys,
            getActiveMappedKeys: getActiveMappedKeys,
            getTrace: getTrace,
            isEditableElement: isEditableElement
        };
    }

    var globalWin = typeof window !== 'undefined' ? window : null;
    var globalDoc = typeof document !== 'undefined' ? document : null;
    return createControlsController(globalWin, globalDoc);
}));

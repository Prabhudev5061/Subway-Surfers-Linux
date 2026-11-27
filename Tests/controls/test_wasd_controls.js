/**
 * Automated Unit Tests for Unified WASD Movement Controls (SubwaySurfers-Linux)
 */
const assert = require('assert');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const { createControlsController, WASD_TO_ARROW } = require(path.join(REPO_ROOT, 'Source', 'Shared', 'controls_wasd.js'));

function makeEventTarget(listenersMap) {
    return {
        addEventListener(type, fn) {
            if (!listenersMap[type]) listenersMap[type] = [];
            listenersMap[type].push(fn);
        }
    };
}

function run() {
    console.log('[WASD Controls Unit Tests] Starting...');

    const winListeners = {};
    const docListeners = {};
    const fakeWin = makeEventTarget(winListeners);
    const fakeDoc = {
        hidden: false,
        activeElement: { tagName: 'CANVAS' },
        ...makeEventTarget(docListeners)
    };

    const ctrl = createControlsController(fakeWin, fakeDoc);
    const syntheticUps = [];
    ctrl.registerKeyupDispatcher((ev) => syntheticUps.push(ev));

    // 1. W/A/S/D -> ArrowUp/ArrowLeft/ArrowDown/ArrowRight mapping on keydown & keyup
    const cases = [
        ['KeyW', 'w', 'ArrowUp', 38],
        ['KeyA', 'a', 'ArrowLeft', 37],
        ['KeyS', 's', 'ArrowDown', 40],
        ['KeyD', 'd', 'ArrowRight', 39]
    ];

    for (const [code, key, expectedCode, expectedKeyCode] of cases) {
        const down = ctrl.processKeyEvent('keydown', { code, key, keyCode: key.toUpperCase().charCodeAt(0), repeat: false });
        assert.strictEqual(down.action, 'remap', `${code} keydown must remap`);
        assert.strictEqual(down.event.code, expectedCode);
        assert.strictEqual(down.event.key, expectedCode);
        assert.strictEqual(down.event.keyCode, expectedKeyCode);
        assert.strictEqual(down.event.which, expectedKeyCode);
        assert.strictEqual(down.event.repeat, false);
        assert(ctrl.getActiveMappedKeys().includes(code), `${code} must be tracked while held`);

        // Repeated keydown while held must preserve repeat=true and avoid duplicate activeKeys
        const rep = ctrl.processKeyEvent('keydown', { code, key, keyCode: key.toUpperCase().charCodeAt(0), repeat: true });
        assert.strictEqual(rep.action, 'remap');
        assert.strictEqual(rep.event.repeat, true);
        assert.strictEqual(ctrl.getActiveMappedKeys().filter((k) => k === code).length, 1);

        // Keypress for WASD is suppressed so stray characters aren't typed
        const kp = ctrl.processKeyEvent('keypress', { code, key, charCode: key.charCodeAt(0) });
        assert.strictEqual(kp.action, 'suppress');

        // Keyup stops input and clears active key
        const up = ctrl.processKeyEvent('keyup', { code, key: key.toUpperCase(), keyCode: key.toUpperCase().charCodeAt(0) });
        assert.strictEqual(up.action, 'remap');
        assert.strictEqual(up.event.code, expectedCode);
        assert.strictEqual(up.event.keyCode, expectedKeyCode);
        assert.strictEqual(up.event.repeat, false);
        assert(!ctrl.getActiveMappedKeys().includes(code), `${code} must clear on keyup`);
    }

    // 2. Fallback matching by key when code is omitted (e.g., Shift+W or synthetic event)
    const fallbackDown = ctrl.processKeyEvent('keydown', { key: 'W', shiftKey: true, keyCode: 87 });
    assert.strictEqual(fallbackDown.action, 'remap');
    assert.strictEqual(fallbackDown.event.code, 'ArrowUp');
    assert.strictEqual(fallbackDown.event.keyCode, 38);
    ctrl.processKeyEvent('keyup', { key: 'w', keyCode: 87 });
    assert.strictEqual(ctrl.getActiveMappedKeys().length, 0);

    // 3. Physical Arrow keys must be suppressed as primary movement controls
    for (const [arrow, kc] of [['ArrowUp', 38], ['ArrowLeft', 37], ['ArrowDown', 40], ['ArrowRight', 39]]) {
        const resDown = ctrl.processKeyEvent('keydown', { code: arrow, key: arrow, keyCode: kc, which: kc });
        assert.strictEqual(resDown.action, 'suppress', `${arrow} keydown must be suppressed`);
        const resUp = ctrl.processKeyEvent('keyup', { code: arrow, key: arrow, keyCode: kc, which: kc });
        assert.strictEqual(resUp.action, 'suppress', `${arrow} keyup must be suppressed`);
    }

    // 4. Non-movement controls (Space, Escape, F11, Enter) pass through untouched
    for (const [k, c, kc] of [[' ', 'Space', 32], ['Escape', 'Escape', 27], ['F11', 'F11', 122], ['Enter', 'Enter', 13]]) {
        const ev = { key: k, code: c, keyCode: kc, which: kc };
        const res = ctrl.processKeyEvent('keydown', ev);
        assert.strictEqual(res.action, 'passthrough', `${c} must pass through unchanged`);
        assert.strictEqual(res.event, ev);
    }

    // 5. Electron/browser modifier shortcuts (Ctrl+W, Alt+D, Meta+A) pass through untouched
    const shortcutRes = ctrl.processKeyEvent('keydown', { code: 'KeyW', key: 'w', ctrlKey: true, keyCode: 87 });
    assert.strictEqual(shortcutRes.action, 'passthrough', 'Modifier shortcuts must pass through');

    // 6. Editable text fields pass through untouched (no interference with typing WASD or Arrows)
    fakeDoc.activeElement = { tagName: 'INPUT' };
    const inputRes = ctrl.processKeyEvent('keydown', { code: 'KeyW', key: 'w', keyCode: 87, target: fakeDoc.activeElement });
    assert.strictEqual(inputRes.action, 'passthrough', 'Text input fields must pass through');
    const inputArrow = ctrl.processKeyEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37, target: fakeDoc.activeElement });
    assert.strictEqual(inputArrow.action, 'passthrough', 'Arrow keys inside text input fields must pass through');
    fakeDoc.activeElement = { tagName: 'CANVAS' };

    // 7. Focus loss & visibility hidden must release multiple held keys without stuck state
    ctrl.processKeyEvent('keydown', { code: 'KeyW', key: 'w', keyCode: 87 });
    ctrl.processKeyEvent('keydown', { code: 'KeyD', key: 'd', keyCode: 68 });
    assert.strictEqual(ctrl.getActiveMappedKeys().length, 2);

    syntheticUps.length = 0;
    winListeners.blur.forEach((fn) => fn());
    assert.strictEqual(ctrl.getActiveMappedKeys().length, 0, 'window blur must clear all held keys');
    assert.strictEqual(syntheticUps.length, 2, 'window blur must synthesize keyup for both held keys');
    assert.deepStrictEqual(syntheticUps.map((u) => u.code).sort(), ['ArrowRight', 'ArrowUp']);

    // Visibility hidden release
    ctrl.processKeyEvent('keydown', { code: 'KeyA', key: 'a', keyCode: 65 });
    syntheticUps.length = 0;
    fakeDoc.hidden = true;
    docListeners.visibilitychange.forEach((fn) => fn());
    assert.strictEqual(ctrl.getActiveMappedKeys().length, 0, 'visibilitychange(hidden) must clear held keys');
    assert.strictEqual(syntheticUps.length, 1);
    assert.strictEqual(syntheticUps[0].code, 'ArrowLeft');
    assert.strictEqual(WASD_TO_ARROW.KeyS.keyCode, 40);

    console.log('[PASS] WASD controls unit tests passed.');
}

run();

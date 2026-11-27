const fs = require('fs');
const path = require('path');

function resolveSharedDir() {
    const candidates = [
        path.resolve(__dirname, 'shared'),
        path.resolve(__dirname, '../../Shared')
    ];
    for (const c of candidates) {
        if (fs.existsSync(path.join(c, 'electron_shell.js'))) return c;
    }
    throw new Error('Could not locate Shared runtime directory');
}

function resolveWebRoot() {
    const candidates = [
        process.env.SUBWAY_ZURICH_WEB_DIR || null,
        path.resolve(__dirname, '../../web'),
        path.resolve(__dirname, '../web')
    ].filter(Boolean);
    for (const c of candidates) {
        if (fs.existsSync(path.join(c, 'index.html'))) return c;
    }
    throw new Error('Could not locate Zurich web/index.html');
}

function resolveIconPath() {
    const candidates = [
        path.resolve(__dirname, '../../subwaysurfers-zurich.png'),
        path.resolve(__dirname, '../assets/subwaysurfers-zurich.png'),
        path.resolve(__dirname, '../assets/b3f5e1472e1bfbee1804c7e854546a08.png')
    ];
    return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

const sharedDir = resolveSharedDir();
const { launchUnifiedGame } = require(path.join(sharedDir, 'electron_shell.js'));

launchUnifiedGame({
    appId: 'SubwaySurfers-Zurich-Linux',
    versionSlug: 'zurich',
    windowTitle: 'Subway Surfers: Zurich',
    webRoot: resolveWebRoot(),
    sharedRoot: sharedDir,
    iconPath: resolveIconPath(),
    preferredPort: Number(process.env.SUBWAY_ZURICH_PORT || 47323),
    backgroundColor: '#231F20',
    preloadPath: path.join(sharedDir, 'preload_shared.js'),
    appEntryPath: __filename
});

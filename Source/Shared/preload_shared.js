/**
 * Shared Hardened Preload Context Bridge for SubwaySurfers-Linux
 *
 * Runs with contextIsolation: true, nodeIntegration: false, sandbox: true.
 * Exposes only scoped IPC primitives for shared save storage, autosave lifecycle,
 * and fullscreen toggling without exposing ipcRenderer or Node internals.
 */
const { contextBridge, ipcRenderer } = require('electron');

function safeSend(channel, payload) {
    try {
        ipcRenderer.send(channel, payload);
    } catch (err) {}
}

const api = {
    loadSharedSaves: () => ipcRenderer.invoke('shared-save:load'),
    commitSharedSaves: (entries) => {
        if (!Array.isArray(entries)) {
            return Promise.reject(new Error('entries must be an array'));
        }
        const safeEntries = entries.map((e) => ({
            path: typeof e.path === 'string' ? e.path : '',
            data: e.data instanceof Uint8Array ? e.data : new Uint8Array(e.data || [])
        }));
        return ipcRenderer.invoke('shared-save:commit', safeEntries);
    },
    getStorageInfo: () => ipcRenderer.invoke('shared-save:info'),
    sendSaveStatus: (status) => {
        if (status && typeof status === 'object') {
            safeSend('save-status', {
                syncing: Boolean(status.syncing),
                dirty: Boolean(status.dirty),
                idle: Boolean(status.idle),
                reason: typeof status.reason === 'string' ? status.reason.slice(0, 128) : ''
            });
        }
    },
    sendSaveCompleted: (info) => {
        if (info && typeof info === 'object') {
            safeSend('save-completed', {
                sequenceId: Number(info.sequenceId) || 0,
                durationMs: Number(info.durationMs) || 0,
                reason: typeof info.reason === 'string' ? info.reason.slice(0, 128) : '',
                timestamp: Number(info.timestamp) || Date.now()
            });
        }
    },
    sendSaveFlushed: () => {
        safeSend('save-flushed');
    },
    onForceSave: (callback) => {
        if (typeof callback === 'function') {
            ipcRenderer.on('force-save-before-exit', () => {
                callback();
            });
        }
    },
    toggleFullscreen: () => {
        safeSend('toggle-fullscreen');
    },
    requestClose: () => {
        safeSend('request-close');
    },
    getWindowState: () => ipcRenderer.invoke('get-window-state'),
    onFullscreenChanged: (callback) => {
        if (typeof callback === 'function') {
            ipcRenderer.on('fullscreen-changed', (_e, isFs) => {
                callback(Boolean(isFs));
            });
        }
    }
};

contextBridge.exposeInMainWorld('subwayIPC', api);
contextBridge.exposeInMainWorld('beijingIPC', api);

window.addEventListener('keydown', (e) => {
    if (e.key === 'F11' && !e.repeat) {
        e.preventDefault();
        safeSend('toggle-fullscreen');
    }
}, true);

/**
 * Preload bridge script for Subway Surfers Linux
 * Safely exposes IPC communication for the AutoSave Manager
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('subwayIPC', {
    sendSaveStatus: (status) => {
        try {
            ipcRenderer.send('save-status', status);
        } catch (e) {}
    },
    sendSaveCompleted: (info) => {
        try {
            ipcRenderer.send('save-completed', info);
        } catch (e) {}
    },
    sendSaveFlushed: () => {
        try {
            ipcRenderer.send('save-flushed');
        } catch (e) {}
    },
    onForceSave: (callback) => {
        try {
            ipcRenderer.on('force-save-before-exit', () => {
                if (typeof callback === 'function') callback();
            });
        } catch (e) {}
    }
});

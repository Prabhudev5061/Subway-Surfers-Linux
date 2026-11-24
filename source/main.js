const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let win;
let isQuitting = false;
let savePending = false;
let closeTimeout = null;

const createWindow = () => {
  win = new BrowserWindow({
    autoHideMenuBar: true,
    width: 1080,
    height: 720,
    title: "Subway Surfers",
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Ensure /tmp/SubwaySurfers exists for consistent Unity WebGL URL and IDBFS hash
  const bundledHtml = path.resolve(__dirname, '../../html');
  try {
    let needsLink = true;
    try {
      const stats = fs.lstatSync('/tmp/SubwaySurfers');
      if (stats.isSymbolicLink()) {
        const dest = fs.readlinkSync('/tmp/SubwaySurfers');
        if (dest === bundledHtml && fs.existsSync('/tmp/SubwaySurfers/index.html')) {
          needsLink = false;
        } else {
          fs.unlinkSync('/tmp/SubwaySurfers');
        }
      }
    } catch (statErr) {
      if (statErr.code !== 'ENOENT') {
        try { fs.unlinkSync('/tmp/SubwaySurfers'); } catch (e) {}
      }
    }
    if (needsLink) {
      fs.symlinkSync(bundledHtml, '/tmp/SubwaySurfers', 'dir');
    }
  } catch (e) {
    console.warn('[Main Process] Symlink setup notice:', e.message);
  }

  let htmlPath;
  if (fs.existsSync('/tmp/SubwaySurfers/index.html')) {
    htmlPath = '/tmp/SubwaySurfers/index.html';
  } else if (process.env.SUBWAY_HTML_DIR && fs.existsSync(path.join(process.env.SUBWAY_HTML_DIR, 'index.html'))) {
    htmlPath = path.join(process.env.SUBWAY_HTML_DIR, 'index.html');
  } else {
    htmlPath = path.join(bundledHtml, 'index.html');
  }

  console.log('[Main Process] Loading Subway Surfers from:', htmlPath);
  
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer console] [level ${level}] ${message} (${sourceId}:${line})`);
  });
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Renderer did-fail-load] ${errorCode}: ${errorDescription} (${validatedURL})`);
  });

  win.loadFile(htmlPath);

  // Keyboard navigation shortcuts
  win.webContents.on('before-input-event', (event, input) => {
    if (input.alt && input.key === 'ArrowLeft') {
      win.webContents.navigationHistory.goBack();
      event.preventDefault();
    }
    if (input.alt && input.key === 'ArrowRight') {
      win.webContents.navigationHistory.goForward();
      event.preventDefault();
    }
  });

  // Intercept close event to ensure all save data is committed
  win.on('close', (e) => {
    if (isQuitting) return;

    e.preventDefault();
    isQuitting = true;
    console.log('[Main Process] Window close intercepted. Initiating clean save flush...');

    try {
      win.webContents.send('force-save-before-exit');
    } catch (err) {
      console.error('[Main Process] Error sending force-save:', err);
    }

    closeTimeout = setTimeout(() => {
      console.log('[Main Process] Save flush timeout reached (2500ms). Closing window.');
      if (win && !win.isDestroyed()) win.destroy();
    }, 2500);
  });
};

// IPC listeners for AutoSave synchronization coordination
ipcMain.on('save-status', (event, status) => {
  savePending = status && (status.syncing || status.dirty);
});

ipcMain.on('save-completed', (event, info) => {
  savePending = false;
  console.log('[AutoSave IPC] Save committed to IndexedDB:', info.reason, '(seq: ' + info.sequenceId + ', ' + info.durationMs + 'ms)');
});

ipcMain.on('save-flushed', () => {
  savePending = false;
  console.log('[AutoSave IPC] Save queue drained.');
  if (isQuitting) {
    console.log('[Main Process] Quit in progress: closing window now.');
    if (closeTimeout) clearTimeout(closeTimeout);
    if (win && !win.isDestroyed()) win.destroy();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

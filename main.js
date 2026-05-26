const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');

const PORT = 38491;
let mainWindow = null;
let server = null;

function startServer() {
  return new Promise((resolve, reject) => {
    const srv = express();

    // __dirname works in both dev and packaged (asar) mode
    srv.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
    srv.use(express.static(path.join(__dirname, 'renderer')));

    server = srv.listen(PORT, '127.0.0.1', () => {
      resolve();
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUS') {
        setTimeout(() => {
          server.close();
          server.listen(PORT, '127.0.0.1');
        }, 1000);
      } else {
        reject(err);
      }
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    title: 'LogViewer',
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
}

// ─── IPC Handlers ───

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Log File',
    properties: ['openFile'],
    filters: [
      { name: 'Log Files', extensions: ['log', 'txt', 'logcat', 'out', 'csv'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePaths.length) return null;

  const filePath = result.filePaths[0];
  const stats = fs.statSync(filePath);

  return {
    path: filePath,
    name: path.basename(filePath),
    size: stats.size
  };
});

ipcMain.handle('file:read', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    const stats = fs.statSync(filePath);
    const totalSize = stats.size;
    let loaded = 0;

    const chunks = [];
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });

    stream.on('data', (chunk) => {
      chunks.push(chunk);
      loaded += Buffer.byteLength(chunk, 'utf-8');
      // Report progress
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('file:progress', {
          loaded,
          total: totalSize
        });
      }
    });

    stream.on('end', () => {
      resolve(chunks.join(''));
    });

    stream.on('error', (err) => {
      reject(err.message);
    });
  });
});

ipcMain.handle('file:save', async (event, { content, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Filtered Logs',
    defaultPath: defaultName || 'filtered_logcat.txt',
    filters: [
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled || !result.filePath) return false;

  fs.writeFileSync(result.filePath, content, 'utf-8');
  return true;
});

// ─── App Lifecycle ───

app.whenReady().then(async () => {
  await startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});

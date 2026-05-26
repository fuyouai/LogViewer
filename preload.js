const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  saveFile: (content, defaultName) => ipcRenderer.invoke('file:save', { content, defaultName }),
  onFileProgress: (callback) => {
    ipcRenderer.on('file:progress', (event, progress) => callback(progress));
  }
});

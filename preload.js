const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  readFile: (filePath, encoding) => ipcRenderer.invoke('file:read', filePath, encoding),
  readFromBuffer: (buffer, encoding) => ipcRenderer.invoke('file:readFromBuffer', { buffer, encoding }),
  detectEncoding: (filePath) => ipcRenderer.invoke('file:detectEncoding', filePath),
  saveFile: (content, defaultName) => ipcRenderer.invoke('file:save', { content, defaultName }),
  onFileProgress: (callback) => {
    // Register exactly once; subsequent calls just swap the callback.
    if (!ipcRenderer._progressRegistered) {
      ipcRenderer.on('file:progress', (event, progress) => {
        if (ipcRenderer._progressCallback) ipcRenderer._progressCallback(progress);
      });
      ipcRenderer._progressRegistered = true;
    }
    ipcRenderer._progressCallback = callback;
  },
  // OS "Open With" / Finder double-click / second-instance file opens.
  onOpenFiles: (callback) => {
    if (!ipcRenderer._openFilesRegistered) {
      ipcRenderer.on('app:open-files', (event, files) => {
        if (ipcRenderer._openFilesCallback) ipcRenderer._openFilesCallback(files);
      });
      ipcRenderer._openFilesRegistered = true;
    }
    ipcRenderer._openFilesCallback = callback;
  },
  notifyRendererReady: () => ipcRenderer.invoke('app:renderer-ready'),
  getLocale: () => ipcRenderer.invoke('app:getLocale')
});

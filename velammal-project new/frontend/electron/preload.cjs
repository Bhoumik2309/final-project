const { contextBridge, ipcRenderer } = require('electron')

// Expose scanner APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Scanner functions
  scanner: {
    check: () => ipcRenderer.invoke('scanner:check'),
    list: () => ipcRenderer.invoke('scanner:list'),
    scan: (options) => ipcRenderer.invoke('scanner:scan', options),
    getFile: (filePath) => ipcRenderer.invoke('scanner:getFile', filePath)
  },
  
  // Check if running in Electron
  isElectron: true,
  
  // Platform info
  platform: process.platform
})

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('launcher', {
  onStatus: (callback) => {
    ipcRenderer.on('status', (_event, message) => callback(message))
  },
  onError: (callback) => {
    ipcRenderer.on('startup-error', (_event, error) => callback(error))
  },
  retry: () => ipcRenderer.send('retry'),
  openDocker: () => ipcRenderer.send('open-docker'),
  quit: () => ipcRenderer.send('quit')
})

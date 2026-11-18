const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  window: action => ipcRenderer.invoke('office:window', action),
  open: () => ipcRenderer.invoke('office:open'),
  pending: () => ipcRenderer.invoke('office:pending'),
  save: payload => ipcRenderer.invoke('office:save', payload),
  loadWorkspace: () => ipcRenderer.invoke('office:workspace-load'),
  openWorkspace: () => ipcRenderer.invoke('office:workspace-folder'),
  saveWorkspace: data => ipcRenderer.invoke('office:workspace-save', data),
  print: payload => ipcRenderer.invoke('office:print', payload),
  pdf: payload => ipcRenderer.invoke('office:pdf', payload),
  onAction: callback => {
    const listener = (_, action) => callback(action);
    ipcRenderer.on('office:action', listener);
    return () => ipcRenderer.removeListener('office:action', listener);
  }
});

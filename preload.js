const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ezcapes', {
  // Pack Library
  listPresets: () => ipcRenderer.invoke('library:list'),
  savePreset: (data) => ipcRenderer.invoke('library:save', data),
  deletePreset: (id) => ipcRenderer.invoke('library:delete', id),
  renamePreset: (data) => ipcRenderer.invoke('library:rename', data),

  // Skin Library
  listSkins: () => ipcRenderer.invoke('skinLib:list'),
  saveSkin: (data) => ipcRenderer.invoke('skinLib:save', data),
  deleteSkin: (id) => ipcRenderer.invoke('skinLib:delete', id),
  getSkinDataURL: (id) => ipcRenderer.invoke('skinLib:getDataURL', id),

  // Cape Library
  listCapes: () => ipcRenderer.invoke('capeLib:list'),
  saveCape: (data) => ipcRenderer.invoke('capeLib:save', data),
  deleteCape: (id) => ipcRenderer.invoke('capeLib:delete', id),
  getCapeDataURL: (id) => ipcRenderer.invoke('capeLib:getDataURL', id),

  // Install
  installPack: (data) => ipcRenderer.invoke('pack:install', data),
  getInstallPath: () => ipcRenderer.invoke('pack:getInstallPath'),
  readCurrentPack: () => ipcRenderer.invoke('pack:readCurrent'),

  // File dialogs
  openFiles: (opts) => ipcRenderer.invoke('dialog:openFiles', opts),
});

const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ointel', {
  copyNodeLink: node => ipcRenderer.invoke('node:copy-link', node),
  speechStatus: () => ipcRenderer.invoke('speech:status'),
  speechPrepare: () => ipcRenderer.invoke('speech:prepare'),
  speechStart: options => ipcRenderer.invoke('speech:start', options),
  speechAudio: chunk => ipcRenderer.invoke('speech:audio', chunk),
  speechStop: () => ipcRenderer.invoke('speech:stop'),
  speechEdit: patch => ipcRenderer.invoke('speech:edit', patch),
  speechDiscard: () => ipcRenderer.invoke('speech:discard'),
  onSpeechStatus: callback => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('speech:status', listener);
    return () => ipcRenderer.removeListener('speech:status', listener);
  },
  zoomStatus: () => ipcRenderer.invoke('zoom:status'),
  zoomConnect: clientId => ipcRenderer.invoke('zoom:connect', clientId),
  zoomCancel: () => ipcRenderer.invoke('zoom:cancel'),
  zoomDisconnect: () => ipcRenderer.invoke('zoom:disconnect'),
  zoomRecordings: (from, to, nextPage) => ipcRenderer.invoke('zoom:list', from, to, nextPage),
  zoomTranscript: key => ipcRenderer.invoke('zoom:transcript', key),
  load: () => ipcRenderer.invoke('workspace:load'),
  save: workspace => ipcRenderer.invoke('workspace:save', workspace),
  reveal: () => ipcRenderer.invoke('workspace:reveal'),
  openExternal: url => ipcRenderer.invoke('app:open-external', url),
  search: (text, includeHistory) => ipcRenderer.invoke('vector:search', text, includeHistory),
  vectorStatus: () => ipcRenderer.invoke('vector:status'),
  retryVectors: () => ipcRenderer.invoke('vector:retry'),
  onVectorStatus: callback => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('vector:status', listener);
    return () => ipcRenderer.removeListener('vector:status', listener);
  },
  onClose: callback => {
    const listener = async () => {
      try { await callback(); ipcRenderer.send('app:close-ready'); }
      catch { ipcRenderer.send('app:close-failed'); }
    };
    ipcRenderer.on('app:before-close', listener);
    return () => ipcRenderer.removeListener('app:before-close', listener);
  },
});

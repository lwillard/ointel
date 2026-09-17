const { app, BrowserWindow, ipcMain, shell, dialog, safeStorage, session, desktopCapturer, utilityProcess, clipboard, ClipboardItem } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const dev = process.argv.includes('--dev');
let win;
let canClose = false;
let closePending = false;

const hasLock = process.env.OINTEL_TEST_MODE === '1' || app.requestSingleInstanceLock();
if (!hasLock) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
if (hasLock) app.whenReady().then(async () => {
  if (app.isPackaged) process.env.OINTEL_BUNDLED_MODELS = path.join(process.resourcesPath, 'models');
  const { createStore } = await import('./storage.mjs');
  const store = createStore(process.env.OINTEL_DATA_DIR || path.join(app.getPath('userData'), 'workspace'));
  const { createZoomService } = await import('./zoom-service.mjs');
  const zoom = createZoomService({ directory: process.env.OINTEL_DATA_DIR ? path.join(store.directory, '.connections') : path.join(app.getPath('userData'), 'connections'), safeStorage, openExternal: url => shell.openExternal(url) });
  const vectors = require('./vector-service.cjs').createVectorService(store.directory, status => { if (win && !win.isDestroyed()) win.webContents.send('vector:status', status); });
  const page = dev ? 'http://127.0.0.1:5173/' : pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
  function trusted(event) {
    if (event.sender !== win?.webContents || event.senderFrame !== win?.webContents.mainFrame || event.senderFrame.url.split('#')[0] !== page) throw new Error('Untrusted request');
  }
  const handle = (name, callback) => ipcMain.handle(name, (event, ...args) => { trusted(event); return callback(...args); });
  const { nodeLinkClipboard } = await import('../shared/node-links.mjs');
  handle('node:copy-link', node => { const data = nodeLinkClipboard(node); return clipboard.write([new ClipboardItem({ 'text/plain': data.text, 'text/html': data.html })]); });
  const speech = require('./speech-service.cjs').createSpeechService({ directory: path.join(store.directory, '.meetings'), modelDirectory: process.env.OINTEL_BUNDLED_MODELS ? path.join(process.env.OINTEL_BUNDLED_MODELS, 'speech') : process.env.OINTEL_SPEECH_MODELS || path.join(app.getPath('userData'), 'speech-models'), fork: (...args) => utilityProcess.fork(...args), onStatus: status => { if (win && !win.isDestroyed()) win.webContents.send('speech:status', status); } });
  let captureUntil = 0, microphoneAllowed = false;
  const ownFrame = frame => frame === win?.webContents.mainFrame && frame?.url.split('#')[0] === page;
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!ownFrame(request.frame) || Date.now() > captureUntil || !speech.isActive()) { callback({}); return; }
    captureUntil = 0;
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
      if (!sources.length || !speech.isActive()) { callback({}); return; }
      callback({ video: sources[0], audio: 'loopback' });
    } catch { callback({}); }
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const trustedPage = contents === win?.webContents && details.isMainFrame && details.requestingUrl?.split('#')[0] === page;
    callback(!!trustedPage && (permission === 'clipboard-sanitized-write' || (permission === 'display-capture' && speech.isActive()) || (permission === 'media' && microphoneAllowed && speech.isActive() && !details.mediaTypes?.includes('video'))));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) =>
    !!(contents === win?.webContents && details.isMainFrame && details.requestingUrl?.split('#')[0] === page && (permission === 'clipboard-sanitized-write' || (permission === 'display-capture' && speech.isActive()) || (permission === 'media' && details.mediaType !== 'video' && microphoneAllowed && speech.isActive()))));
  handle('speech:status', () => speech.status());
  handle('speech:prepare', () => speech.prepare());
  handle('speech:start', async options => {
    if (!['darwin', 'win32'].includes(process.platform)) throw new Error('Native system audio capture currently supports macOS 14.2+ and Windows.');
    if (process.platform === 'darwin') {
      const [major, minor] = process.getSystemVersion().split('.').map(Number);
      if (major < 14 || (major === 14 && minor < 2)) throw new Error('Live system audio requires macOS 14.2 or later.');
    }
    const result = await speech.start(options || {});
    captureUntil = Date.now() + 60000; microphoneAllowed = !!options?.microphone; return result;
  });
  handle('speech:audio', chunk => speech.audio(chunk));
  handle('speech:stop', () => { captureUntil = 0; microphoneAllowed = false; return speech.stop(); });
  handle('speech:edit', patch => speech.edit(patch));
  handle('speech:discard', () => speech.discard());
  handle('workspace:load', async () => { const workspace = await store.load(); if (workspace) vectors.sync(workspace); return workspace; });
  handle('workspace:save', async workspace => { await store.save(workspace); vectors.sync(workspace); });
  handle('vector:search', (text, includeHistory) => vectors.search(text, includeHistory));
  handle('vector:status', () => vectors.status());
  handle('vector:retry', () => vectors.retry());
  handle('zoom:status', () => zoom.status());
  handle('zoom:connect', clientId => zoom.connect(clientId));
  handle('zoom:cancel', () => zoom.cancel());
  handle('zoom:disconnect', () => zoom.disconnect());
  handle('zoom:list', (from, to, nextPage) => zoom.list(from, to, nextPage));
  handle('zoom:transcript', key => zoom.transcript(key));
  handle('workspace:reveal', async () => { await require('node:fs/promises').mkdir(store.directory, { recursive: true }); await shell.openPath(store.directory); });
  handle('app:open-external', async value => {
    const url = new URL(value);
    if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) throw new Error('Unsupported link');
    await shell.openExternal(url.href);
  });
  ipcMain.on('app:close-ready', async event => {
    trusted(event);
    try { await speech.stop(); await store.flush(); canClose = true; win.close(); }
    catch { closePending = false; }
  });
  ipcMain.on('app:close-failed', event => { trusted(event); closePending = false;
    dialog.showMessageBox(win, { type: 'error', message: 'Your latest changes could not be saved.', detail: 'The window will stay open. Export your map as a backup before closing.' }); });
  function createWindow() {
    canClose = false;
    win = new BrowserWindow({ width: 1520, height: 980, minWidth: 1050, minHeight: 700, show: process.env.OINTEL_TEST_MODE !== '1',
      title: 'Ointel', backgroundColor: '#f8f9f6', autoHideMenuBar: true, icon: path.join(__dirname, '../build/icon.png'),
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => { if (isMainFrame && speech.isActive()) { captureUntil = 0; microphoneAllowed = false; void speech.stop(); } });
    win.webContents.on('render-process-gone', () => { captureUntil = 0; microphoneAllowed = false; void speech.stop(); });
    win.on('close', event => {
      if (canClose) return;
      event.preventDefault();
      if (!closePending) { closePending = true; win.webContents.send('app:before-close'); }
    });
    win.loadURL(page);
  }
  createWindow();
  app.on('will-quit', () => { zoom.cancel(); void vectors.stop(); void speech.shutdown(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

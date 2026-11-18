const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const workspaceStore = require('./workspace.cjs');
if (process.env.TOM_OFFICE_TEST_PROFILE) app.setPath('userData', process.env.TOM_OFFICE_TEST_PROFILE);
let win;
let closing = false;
let rendererReady = false;
const pendingFiles = [];
const supported = /\.(tom|docx|xlsx|pptx|txt|csv)$/i;
async function readSource(filePath) {
  if (!path.isAbsolute(filePath) || !supported.test(filePath)) throw new Error('不支持的文件类型');
  const stat = await fs.stat(filePath);
  if (!stat.isFile() || stat.size > 50 * 1024 * 1024) throw new Error('支持打开 50 MB 以内的办公文件');
  const bytes = await fs.readFile(filePath);
  await rememberPath(filePath);
  return { path: filePath, name: path.basename(filePath), bytes: new Uint8Array(bytes) };
}
function queueFile(filePath) {
  if (!supported.test(filePath) || !path.isAbsolute(filePath)) return;
  if (rendererReady && win) readSource(filePath).then(source => send({ type: 'open-source', source })).catch(error => dialog.showErrorBox('打开文件失败', error.message));
  else pendingFiles.push(filePath);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  process.argv.filter(arg => !arg.startsWith('--')).forEach(queueFile);
  app.on('second-instance', (_, args) => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } args.filter(arg => !arg.startsWith('--')).forEach(queueFile); });
  app.on('open-file', (event, filePath) => { event.preventDefault(); queueFile(filePath); });
}
const allowedPaths = new Set();
const isDev = process.argv.includes('--dev');
const workspacePath = () => path.join(app.getPath('userData'), 'workspace.json');
const grantsPath = () => path.join(app.getPath('userData'), 'file-grants.json');
let grantsQueue = Promise.resolve();
function rememberPath(filePath) {
  allowedPaths.add(filePath);
  grantsQueue = grantsQueue.catch(() => {}).then(async () => {
    await fs.mkdir(app.getPath('userData'), { recursive: true });
    await fs.writeFile(grantsPath() + '.tmp', JSON.stringify([...allowedPaths].slice(-2000)));
    await fs.rename(grantsPath() + '.tmp', grantsPath());
  });
  return grantsQueue.catch(() => {});
}
const send = (action) => win?.webContents.send('office:action', action);
function createWindow() {
  win = new BrowserWindow({ width: 1440, height: 940, minWidth: 1050, minHeight: 720, title: 'Tom Office', icon: path.join(__dirname, '../assets/icon.png'), backgroundColor: '#e8edf8', show: false, frame: false, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });
  if (isDev) win.loadURL('http://127.0.0.1:5173');
  else win.loadFile(path.join(__dirname, '../dist/index.html'));
  win.on('close', event => {
    if (!closing) { event.preventDefault(); send('quit'); }
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: '文件', submenu: [
      { label: '新建文字', accelerator: 'CmdOrCtrl+N', click: () => send('new-doc') },
      { label: '打开', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
      { label: '快捷操作', accelerator: 'CmdOrCtrl+K', click: () => send('palette') },
      { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
      { label: '另存为', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('saveAs') },
      { type: 'separator' }, { label: '打印 / PDF', accelerator: 'CmdOrCtrl+P', click: () => send('print') },
      { type: 'separator' }, { label: '退出', click: () => win.close() }
    ] },
    { label: '编辑', submenu: [{ label: '撤销', accelerator: 'CmdOrCtrl+Z', click: () => send('undo') }, { label: '重做', accelerator: 'CmdOrCtrl+Y', click: () => send('redo') }, { type: 'separator' }, { role: 'cut', label: '剪切' }, { role: 'copy', label: '复制' }, { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' }] },
    { label: '视图', submenu: [{ role: 'togglefullscreen', label: '全屏' }, ...(isDev ? [{ role: 'toggleDevTools' }] : [])] }
  ]));
}
function fromApp(event) {
  if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('不可信的请求');
}
ipcMain.handle('office:window', (event, action) => {
  fromApp(event);
  if (action === 'minimize') win.minimize();
  if (action === 'maximize') win.isMaximized() ? win.unmaximize() : win.maximize();
  if (action === 'close') win.close();
  if (action === 'quit') { closing = true; win.close(); }
});
ipcMain.handle('office:open', async event => {
  fromApp(event);
  const result = await dialog.showOpenDialog(win, { filters: [{ name: '办公文档', extensions: ['tom', 'docx', 'xlsx', 'pptx', 'txt', 'csv'] }], properties: ['openFile'] });
  if (result.canceled) return null;
  return readSource(result.filePaths[0]);
});
ipcMain.handle('office:pending', async event => {
  fromApp(event); rendererReady = true;
  const sources = [];
  for (const filePath of pendingFiles.splice(0)) try { sources.push(await readSource(filePath)); } catch (error) { dialog.showErrorBox('打开文件失败', error.message); }
  return sources;
});
ipcMain.handle('office:save', async (event, payload) => {
  fromApp(event);
  const { bytes, name, extension, existingPath } = payload;
  if (!['tom', 'docx', 'xlsx', 'pptx', 'txt', 'csv', 'pdf'].includes(extension)) throw new Error('不支持的格式');
  let filePath = existingPath && allowedPaths.has(existingPath) && path.extname(existingPath).toLowerCase() === `.${extension}` ? existingPath : null;
  if (!filePath) {
    const result = await dialog.showSaveDialog(win, { defaultPath: `${path.basename(name).replace(/\.(tom|docx|xlsx|pptx|txt|csv|pdf)$/i, '')}.${extension}`, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] });
    if (result.canceled) return null;
    filePath = result.filePath;
  }
  const temporaryPath = filePath + '.tom-office.tmp';
  try {
    await fs.writeFile(temporaryPath, Buffer.from(bytes));
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
  await rememberPath(filePath);
  return filePath;
});
let saveQueue = Promise.resolve();
ipcMain.handle('office:workspace-folder', async event => {
  fromApp(event);
  const error = await shell.openPath(app.getPath('userData'));
  if (error) throw new Error(error);
});
ipcMain.handle('office:workspace-load', async event => {
  fromApp(event);
  return workspaceStore.loadWorkspace(workspacePath());
});
ipcMain.handle('office:workspace-save', (event, data) => {
  fromApp(event);
  const serialized = JSON.stringify(data);
  saveQueue = saveQueue.catch(() => {}).then(() => workspaceStore.saveWorkspace(workspacePath(), serialized));
  return saveQueue;
});
async function outputDocument(payload, asPDF) {
  if (!payload || typeof payload.html !== 'string' || payload.html.length > 220 * 1024 * 1024) throw new Error('打印内容无效或过大');
  const printWindow = new BrowserWindow({ show: false, parent: win, skipTaskbar: true, width: 1000, height: 750, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false } });
  printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  printWindow.webContents.on('will-navigate', event => event.preventDefault());
  try {
    await printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(payload.html));
    if (asPDF) return new Uint8Array(await printWindow.webContents.printToPDF({ printBackground: true, preferCSSPageSize: false, pageSize: typeof payload.pageSize === 'object' ? { width: payload.pageSize.width / 25.4, height: payload.pageSize.height / 25.4 } : payload.pageSize || 'A4', landscape: !!payload.landscape, margins: Object.fromEntries(Object.entries(payload.margins || {}).map(([key, value]) => [key, value / 25.4])) }));
    return await new Promise((resolve, reject) => printWindow.webContents.print({ printBackground: true, landscape: !!payload.landscape, pageSize: typeof payload.pageSize === 'object' ? { width: Math.round(payload.pageSize.width * 1000), height: Math.round(payload.pageSize.height * 1000) } : payload.pageSize || 'A4', margins: { marginType: 'custom', ...Object.fromEntries(Object.entries(payload.margins || {}).map(([key, value]) => [key, Math.round(value / 25.4 * 96)])) } }, (success, reason) => success ? resolve(true) : /cancel/i.test(reason) ? resolve(false) : reject(new Error(reason))));
  } finally { printWindow.destroy(); }
}
ipcMain.handle('office:print', async (event, payload) => { fromApp(event); return outputDocument(payload, false); });
ipcMain.handle('office:pdf', async (event, payload) => { fromApp(event); return outputDocument(payload, true); });
app.whenReady().then(async () => {
  try {
    const grants = JSON.parse(await fs.readFile(grantsPath(), 'utf8'));
    if (Array.isArray(grants)) grants.filter(p => typeof p === 'string' && path.isAbsolute(p)).forEach(p => allowedPaths.add(p));
  } catch { /* Missing grants simply cause a fresh save dialog. */ }
  createWindow();
});
app.on('window-all-closed', () => app.quit());

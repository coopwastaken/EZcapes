const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

const LIBRARY_DIR = path.join(app.getPath('userData'), 'library');
const SKINS_DIR = path.join(app.getPath('userData'), 'skins');
const CAPES_DIR = path.join(app.getPath('userData'), 'capes');
const MC_SKIN_PACKS = 'C:\\XboxGames\\Minecraft for Windows\\Content\\data\\skin_packs';

function ensureDirs() {
  for (const d of [LIBRARY_DIR, SKINS_DIR, CAPES_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: 'EZCAPES',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0c0a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'web', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  ensureDirs();
  createWindow();

  // Auto-update — downloads and restarts automatically
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});

  autoUpdater.on('update-available', () => {
    if (mainWindow) mainWindow.webContents.executeJavaScript("typeof toast==='function'&&toast('Update available — downloading...')");
  });
  autoUpdater.on('update-downloaded', () => {
    if (mainWindow) mainWindow.webContents.executeJavaScript("typeof toast==='function'&&toast('Installing update — restarting...')");
    // Auto restart after a short delay so the user sees the toast
    setTimeout(() => { autoUpdater.quitAndInstall(false, true); }, 2000);
  });
});

app.on('window-all-closed', () => app.quit());

// ── IPC Handlers ──

// Get library presets
ipcMain.handle('library:list', () => {
  ensureDirs();
  const presets = [];
  for (const name of fs.readdirSync(LIBRARY_DIR)) {
    const dir = path.join(LIBRARY_DIR, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const metaPath = path.join(dir, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      presets.push({ id: name, ...meta });
    } catch (e) { /* skip bad entries */ }
  }
  return presets.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
});

// Save pack to library
ipcMain.handle('library:save', (e, { name, zipBuffer }) => {
  ensureDirs();
  const id = name.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + Date.now();
  const dir = path.join(LIBRARY_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'pack.zip'), Buffer.from(zipBuffer));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ name, savedAt: Date.now() }));
  return { id, name };
});

// Delete from library
ipcMain.handle('library:delete', (e, id) => {
  const dir = path.join(LIBRARY_DIR, id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  return true;
});

// Install pack to Minecraft
ipcMain.handle('pack:install', async (e, { zipBuffer, presetId }) => {
  let buf;
  if (presetId) {
    const zipPath = path.join(LIBRARY_DIR, presetId, 'pack.zip');
    if (!fs.existsSync(zipPath)) throw new Error('Preset not found');
    buf = fs.readFileSync(zipPath);
  } else {
    buf = Buffer.from(zipBuffer);
  }

  // Check if Minecraft folder exists
  if (!fs.existsSync(MC_SKIN_PACKS)) {
    throw new Error('Minecraft skin_packs folder not found at: ' + MC_SKIN_PACKS);
  }

  // Extract zip
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buf);

  // Find the root folder name in the zip
  let rootFolder = null;
  for (const name of Object.keys(zip.files)) {
    if (zip.files[name].dir) {
      rootFolder = name.replace(/\/$/, '');
      break;
    }
  }
  if (!rootFolder) throw new Error('Invalid pack zip — no folder found');

  const destDir = path.join(MC_SKIN_PACKS, rootFolder);

  // Remove existing if present
  if (fs.existsSync(destDir)) fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });

  // Extract all files
  for (const [filePath, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    // Strip root folder prefix
    const relative = filePath.startsWith(rootFolder + '/') ? filePath.slice(rootFolder.length + 1) : filePath;
    if (!relative) continue;
    const dest = path.join(destDir, relative);
    const destParent = path.dirname(dest);
    if (!fs.existsSync(destParent)) fs.mkdirSync(destParent, { recursive: true });
    const content = await file.async('nodebuffer');
    fs.writeFileSync(dest, content);
  }

  return { installed: true, folder: rootFolder };
});

// Open file dialog
ipcMain.handle('dialog:openFiles', async (e, opts) => {
  const result = await dialog.showOpenDialog(mainWindow, opts);
  if (result.canceled) return [];
  // Read files and return as array of { name, buffer }
  return result.filePaths.map(fp => ({
    name: path.basename(fp),
    buffer: fs.readFileSync(fp).buffer,
    path: fp,
  }));
});

// Get install path
ipcMain.handle('pack:getInstallPath', () => MC_SKIN_PACKS);

// Read current installed pack (for "Start from Current")
ipcMain.handle('pack:readCurrent', async () => {
  const customDir = path.join(MC_SKIN_PACKS, 'custom');
  if (!fs.existsSync(customDir)) return null;

  const result = { skins: [], capes: [], name: 'Custom Cape Pack' };

  // Read manifest for pack name
  const manifestPath = path.join(customDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.header && manifest.header.name) result.name = manifest.header.name;
    } catch (e) {}
  }

  // Read lang file for display names
  const langNames = {};
  const langPath = path.join(customDir, 'texts', 'en_US.lang');
  if (fs.existsSync(langPath)) {
    try {
      fs.readFileSync(langPath, 'utf8').split('\n').forEach(line => {
        const eq = line.indexOf('=');
        if (eq > 0) langNames[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
      });
    } catch (e) {}
  }

  // Read skins.json for skin/cape file references with names
  const skinsJsonPath = path.join(customDir, 'skins.json');
  if (fs.existsSync(skinsJsonPath)) {
    try {
      const skinsData = JSON.parse(fs.readFileSync(skinsJsonPath, 'utf8'));
      const packId = skinsData.localization_name || skinsData.serialize_name || 'custom';
      const skinFilesSeen = new Set();
      const capeFilesSeen = new Set();

      if (skinsData.skins) {
        skinsData.skins.forEach(s => {
          // Get display name from lang file
          const langKey = `skin.${packId}.${s.localization_name}`;
          const displayName = langNames[langKey] || s.localization_name || '';

          // Add skin (dedupe by filename)
          if (s.texture && !skinFilesSeen.has(s.texture)) {
            skinFilesSeen.add(s.texture);
            const fp = path.join(customDir, s.texture);
            if (fs.existsSync(fp)) {
              // Extract skin name from display name (format: "SkinName + CapeName")
              const skinName = displayName.includes(' + ') ? displayName.split(' + ')[0] : s.texture.replace(/\.png$/i, '');
              result.skins.push({
                name: skinName,
                dataURL: 'data:image/png;base64,' + fs.readFileSync(fp).toString('base64')
              });
            }
          }

          // Add cape (dedupe by filename)
          if (s.cape && !capeFilesSeen.has(s.cape)) {
            capeFilesSeen.add(s.cape);
            const fp = path.join(customDir, s.cape);
            if (fs.existsSync(fp)) {
              const capeName = displayName.includes(' + ') ? displayName.split(' + ')[1] : s.cape.replace(/\.png$/i, '');
              result.capes.push({
                name: capeName,
                dataURL: 'data:image/png;base64,' + fs.readFileSync(fp).toString('base64')
              });
            }
          }
        });
      }
    } catch (e) {}
  }

  return result;
});

// ── Skin Library ──
ipcMain.handle('skinLib:list', () => {
  ensureDirs();
  const metaPath = path.join(SKINS_DIR, 'meta.json');
  if (!fs.existsSync(metaPath)) return [];
  return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
});

ipcMain.handle('skinLib:save', (e, { name, dataURL }) => {
  ensureDirs();
  const id = 'skin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const b64 = dataURL.split(',')[1];
  fs.writeFileSync(path.join(SKINS_DIR, id + '.png'), Buffer.from(b64, 'base64'));
  const metaPath = path.join(SKINS_DIR, 'meta.json');
  const list = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : [];
  list.push({ id, name, file: id + '.png', savedAt: Date.now() });
  fs.writeFileSync(metaPath, JSON.stringify(list));
  return { id };
});

ipcMain.handle('skinLib:delete', (e, id) => {
  ensureDirs();
  const metaPath = path.join(SKINS_DIR, 'meta.json');
  if (!fs.existsSync(metaPath)) return;
  let list = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const item = list.find(s => s.id === id);
  if (item) {
    const fp = path.join(SKINS_DIR, item.file);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  list = list.filter(s => s.id !== id);
  fs.writeFileSync(metaPath, JSON.stringify(list));
});

ipcMain.handle('skinLib:getDataURL', (e, id) => {
  ensureDirs();
  const fp = path.join(SKINS_DIR, id + '.png');
  if (!fs.existsSync(fp)) return null;
  return 'data:image/png;base64,' + fs.readFileSync(fp).toString('base64');
});

// ── Cape Library ──
ipcMain.handle('capeLib:list', () => {
  ensureDirs();
  const metaPath = path.join(CAPES_DIR, 'meta.json');
  if (!fs.existsSync(metaPath)) return [];
  return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
});

ipcMain.handle('capeLib:save', (e, { name, dataURL }) => {
  ensureDirs();
  const id = 'cape_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const b64 = dataURL.split(',')[1];
  fs.writeFileSync(path.join(CAPES_DIR, id + '.png'), Buffer.from(b64, 'base64'));
  const metaPath = path.join(CAPES_DIR, 'meta.json');
  const list = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : [];
  list.push({ id, name, file: id + '.png', savedAt: Date.now() });
  fs.writeFileSync(metaPath, JSON.stringify(list));
  return { id };
});

ipcMain.handle('capeLib:delete', (e, id) => {
  ensureDirs();
  const metaPath = path.join(CAPES_DIR, 'meta.json');
  if (!fs.existsSync(metaPath)) return;
  let list = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const item = list.find(c => c.id === id);
  if (item) {
    const fp = path.join(CAPES_DIR, item.file);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  list = list.filter(c => c.id !== id);
  fs.writeFileSync(metaPath, JSON.stringify(list));
});

ipcMain.handle('capeLib:getDataURL', (e, id) => {
  ensureDirs();
  const fp = path.join(CAPES_DIR, id + '.png');
  if (!fs.existsSync(fp)) return null;
  return 'data:image/png;base64,' + fs.readFileSync(fp).toString('base64');
});

// ── Rename preset ──
ipcMain.handle('library:rename', (e, { id, newName }) => {
  const metaPath = path.join(LIBRARY_DIR, id, 'meta.json');
  if (!fs.existsSync(metaPath)) return false;
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.name = newName;
  fs.writeFileSync(metaPath, JSON.stringify(meta));
  return true;
});

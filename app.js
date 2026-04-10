// ═══════════════ EZCapes App Logic ═══════════════
const CB = { skins: [], capes: [], assignments: {}, nSkinId: 0, nCapeId: 0 };
let lastZipBuffer = null;

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Toast
const toastEl = document.createElement('div');
toastEl.className = 'toast';
document.body.appendChild(toastEl);
let toastTimer;
function toast(msg, err) {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (err ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  setupDropzones();
  setupButtons();
  loadPresets();
  loadSkinLib();
  loadCapeLib();
  const installPath = await window.ezcapes.getInstallPath();
  $('#installPath').textContent = installPath;
});

// ── Dropzones ──
function setupDropzones() {
  // Skin dropzone
  const skinDz = $('#skinDropzone');
  skinDz.addEventListener('dragover', e => { e.preventDefault(); skinDz.classList.add('over'); });
  skinDz.addEventListener('dragleave', () => skinDz.classList.remove('over'));
  skinDz.addEventListener('drop', e => { e.preventDefault(); skinDz.classList.remove('over'); handleSkinDrop(e.dataTransfer.files); });
  skinDz.addEventListener('click', async () => {
    const files = await window.ezcapes.openFiles({
      filters: [{ name: 'Skin Images', extensions: ['png'] }],
      properties: ['openFile', 'multiSelections'],
    });
    if (files.length) addSkinBuffers(files);
  });

  // Cape dropzone
  const capeDz = $('#capeDropzone');
  capeDz.addEventListener('dragover', e => { e.preventDefault(); capeDz.classList.add('over'); });
  capeDz.addEventListener('dragleave', () => capeDz.classList.remove('over'));
  capeDz.addEventListener('drop', e => { e.preventDefault(); capeDz.classList.remove('over'); handleCapeDrop(e.dataTransfer.files); });
  capeDz.addEventListener('click', async () => {
    const files = await window.ezcapes.openFiles({
      filters: [{ name: 'Cape Images', extensions: ['png'] }],
      properties: ['openFile', 'multiSelections'],
    });
    if (files.length) addCapeBuffers(files);
  });
}

// ── Skin handling ──
function handleSkinDrop(fileList) {
  for (const f of fileList) {
    if (!f.type.startsWith('image/')) continue;
    const r = new FileReader();
    r.onload = v => loadSkinFromDataURL(v.target.result, f.name.replace(/\.png$/i, ''));
    r.readAsDataURL(f);
  }
}

function addSkinBuffers(files) {
  for (const f of files) {
    const blob = new Blob([f.buffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      loadSkinFromDataURL(c.toDataURL('image/png'), f.name.replace(/\.png$/i, ''));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
}

function loadSkinFromDataURL(dataURL, name) {
  const img = new Image();
  img.onload = () => {
    const w = img.width, h = img.height;
    if (!((w === 64 && (h === 64 || h === 32)) || (w === 128 && h === 128))) {
      toast('Invalid skin: ' + name, true); return;
    }
    const slim = detectSlim(img);
    const id = CB.nSkinId++;
    CB.skins.push({ id, name, dataURL, thumb: makeThumb(img), slim, w, h });
    CB.assignments[id] = [];
    renderSkins(); renderAssignments(); updateBuildBtn();
    // Auto-save to skin library
    window.ezcapes.saveSkin({ name, dataURL }).then(() => loadSkinLib());
  };
  img.src = dataURL;
}

function detectSlim(img) {
  if (img.height < 64) return false;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const s = img.width === 128 ? 2 : 1;
  const d = x.getImageData(0, 0, c.width, c.height).data;
  for (let py = 20 * s; py < 32 * s; py++)
    for (let px = 54 * s; px < 56 * s; px++)
      if (d[(py * c.width + px) * 4 + 3] !== 0) return false;
  return true;
}

function makeThumb(img) {
  const w = img.width, h = img.height, s = w === 128 ? 2 : 1;
  const tc = document.createElement('canvas'); tc.width = 8; tc.height = 8;
  const tx = tc.getContext('2d'); tx.imageSmoothingEnabled = false;
  tx.drawImage(img, 8 * s, 8 * s, 8 * s, 8 * s, 0, 0, 8, 8);
  if (h >= 64 * s) tx.drawImage(img, 40 * s, 8 * s, 8 * s, 8 * s, 0, 0, 8, 8);
  return tc.toDataURL();
}

function renderSkins() {
  const list = $('#skinList'); list.innerHTML = '';
  CB.skins.forEach(s => {
    const el = document.createElement('div'); el.className = 'skin-item';
    el.innerHTML = `<img class="skin-thumb" src="${s.thumb}"><img class="skin-full" src="${s.dataURL}"><div class="skin-info"><div class="skin-name">${esc(s.name)}</div><div class="skin-meta">${s.slim ? 'Slim' : 'Classic'} · ${s.w}x${s.h}</div></div><button class="skin-rm" data-id="${s.id}">✕</button>`;
    el.querySelector('.skin-rm').addEventListener('click', () => {
      CB.skins = CB.skins.filter(x => x.id !== s.id);
      delete CB.assignments[s.id];
      renderSkins(); renderAssignments(); updateBuildBtn();
    });
    list.appendChild(el);
  });
}

// ── Cape handling ──
function handleCapeDrop(fileList) {
  for (const f of fileList) {
    if (!f.type.startsWith('image/')) continue;
    const r = new FileReader();
    r.onload = v => loadCapeFromDataURL(v.target.result, f.name.replace(/\.png$/i, ''));
    r.readAsDataURL(f);
  }
}

function addCapeBuffers(files) {
  for (const f of files) {
    const blob = new Blob([f.buffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      loadCapeFromDataURL(c.toDataURL('image/png'), f.name.replace(/\.png$/i, ''));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
}

function loadCapeFromDataURL(dataURL, name) {
  const img = new Image();
  img.onload = () => {
    const id = CB.nCapeId++;
    CB.capes.push({ id, name, dataURL, w: img.width, h: img.height });
    renderCapes(); renderAssignments(); updateBuildBtn();
    // Auto-save to cape library
    window.ezcapes.saveCape({ name, dataURL }).then(() => loadCapeLib());
  };
  img.src = dataURL;
}

function cropCape(dataURL) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 10; c.height = 16;
      const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 1, 1, 10, 16, 0, 0, 10, 16);
      res(c.toDataURL());
    };
    img.onerror = () => res(dataURL);
    img.src = dataURL;
  });
}

async function renderCapes() {
  const grid = $('#capeGrid'); grid.innerHTML = '';
  for (const c of CB.capes) {
    if (!c.thumbURL) c.thumbURL = await cropCape(c.dataURL);
    const card = document.createElement('div'); card.className = 'cape-card';
    card.innerHTML = `<img class="cape-thumb" src="${c.thumbURL}"><div class="cape-name">${esc(c.name)}</div><button class="cape-rm" data-id="${c.id}">✕</button>`;
    card.querySelector('.cape-rm').addEventListener('click', () => {
      CB.capes = CB.capes.filter(x => x.id !== c.id);
      for (const sid in CB.assignments) CB.assignments[sid] = CB.assignments[sid].filter(cid => cid !== c.id);
      renderCapes(); renderAssignments(); updateBuildBtn();
    });
    grid.appendChild(card);
  }
}

// ── Assignments ──
function renderAssignments() {
  const area = $('#assignArea'), empty = $('#assignEmpty');
  area.innerHTML = '';
  if (!CB.skins.length || !CB.capes.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  CB.skins.forEach(skin => {
    if (!CB.assignments[skin.id]) CB.assignments[skin.id] = [];
    const section = document.createElement('div'); section.className = 'assign-section';
    const assigned = CB.assignments[skin.id].length;
    section.innerHTML = `<div class="assign-header"><img class="skin-thumb" src="${skin.thumb}"><div class="assign-skin-name">${esc(skin.name)}</div><span class="assign-count">${assigned}/${CB.capes.length}</span></div>`;
    const toggles = document.createElement('div'); toggles.className = 'assign-toggles';
    CB.capes.forEach(cape => {
      const isOn = CB.assignments[skin.id].includes(cape.id);
      const t = document.createElement('div'); t.className = 'assign-toggle' + (isOn ? ' on' : '');
      t.innerHTML = `<img class="assign-toggle-thumb" src="${cape.thumbURL || cape.dataURL}"><span class="assign-toggle-name">${esc(cape.name)}</span>`;
      t.addEventListener('click', () => {
        const arr = CB.assignments[skin.id];
        const idx = arr.indexOf(cape.id);
        if (idx >= 0) arr.splice(idx, 1); else arr.push(cape.id);
        renderAssignments(); updateBuildBtn();
      });
      toggles.appendChild(t);
    });
    section.appendChild(toggles);
    area.appendChild(section);
  });
}

function updateBuildBtn() {
  let total = 0;
  for (const sid in CB.assignments) total += CB.assignments[sid].length;
  $('#btnBuild').disabled = total === 0;
  $('#btnInstall').disabled = !lastZipBuffer;
}

// ── Buttons ──
function setupButtons() {
  $('#btnAssignAll').addEventListener('click', () => {
    CB.skins.forEach(s => { CB.assignments[s.id] = CB.capes.map(c => c.id); });
    renderAssignments(); updateBuildBtn();
  });
  $('#btnClearAll').addEventListener('click', () => {
    CB.skins.forEach(s => { CB.assignments[s.id] = []; });
    renderAssignments(); updateBuildBtn();
  });
  $('#btnBuild').addEventListener('click', buildPack);
  $('#btnInstall').addEventListener('click', installPack);
}

// ── Build Pack ──
async function buildPack() {
  let totalEntries = 0;
  for (const sid in CB.assignments) totalEntries += CB.assignments[sid].length;
  if (!totalEntries) { toast('Assign capes to skins first', true); return; }

  const btn = $('#btnBuild');
  btn.disabled = true;
  showProgress('Building pack...', 0);

  const packName = $('#packName').value.trim() || 'Custom Cape Pack';
  const packDesc = $('#packDesc').value.trim() || 'Made with EZCapes';
  const ver = ($('#packVer').value || '1.0.0').split('.').map(Number);
  while (ver.length < 3) ver.push(0);

  const folderName = 'custom';
  const z = new JSZip();
  const folder = z.folder(folderName);

  // manifest.json
  folder.file('manifest.json', JSON.stringify({
    format_version: 1,
    header: { name: packName, description: packDesc, uuid: uuid(), version: ver },
    modules: [{ type: 'skin_pack', uuid: uuid(), version: ver }]
  }, null, 2));

  showProgress('Adding textures...', 20);

  // Add skin + cape files
  const skinFileMap = {}, capeFileMap = {};
  for (const skin of CB.skins) {
    const fname = 'skin_' + skin.id + '.png';
    skinFileMap[skin.id] = fname;
    folder.file(fname, skin.dataURL.split(',')[1], { base64: true });
  }
  for (const cape of CB.capes) {
    const fname = 'cape_' + cape.id + '.png';
    capeFileMap[cape.id] = fname;
    folder.file(fname, cape.dataURL.split(',')[1], { base64: true });
  }

  showProgress('Generating skins.json...', 40);

  // Build skins.json
  const skinEntries = [];
  const langLines = [];
  const langPackId = folderName.replace(/[^a-zA-Z0-9]/g, '');
  langLines.push(`skinpack.${langPackId}=${packName.replace(/§./g, '')}`);

  let entryIdx = 0;
  for (const skin of CB.skins) {
    const assignedCapes = CB.assignments[skin.id] || [];
    const geom = skin.slim ? 'geometry.humanoid.customSlim' : 'geometry.humanoid.custom';
    for (const capeId of assignedCapes) {
      const cape = CB.capes.find(c => c.id === capeId);
      if (!cape) continue;
      const locName = `entry_${entryIdx}`;
      skinEntries.push({ localization_name: locName, geometry: geom, texture: skinFileMap[skin.id], cape: capeFileMap[capeId], type: 'free' });
      langLines.push(`skin.${langPackId}.${locName}=${skin.name} + ${cape.name}`);
      entryIdx++;
    }
  }

  folder.file('skins.json', JSON.stringify({ skins: skinEntries, serialize_name: langPackId, localization_name: langPackId }, null, 2));
  folder.folder('texts').file('en_US.lang', langLines.join('\n'));

  showProgress('Compressing...', 70);

  const blob = await z.generateAsync({ type: 'arraybuffer' }, meta => {
    showProgress('Compressing...', 70 + meta.percent * 0.3);
  });

  lastZipBuffer = blob;
  showProgress('Done! Pack built.', 100);

  // Save to library
  try {
    await window.ezcapes.savePreset({ name: packName, zipBuffer: blob });
    await loadPresets();
    toast('Pack saved to library!');
  } catch (e) {
    toast('Built but failed to save: ' + e.message, true);
  }

  btn.disabled = false;
  updateBuildBtn();
  setTimeout(() => hideProgress(), 2000);
}

// ── Install to Minecraft ──
async function installPack() {
  if (!lastZipBuffer) { toast('Build a pack first', true); return; }
  const btn = $('#btnInstall');
  btn.disabled = true;
  showProgress('Installing to Minecraft...', 50);
  try {
    const result = await window.ezcapes.installPack({ zipBuffer: lastZipBuffer });
    showProgress('Installed! Restart Minecraft to see capes.', 100);
    toast('Installed to ' + result.folder + '!');
  } catch (e) {
    showProgress('Install failed: ' + e.message, 0);
    toast('Install failed: ' + e.message, true);
  }
  btn.disabled = false;
  setTimeout(() => hideProgress(), 3000);
}

// ── Install preset from library ──
async function installPreset(presetId) {
  showProgress('Installing preset...', 50);
  try {
    const result = await window.ezcapes.installPack({ presetId });
    showProgress('Installed!', 100);
    toast('Installed to ' + result.folder + '!');
  } catch (e) {
    showProgress('Install failed: ' + e.message, 0);
    toast('Install failed: ' + e.message, true);
  }
  setTimeout(() => hideProgress(), 3000);
}

// ── Presets (Packs Library) ──
async function loadPresets() {
  const presets = await window.ezcapes.listPresets();
  const list = $('#presetList');
  if (!presets.length) {
    list.innerHTML = '<div class="preset-empty">No saved packs yet</div>';
    return;
  }
  list.innerHTML = '';
  presets.forEach(p => {
    const el = document.createElement('div'); el.className = 'preset-item';
    el.innerHTML = `<div class="preset-name" title="Double-click to rename">${esc(p.name)}</div><div class="preset-actions"><button class="preset-btn install" title="Install">Install</button><button class="preset-btn del" title="Delete">✕</button></div>`;
    // Install
    el.querySelector('.install').addEventListener('click', e => { e.stopPropagation(); installPreset(p.id); });
    // Delete
    el.querySelector('.del').addEventListener('click', async e => {
      e.stopPropagation();
      await window.ezcapes.deletePreset(p.id);
      loadPresets();
      toast('Deleted ' + p.name);
    });
    // Rename on double-click
    el.querySelector('.preset-name').addEventListener('dblclick', e => {
      const nameEl = e.target;
      const input = document.createElement('input');
      input.type = 'text'; input.value = p.name;
      input.style.cssText = 'width:100%;font-size:12px;font-weight:600;background:rgba(0,0,0,0.3);border:1px solid var(--accent);color:var(--text);padding:2px 4px;border-radius:3px;font-family:var(--font);outline:none;';
      nameEl.replaceWith(input);
      input.focus(); input.select();
      const finish = async () => {
        const newName = input.value.trim() || p.name;
        await window.ezcapes.renamePreset({ id: p.id, newName });
        loadPresets();
        toast('Renamed to ' + newName);
      };
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    });
    list.appendChild(el);
  });
}

// ── Skin Library ──
async function loadSkinLib() {
  const skins = await window.ezcapes.listSkins();
  const list = $('#skinLibList');
  if (!skins.length) {
    list.innerHTML = '<div class="preset-empty">No saved skins</div>';
    return;
  }
  list.innerHTML = '';
  skins.forEach(s => {
    const el = document.createElement('div'); el.className = 'preset-item';
    el.innerHTML = `<div class="preset-name">${esc(s.name)}</div><div class="preset-actions"><button class="preset-btn" title="Add to workspace">+ Use</button><button class="preset-btn del" title="Delete">✕</button></div>`;
    el.querySelector('.preset-btn:not(.del)').addEventListener('click', async e => {
      e.stopPropagation();
      const dataURL = await window.ezcapes.getSkinDataURL(s.id);
      if (dataURL) loadSkinFromDataURL(dataURL, s.name);
    });
    el.querySelector('.del').addEventListener('click', async e => {
      e.stopPropagation();
      await window.ezcapes.deleteSkin(s.id);
      loadSkinLib();
    });
    list.appendChild(el);
  });
}

// ── Cape Library ──
async function loadCapeLib() {
  const capes = await window.ezcapes.listCapes();
  const list = $('#capeLibList');
  if (!capes.length) {
    list.innerHTML = '<div class="preset-empty">No saved capes</div>';
    return;
  }
  list.innerHTML = '';
  capes.forEach(c => {
    const el = document.createElement('div'); el.className = 'preset-item';
    el.innerHTML = `<div class="preset-name">${esc(c.name)}</div><div class="preset-actions"><button class="preset-btn" title="Add to workspace">+ Use</button><button class="preset-btn del" title="Delete">✕</button></div>`;
    el.querySelector('.preset-btn:not(.del)').addEventListener('click', async e => {
      e.stopPropagation();
      const dataURL = await window.ezcapes.getCapeDataURL(c.id);
      if (dataURL) loadCapeFromDataURL(dataURL, c.name);
    });
    el.querySelector('.del').addEventListener('click', async e => {
      e.stopPropagation();
      await window.ezcapes.deleteCape(c.id);
      loadCapeLib();
    });
    list.appendChild(el);
  });
}

// ── Progress ──
function showProgress(text, pct) {
  const card = $('#statusCard');
  card.style.display = '';
  $('#progressFill').style.width = pct + '%';
  $('#statusText').textContent = text;
}
function hideProgress() {
  $('#statusCard').style.display = 'none';
}

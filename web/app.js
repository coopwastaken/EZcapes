// ═══════════════ EZCapes Web App ═══════════════
const CB = { skins: [], capes: [], assignments: {}, nSkinId: 0, nCapeId: 0 };
const selectedSkins = new Set();
const selectedCapes = new Set();

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

// LocalStorage
function lsGet(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

// ══════════════════ NAVIGATION ══════════════════
document.addEventListener('DOMContentLoaded', () => {
  $$('.nav-tab').forEach(tab => tab.addEventListener('click', () => {
    $$('.nav-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $$('.page').forEach(p => p.classList.remove('active'));
    $(`#page-${tab.dataset.page}`).classList.add('active');
    if (tab.dataset.page === 'skins') renderSkinLibPage();
    if (tab.dataset.page === 'capes') renderCapeLibPage();
    if (tab.dataset.page === 'packs') renderPacksPage();
  }));

  // Prevent browser from opening dropped files
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => e.preventDefault());

  setupBuilder();
  setupSkinLibPage();
  setupCapeLibPage();
  setupLibDropTargets();
  renderBuiltinCapes();
  renderSidebarProfiles();
});

// ══════════════════ PACK BUILDER ══════════════════
function setupBuilder() {
  // Skin dropzone
  const skinDz = $('#skinDropzone'), skinInput = $('#skinFileInput');
  skinDz.addEventListener('dragover', e => { e.preventDefault(); skinDz.classList.add('over'); });
  skinDz.addEventListener('dragleave', () => skinDz.classList.remove('over'));
  skinDz.addEventListener('drop', e => { e.preventDefault(); skinDz.classList.remove('over'); handleDrop(e.dataTransfer, 'skin'); });
  skinDz.addEventListener('click', () => skinInput.click());
  skinInput.addEventListener('change', e => { handleFileList(e.target.files, 'skin'); e.target.value = ''; });

  // Cape dropzone
  const capeDz = $('#capeDropzone'), capeInput = $('#capeFileInput');
  capeDz.addEventListener('dragover', e => { e.preventDefault(); capeDz.classList.add('over'); });
  capeDz.addEventListener('dragleave', () => capeDz.classList.remove('over'));
  capeDz.addEventListener('drop', e => { e.preventDefault(); capeDz.classList.remove('over'); handleDrop(e.dataTransfer, 'cape'); });
  capeDz.addEventListener('click', () => capeInput.click());
  capeInput.addEventListener('change', e => { handleFileList(e.target.files, 'cape'); e.target.value = ''; });

  // Buttons
  $('#btnAssignAll').addEventListener('click', () => { CB.skins.forEach(s => { CB.assignments[s.id] = CB.capes.map(c => c.id); }); renderAssignments(); updateBuildBtn(); });
  $('#btnClearAll').addEventListener('click', () => { CB.skins.forEach(s => { CB.assignments[s.id] = []; }); renderAssignments(); updateBuildBtn(); });
  $('#btnBuild').addEventListener('click', buildPack);
  $('#btnStartCurrent').addEventListener('click', startFromCurrent);
}

// Handle drop — supports folders via webkitGetAsEntry
async function handleDrop(dataTransfer, type) {
  const items = dataTransfer.items;
  if (!items) { handleFileList(dataTransfer.files, type); return; }
  const allFiles = [];
  const promises = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) promises.push(walkEntry(entry, allFiles));
    else { const f = item.getAsFile(); if (f) allFiles.push(f); }
  }
  await Promise.all(promises);
  let added = 0;
  for (const f of allFiles) {
    if (!f.name.toLowerCase().endsWith('.png')) continue;
    try {
      const dataURL = await readFileAsDataURL(f);
      const img = await loadImage(dataURL);
      const w = img.width, h = img.height;
      if (type === 'skin') {
        if ((w === 64 && (h === 64 || h === 32)) || (w === 128 && h === 128)) { addSkin(dataURL, f.name.replace(/\.png$/i, '')); added++; }
      } else {
        addCape(dataURL, f.name.replace(/\.png$/i, '')); added++;
      }
    } catch (e) { /* skip unreadable files */ }
  }
  if (added) toast(`Added ${added} ${type}${added > 1 ? 's' : ''}`);
  else if (allFiles.length) toast(`No valid ${type}s found`, true);
}
function walkEntry(entry, results) {
  return new Promise(resolve => {
    if (entry.isFile) { entry.file(f => { results.push(f); resolve(); }); }
    else if (entry.isDirectory) {
      entry.createReader().readEntries(async entries => {
        for (const e of entries) await walkEntry(e, results);
        resolve();
      });
    } else resolve();
  });
}
function readFileAsDataURL(f) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }); }
function loadImage(src) { return new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = src; }); }
function handleFileList(fileList, type) {
  for (const f of fileList) {
    if (!f.type.startsWith('image/')) continue;
    const r = new FileReader();
    r.onload = v => {
      if (type === 'skin') addSkin(v.target.result, f.name.replace(/\.png$/i, ''));
      else addCape(v.target.result, f.name.replace(/\.png$/i, ''));
    };
    r.readAsDataURL(f);
  }
}

// ── Skins ──
function skinHash(dataURL) {
  // Quick hash of the base64 data for deduplication
  const b64 = dataURL.split(',')[1] || '';
  // Sample chars from the base64 to create a fast fingerprint
  let h = 0;
  for (let i = 0; i < b64.length; i += 7) h = ((h << 5) - h + b64.charCodeAt(i)) | 0;
  return h;
}

function addSkin(dataURL, name) {
  // Dedupe by name (case insensitive) — same skin name = same skin
  if (CB.skins.find(s => s.name.toLowerCase() === name.toLowerCase())) return;
  const img = new Image();
  img.onload = () => {
    const w = img.width, h = img.height;
    if (!((w === 64 && (h === 64 || h === 32)) || (w === 128 && h === 128))) { toast('Invalid skin: ' + name, true); return; }
    if (CB.skins.find(s => s.name.toLowerCase() === name.toLowerCase())) return;
    const slim = detectSlim(img);
    const id = CB.nSkinId++;
    CB.skins.push({ id, name, dataURL, slim, w, h });
    CB.assignments[id] = [];
    renderBuilderSkins(); renderAssignments(); updateBuildBtn();
    saveSkinToLib(name, dataURL, slim, w, h);
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

function makeSkinHeadThumb(dataURL) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const s = img.width === 128 ? 2 : 1;
      const c = document.createElement('canvas'); c.width = 8; c.height = 8;
      const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 8*s, 8*s, 8*s, 8*s, 0, 0, 8, 8);
      if (img.height >= 64*s) ctx.drawImage(img, 40*s, 8*s, 8*s, 8*s, 0, 0, 8, 8);
      resolve(c.toDataURL());
    };
    img.onerror = () => resolve(dataURL);
    img.src = dataURL;
  });
}

let renderSkinsId = 0;
async function renderBuilderSkins() {
  const myId = ++renderSkinsId;
  const list = $('#builderSkinList'); list.innerHTML = '';
  for (const s of CB.skins) {
    if (myId !== renderSkinsId) return;
    const el = document.createElement('div'); el.className = 'bskin-item';
    const previewDiv = document.createElement('div'); previewDiv.className = 'bskin-preview';
    const thumbImg = document.createElement('img');
    thumbImg.style.cssText = 'width:100%;height:100%;image-rendering:pixelated;object-fit:contain;border-radius:4px;';
    thumbImg.src = await makeSkinHeadThumb(s.dataURL);
    if (myId !== renderSkinsId) return;
    previewDiv.appendChild(thumbImg);
    const infoDiv = document.createElement('div'); infoDiv.className = 'bskin-info';
    infoDiv.innerHTML = `<div class="bskin-name">${esc(s.name)}</div><div class="bskin-meta">${s.slim ? 'Slim' : 'Classic'} · ${s.w}x${s.h}</div>`;
    const rmBtn = document.createElement('button'); rmBtn.className = 'bskin-rm'; rmBtn.textContent = '✕';
    rmBtn.addEventListener('click', () => {
      CB.skins = CB.skins.filter(x => x.id !== s.id);
      delete CB.assignments[s.id];
      renderBuilderSkins(); renderAssignments(); updateBuildBtn();
    });
    el.appendChild(previewDiv);
    el.appendChild(infoDiv);
    el.appendChild(rmBtn);
    list.appendChild(el);
  }
}

// ── Capes ──
function addCape(dataURL, name, saveToLib) {
  if (CB.capes.find(c => c.name.toLowerCase() === name.toLowerCase())) return;
  const img = new Image();
  img.onload = () => {
    if (CB.capes.find(c => c.name.toLowerCase() === name.toLowerCase())) return;
    const id = CB.nCapeId++;
    CB.capes.push({ id, name, dataURL, w: img.width, h: img.height });
    renderBuilderCapes(); renderAssignments(); updateBuildBtn();
    if (saveToLib !== false) saveCapeToLib(name, dataURL);
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

let renderCapesId = 0;
async function renderBuilderCapes() {
  const myId = ++renderCapesId;
  const grid = $('#builderCapeGrid'); grid.innerHTML = '';
  for (const c of CB.capes) {
    if (!c.thumbURL) c.thumbURL = await cropCape(c.dataURL);
    if (myId !== renderCapesId) return; // superseded by newer render
    const card = document.createElement('div'); card.className = 'bcape-card';
    card.innerHTML = `<img class="bcape-thumb" src="${c.thumbURL}"><div class="bcape-name">${esc(c.name)}</div><button class="bcape-rm" data-id="${c.id}">✕</button>`;
    card.querySelector('.bcape-rm').addEventListener('click', () => {
      CB.capes = CB.capes.filter(x => x.id !== c.id);
      for (const sid in CB.assignments) CB.assignments[sid] = CB.assignments[sid].filter(cid => cid !== c.id);
      renderBuilderCapes(); renderAssignments(); updateBuildBtn();
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

    const header = document.createElement('div'); header.className = 'assign-header';
    const previewDiv = document.createElement('div'); previewDiv.className = 'bskin-preview';
    const skinName = document.createElement('div'); skinName.className = 'assign-skin-name'; skinName.textContent = skin.name;
    const countSpan = document.createElement('span'); countSpan.className = 'assign-count'; countSpan.textContent = `${assigned}/${CB.capes.length}`;
    header.appendChild(previewDiv);
    header.appendChild(skinName);
    header.appendChild(countSpan);
    section.appendChild(header);

    // 2D head preview
    makeSkinHeadThumb(skin.dataURL).then(thumb => {
      const img = document.createElement('img');
      img.src = thumb;
      img.style.cssText = 'width:100%;height:100%;image-rendering:pixelated;object-fit:contain;border-radius:4px;';
      previewDiv.appendChild(img);
    });

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
}

// ── Start from Current ──
async function startFromCurrent() {
  if (window.ezcapes && window.ezcapes.readCurrentPack) {
    showProgress('Reading current pack...', 30);
    try {
      const current = await window.ezcapes.readCurrentPack();
      if (!current || (!current.skins.length && !current.capes.length)) {
        toast('No custom cape pack found in Minecraft', true);
        hideProgress();
        return;
      }
      // Load skins
      for (const s of current.skins) addSkin(s.dataURL, s.name);
      // Load capes
      for (const c of current.capes) addCape(c.dataURL, c.name);
      // Set pack name
      if (current.name) $('#packName').value = current.name;
      showProgress('Loaded current pack!', 100);
      toast('Loaded ' + current.skins.length + ' skins and ' + current.capes.length + ' capes from current pack');
      setTimeout(() => hideProgress(), 2000);
    } catch (e) {
      toast('Failed to read current pack: ' + e.message, true);
      hideProgress();
    }
  } else {
    toast('Start from Current only works in the desktop app', true);
  }
}

// ── Build ──
async function buildPack() {
  let totalEntries = 0;
  for (const sid in CB.assignments) totalEntries += CB.assignments[sid].length;
  if (!totalEntries) { toast('Assign capes first', true); return; }
  $('#btnBuild').disabled = true;
  showProgress('Building...', 0);

  const packName = $('#packName').value.trim() || 'Custom Cape Pack';
  const packDesc = $('#packDesc').value.trim() || 'Made with EZCapes';
  const ver = ($('#packVer').value || '1.0.0').split('.').map(Number); while (ver.length < 3) ver.push(0);
  const folderName = 'custom';
  const z = new JSZip(), folder = z.folder(folderName);

  folder.file('manifest.json', JSON.stringify({ format_version: 1, header: { name: packName, description: packDesc, uuid: uuid(), version: ver }, modules: [{ type: 'skin_pack', uuid: uuid(), version: ver }] }, null, 2));
  showProgress('Adding textures...', 20);

  const skinFileMap = {}, capeFileMap = {};
  for (const skin of CB.skins) { const fn = 'skin_' + skin.id + '.png'; skinFileMap[skin.id] = fn; folder.file(fn, skin.dataURL.split(',')[1], { base64: true }); }
  for (const cape of CB.capes) { const fn = 'cape_' + cape.id + '.png'; capeFileMap[cape.id] = fn; folder.file(fn, cape.dataURL.split(',')[1], { base64: true }); }
  showProgress('Generating skins.json...', 40);

  const skinEntries = [], langLines = [];
  const langPackId = folderName.replace(/[^a-zA-Z0-9]/g, '');
  langLines.push(`skinpack.${langPackId}=${packName.replace(/§./g, '')}`);
  let ei = 0;
  for (const skin of CB.skins) {
    const geom = skin.slim ? 'geometry.humanoid.customSlim' : 'geometry.humanoid.custom';
    for (const capeId of (CB.assignments[skin.id] || [])) {
      const cape = CB.capes.find(c => c.id === capeId); if (!cape) continue;
      const loc = `entry_${ei}`;
      skinEntries.push({ localization_name: loc, geometry: geom, texture: skinFileMap[skin.id], cape: capeFileMap[capeId], type: 'free' });
      langLines.push(`skin.${langPackId}.${loc}=${skin.name} + ${cape.name}`);
      ei++;
    }
  }
  folder.file('skins.json', JSON.stringify({ skins: skinEntries, serialize_name: langPackId, localization_name: langPackId }, null, 2));
  folder.folder('texts').file('en_US.lang', langLines.join('\n'));
  showProgress('Compressing...', 70);

  const blob = await z.generateAsync({ type: 'blob' }, m => showProgress('Compressing...', 70 + m.percent * 0.3));

  // If running as Electron app, auto-install to Minecraft
  if (window.ezcapes && window.ezcapes.installPack) {
    showProgress('Installing to Minecraft...', 90);
    try {
      const buf = await blob.arrayBuffer();
      const result = await window.ezcapes.installPack({ zipBuffer: buf });
      showProgress('Applied! Restart Minecraft to see changes.', 100);
      toast('Cape pack applied to Minecraft!');
    } catch (e) {
      // Fallback to download if install fails
      showProgress('Install failed, downloading instead...', 95);
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = folderName + '.zip'; a.click(); URL.revokeObjectURL(a.href);
      toast('Could not auto-install: ' + e.message + '. Downloaded instead.', true);
    }
  } else {
    // Web mode — just download
    showProgress('Done!', 100);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = folderName + '.zip'; a.click(); URL.revokeObjectURL(a.href);
    toast('Pack built & downloaded!');
  }
  savePackToLib(packName, blob);
  $('#btnBuild').disabled = false; updateBuildBtn();
  setTimeout(() => hideProgress(), 2000);
}

// ══════════════════ LIBRARY DROP TARGETS ══════════════════
function setupLibDropTargets() {
  // Make entire skin library page a drop target
  const skinPage = $('#page-skins');
  skinPage.addEventListener('dragover', e => { e.preventDefault(); skinPage.style.outline = '2px dashed var(--accent)'; skinPage.style.outlineOffset = '-4px'; });
  skinPage.addEventListener('dragleave', e => { if (!skinPage.contains(e.relatedTarget)) skinPage.style.outline = ''; });
  skinPage.addEventListener('drop', async e => {
    e.preventDefault(); skinPage.style.outline = '';
    const allFiles = [];
    const items = e.dataTransfer.items;
    if (items) {
      const promises = [];
      for (const item of items) {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) promises.push(walkEntry(entry, allFiles));
        else { const f = item.getAsFile(); if (f) allFiles.push(f); }
      }
      await Promise.all(promises);
    } else { for (const f of e.dataTransfer.files) allFiles.push(f); }

    let added = 0;
    for (const f of allFiles) {
      if (!f.name.toLowerCase().endsWith('.png')) continue;
      try {
        const dataURL = await readFileAsDataURL(f);
        const img = await loadImage(dataURL);
        const w = img.width, h = img.height;
        if ((w === 64 && (h === 64 || h === 32)) || (w === 128 && h === 128)) {
          saveSkinToLib(f.name.replace(/\.png$/i, ''), dataURL, detectSlim(img), w, h);
          added++;
        }
      } catch (e) {}
    }
    if (added) { toast(`Saved ${added} skin${added > 1 ? 's' : ''} to library`); renderSkinLibPage(); }
    else toast('No valid skins found', true);
  });

  // Make entire cape library page a drop target
  const capePage = $('#page-capes');
  capePage.addEventListener('dragover', e => { e.preventDefault(); capePage.style.outline = '2px dashed var(--accent)'; capePage.style.outlineOffset = '-4px'; });
  capePage.addEventListener('dragleave', e => { if (!capePage.contains(e.relatedTarget)) capePage.style.outline = ''; });
  capePage.addEventListener('drop', async e => {
    e.preventDefault(); capePage.style.outline = '';
    const allFiles = [];
    const items = e.dataTransfer.items;
    if (items) {
      const promises = [];
      for (const item of items) {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) promises.push(walkEntry(entry, allFiles));
        else { const f = item.getAsFile(); if (f) allFiles.push(f); }
      }
      await Promise.all(promises);
    } else { for (const f of e.dataTransfer.files) allFiles.push(f); }

    let added = 0;
    for (const f of allFiles) {
      if (!f.name.toLowerCase().endsWith('.png')) continue;
      try {
        const dataURL = await readFileAsDataURL(f);
        saveCapeToLib(f.name.replace(/\.png$/i, ''), dataURL);
        added++;
      } catch (e) {}
    }
    if (added) { toast(`Saved ${added} cape${added > 1 ? 's' : ''} to library`); renderCapeLibPage(); }
    else toast('No valid capes found', true);
  });
}

// ══════════════════ SIDEBAR PROFILES ══════════════════
function renderSidebarProfiles() {
  const container = $('#sidebarProfiles');
  if (!container) return;
  const packs = lsGet('ez_packs').filter(p => p.profile);
  if (!packs.length) { container.innerHTML = ''; return; }
  container.innerHTML = '<div class="sidebar-profiles-label">Profiles</div>';
  packs.forEach(p => {
    const btn = document.createElement('button'); btn.className = 'sidebar-profile-btn';
    btn.innerHTML = `<span class="profile-star">⭐</span><span class="profile-name">${esc(p.name)}</span><span class="profile-apply">Apply</span>`;
    btn.addEventListener('click', async () => {
      if (window.ezcapes && window.ezcapes.installPack) {
        try {
          const bytes = Uint8Array.from(atob(p.zip64), c => c.charCodeAt(0));
          await window.ezcapes.installPack({ zipBuffer: bytes.buffer });
          toast('Applied ' + p.name + '! Restart Minecraft.');
        } catch (e) { toast('Failed: ' + e.message, true); }
      } else {
        const bytes = Uint8Array.from(atob(p.zip64), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'application/zip' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'custom.zip'; a.click();
        toast('Downloaded ' + p.name);
      }
    });
    container.appendChild(btn);
  });
}

function showProgress(t, p) { $('#statusCard').style.display = ''; $('#progressFill').style.width = p + '%'; $('#statusText').textContent = t; }
function hideProgress() { $('#statusCard').style.display = 'none'; }

// ══════════════════ SELECTION BAR ══════════════════
let selectionBar = null;

let selBarType = null;

function updateSelectionBar(type) {
  const count = type === 'skins' ? selectedSkins.size : selectedCapes.size;
  if (count === 0) {
    if (selectionBar) { selectionBar.remove(); selectionBar = null; selBarType = null; }
    return;
  }

  // Only rebuild the bar if it doesn't exist or type changed
  if (!selectionBar || selBarType !== type) {
    if (selectionBar) selectionBar.remove();
    selectionBar = document.createElement('div');
    selectionBar.className = 'selection-bar';
    selBarType = type;

    const countSpan = document.createElement('span'); countSpan.className = 'count';
    const useBtn = document.createElement('button'); useBtn.className = 'btn btn-accent'; useBtn.textContent = 'Use in Builder';
    const clearBtn = document.createElement('button'); clearBtn.className = 'btn btn-sm'; clearBtn.textContent = 'Clear';

    useBtn.addEventListener('click', () => {
      if (type === 'skins') {
        const lib = lsGet('ez_skins');
        for (const id of selectedSkins) {
          const s = lib.find(x => x.id === id);
          if (s) addSkin(s.dataURL, s.name);
        }
        selectedSkins.clear();
      } else {
        const allCards = [...$$('#builtinCapeGrid .cape-lib-card.selected'), ...$$('#myCapeGrid .cape-lib-card.selected')];
        for (const card of allCards) {
          if (card._capeData) addCape(card._capeData.src, card._capeData.name, !card._capeData.builtin);
        }
        selectedCapes.clear();
      }
      selectionBar.remove(); selectionBar = null; selBarType = null;
      $$('.nav-tab')[0].click();
      toast('Added to builder');
    });

    clearBtn.addEventListener('click', () => {
      if (type === 'skins') { selectedSkins.clear(); $$('.skin-lib-card.selected').forEach(c => c.classList.remove('selected')); }
      else { selectedCapes.clear(); $$('.cape-lib-card.selected').forEach(c => c.classList.remove('selected')); }
      selectionBar.remove(); selectionBar = null; selBarType = null;
    });

    selectionBar.appendChild(countSpan);
    selectionBar.appendChild(useBtn);
    selectionBar.appendChild(clearBtn);
    document.body.appendChild(selectionBar);
  }

  // Just update the count text
  selectionBar.querySelector('.count').textContent = count + ' selected';
}

// ══════════════════ SKIN LIBRARY PAGE ══════════════════
// ── Skin fetch by username ──
async function fetchSkinByName(username, statusEl) {
  const apis = [
    { name: 'minotar.net', url: `https://minotar.net/skin/${username}` },
    { name: 'mc-heads.net', url: `https://mc-heads.net/skin/${username}` },
    { name: 'mineskin.eu', url: `https://mineskin.eu/skin/${username}` },
  ];
  for (const api of apis) {
    if (statusEl) statusEl.textContent = `Trying ${api.name}...`;
    try {
      const resp = await fetch(api.url, { mode: 'cors' });
      if (!resp.ok) continue;
      const blob = await resp.blob();
      if (blob.size < 100) continue;
      const blobUrl = URL.createObjectURL(blob);
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(); i.src = blobUrl; });
      if (img.width >= 64 && (img.height === 64 || img.height === 32)) {
        if (statusEl) { statusEl.textContent = `Loaded via ${api.name}`; statusEl.style.color = 'var(--accent)'; }
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        return { img, dataURL: c.toDataURL('image/png') };
      }
    } catch (e) { continue; }
  }
  if (statusEl) { statusEl.textContent = 'Could not find skin for that username'; statusEl.style.color = 'var(--red)'; }
  return null;
}

async function fetchBedrockSkin(gamertag, statusEl) {
  if (statusEl) statusEl.textContent = 'Looking up Bedrock player...';
  try {
    const r = await fetch(`https://mcprofile.io/api/v1/bedrock/gamertag/${encodeURIComponent(gamertag)}`, { mode: 'cors' });
    if (!r.ok) throw new Error('Not found');
    const j = await r.json();
    if (!j.skin_url && !j.skin) {
      if (statusEl) { statusEl.textContent = 'No skin found for Bedrock player'; statusEl.style.color = 'var(--red)'; }
      return null;
    }
    const skinUrl = j.skin_url || j.skin;
    if (statusEl) statusEl.textContent = 'Downloading skin...';
    const resp = await fetch(skinUrl, { mode: 'cors' });
    if (!resp.ok) throw new Error('Skin download failed');
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(); i.src = blobUrl; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    if (statusEl) { statusEl.textContent = 'Loaded via mcprofile.io'; statusEl.style.color = 'var(--accent)'; }
    return { img, dataURL: c.toDataURL('image/png') };
  } catch (e) {
    if (statusEl) { statusEl.textContent = 'Bedrock lookup failed — player may not exist'; statusEl.style.color = 'var(--red)'; }
    return null;
  }
}

function setupSkinLibPage() {
  const btn = $('#skinLibDropzone .btn');
  const input = $('#skinLibFileInput');
  btn.addEventListener('click', () => input.click());

  // Username fetch buttons
  const fetchInput = $('#skinFetchName');
  const fetchStatus = $('#skinFetchStatus');

  async function doFetch(edition) {
    const name = fetchInput.value.trim();
    if (!name) { toast('Enter a username', true); return; }
    fetchStatus.textContent = 'Fetching...'; fetchStatus.style.color = 'var(--text-mut)';
    const result = edition === 'bedrock' ? await fetchBedrockSkin(name, fetchStatus) : await fetchSkinByName(name, fetchStatus);
    if (result) {
      addSkin(result.dataURL, name);
      renderSkinLibPage();
      toast('Added ' + name);
      fetchInput.value = '';
    }
  }

  $('#skinFetchJava').addEventListener('click', () => doFetch('java'));
  $('#skinFetchBedrock').addEventListener('click', () => doFetch('bedrock'));
  fetchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doFetch('java'); });
  input.addEventListener('change', e => {
    for (const f of e.target.files) {
      if (!f.type.startsWith('image/')) continue;
      const r = new FileReader();
      r.onload = v => {
        const img = new Image();
        img.onload = () => {
          const w = img.width, h = img.height;
          if (!((w === 64 && (h === 64 || h === 32)) || (w === 128 && h === 128))) return;
          saveSkinToLib(f.name.replace(/\.png$/i, ''), v.target.result, detectSlim(img), w, h);
          renderSkinLibPage();
        };
        img.src = v.target.result;
      };
      r.readAsDataURL(f);
    }
    e.target.value = '';
  });
}

function saveSkinToLib(name, dataURL, slim, w, h) {
  const lib = lsGet('ez_skins');
  if (lib.find(s => s.name.toLowerCase() === name.toLowerCase())) return;
  lib.unshift({ id: 'skin_' + Date.now() + Math.random().toString(36).slice(2,5), name, dataURL, slim, w: w || 64, h: h || 64, savedAt: Date.now() });
  if (lib.length > 30) lib.length = 30;
  try { lsSet('ez_skins', lib); } catch { toast('Storage full', true); }
}

function renderSkinLibPage() {
  const grid = $('#skinLibGrid');
  const lib = lsGet('ez_skins');
  if (!lib.length) { grid.innerHTML = '<div class="lib-empty">No skins saved yet. Add some above!</div>'; return; }
  grid.innerHTML = '';
  lib.forEach(s => {
    const card = document.createElement('div'); card.className = 'skin-lib-card';
    const viewerDiv = document.createElement('div'); viewerDiv.className = 'skin-lib-viewer';
    const nameDiv = document.createElement('div'); nameDiv.className = 'skin-lib-name'; nameDiv.textContent = s.name;
    const metaDiv = document.createElement('div'); metaDiv.className = 'skin-lib-meta'; metaDiv.textContent = `${s.slim ? 'Slim' : 'Classic'} · ${s.w||64}x${s.h||64}`;
    const actionsDiv = document.createElement('div'); actionsDiv.className = 'skin-lib-actions';
    const useBtn = document.createElement('button'); useBtn.className = 'btn btn-sm use-btn'; useBtn.textContent = '➕'; useBtn.title = 'Use in Builder';
    const renBtn = document.createElement('button'); renBtn.className = 'btn btn-sm'; renBtn.textContent = '✏️'; renBtn.title = 'Rename';
    const delBtn = document.createElement('button'); delBtn.className = 'btn btn-sm btn-danger del-btn'; delBtn.textContent = '🗑️'; delBtn.title = 'Delete';
    actionsDiv.appendChild(useBtn); actionsDiv.appendChild(renBtn); actionsDiv.appendChild(delBtn);
    card.appendChild(viewerDiv);
    card.appendChild(nameDiv);
    card.appendChild(metaDiv);
    card.appendChild(actionsDiv);

    useBtn.addEventListener('click', e => {
      e.stopPropagation();
      addSkin(s.dataURL, s.name);
      $$('.nav-tab')[0].click();
      toast('Added ' + s.name + ' to builder');
    });
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      const lib = lsGet('ez_skins').filter(x => x.id !== s.id);
      lsSet('ez_skins', lib);
      selectedSkins.delete(s.id);
      renderSkinLibPage();
    });
    // Rename
    function doRename(e) {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'text'; input.value = s.name;
      input.style.cssText = 'width:100%;font-size:11px;font-weight:600;background:rgba(0,0,0,0.3);border:1px solid var(--accent);color:#fff;padding:2px 4px;border-radius:4px;font-family:var(--font);outline:none;text-align:center;';
      nameDiv.replaceWith(input);
      input.focus(); input.select();
      const finish = () => {
        const newName = input.value.trim() || s.name;
        const lib = lsGet('ez_skins');
        const item = lib.find(x => x.id === s.id);
        if (item) item.name = newName;
        lsSet('ez_skins', lib);
        renderSkinLibPage();
      };
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    }
    renBtn.addEventListener('click', doRename);
    nameDiv.addEventListener('dblclick', doRename);
    card.addEventListener('click', () => {
      if (selectedSkins.has(s.id)) selectedSkins.delete(s.id);
      else selectedSkins.add(s.id);
      card.classList.toggle('selected', selectedSkins.has(s.id));
      updateSelectionBar('skins');
    });
    grid.appendChild(card);

    // Full 3D model with very slow rotation
    try {
      const viewer = new skinview3d.SkinViewer({ canvas: document.createElement('canvas'), width: 120, height: 100, skin: s.dataURL, model: s.slim ? 'slim' : 'default' });
      viewer.autoRotate = true;
      viewer.autoRotateSpeed = 0.15;
      viewer.camera.position.set(0, 5, 35);
      viewer.animation = new skinview3d.IdleAnimation();
      viewerDiv.appendChild(viewer.canvas);
    } catch (e) {
      // Fallback to 2D head if WebGL limit hit
      makeSkinHeadThumb(s.dataURL).then(thumb => {
        const img = document.createElement('img');
        img.src = thumb;
        img.style.cssText = 'width:48px;height:48px;image-rendering:pixelated;margin:20px auto;display:block;border-radius:4px;';
        viewerDiv.appendChild(img);
      });
    }
  });
}

// ══════════════════ CAPE LIBRARY PAGE ══════════════════
function setupCapeLibPage() {
  const btn = $('#capeLibDropzone .btn');
  const input = $('#capeLibFileInput');
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', e => {
    for (const f of e.target.files) {
      if (!f.type.startsWith('image/')) continue;
      const r = new FileReader();
      r.onload = v => {
        saveCapeToLib(f.name.replace(/\.png$/i, ''), v.target.result);
        renderCapeLibPage();
      };
      r.readAsDataURL(f);
    }
    e.target.value = '';
  });
}

function saveCapeToLib(name, dataURL) {
  const lib = lsGet('ez_capes');
  if (lib.find(c => c.name.toLowerCase() === name.toLowerCase())) return;
  lib.unshift({ id: 'cape_' + Date.now() + Math.random().toString(36).slice(2,5), name, dataURL, savedAt: Date.now() });
  if (lib.length > 50) lib.length = 50;
  try { lsSet('ez_capes', lib); } catch { toast('Storage full', true); }
}

function renderBuiltinCapes() {
  if (typeof CB_GALLERY === 'undefined') return;
  const grid = $('#builtinCapeGrid'); grid.innerHTML = '';
  CB_GALLERY.forEach(g => {
    const card = document.createElement('div'); card.className = 'cape-lib-card';
    const thumbImg = document.createElement('img'); thumbImg.className = 'cape-lib-thumb';
    const nameDiv = document.createElement('div'); nameDiv.className = 'cape-lib-name'; nameDiv.textContent = g.name;
    const secDiv = document.createElement('div'); secDiv.className = 'cape-lib-section'; secDiv.textContent = g.section || '';
    // Crop to back face for preview
    const srcImg = new Image();
    srcImg.onload = () => {
      const c = document.createElement('canvas'); c.width = 10; c.height = 16;
      const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(srcImg, 1, 1, 10, 16, 0, 0, 10, 16);
      thumbImg.src = c.toDataURL();
    };
    srcImg.src = g.src;
    card.appendChild(thumbImg);
    card.appendChild(nameDiv);
    card.appendChild(secDiv);
    card.addEventListener('click', () => {
      const key = 'builtin_' + g.name;
      if (selectedCapes.has(key)) selectedCapes.delete(key);
      else selectedCapes.add(key);
      card.classList.toggle('selected', selectedCapes.has(key));
      card._capeData = { src: g.src, name: g.name, builtin: true };
      updateSelectionBar('capes');
    });
    card.addEventListener('dblclick', () => {
      addCape(g.src, g.name, false);
      $$('.nav-tab')[0].click();
      toast('Added ' + g.name + ' to builder');
    });
    grid.appendChild(card);
  });
}

function renderCapeLibPage() {
  const grid = $('#myCapeGrid');
  const lib = lsGet('ez_capes');
  if (!lib.length) { grid.innerHTML = '<div class="lib-empty">No custom capes yet. Add some above!</div>'; return; }
  grid.innerHTML = '';
  lib.forEach(c => {
    const card = document.createElement('div'); card.className = 'cape-lib-card';
    const thumbImg = document.createElement('img'); thumbImg.className = 'cape-lib-thumb';
    const nameDiv = document.createElement('div'); nameDiv.className = 'cape-lib-name'; nameDiv.textContent = c.name;
    const rmBtn = document.createElement('button'); rmBtn.className = 'cape-lib-rm'; rmBtn.title = 'Delete'; rmBtn.textContent = '✕';
    const srcImg = new Image();
    srcImg.onload = () => {
      const cv = document.createElement('canvas'); cv.width = 10; cv.height = 16;
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(srcImg, 1, 1, 10, 16, 0, 0, 10, 16);
      thumbImg.src = cv.toDataURL();
    };
    srcImg.src = c.dataURL;
    card.appendChild(thumbImg);
    card.appendChild(nameDiv);
    card.appendChild(rmBtn);
    rmBtn.addEventListener('click', e => {
      e.stopPropagation();
      const lib = lsGet('ez_capes').filter(x => x.id !== c.id);
      lsSet('ez_capes', lib);
      renderCapeLibPage();
    });
    card.addEventListener('click', () => {
      if (selectedCapes.has(c.id)) selectedCapes.delete(c.id);
      else selectedCapes.add(c.id);
      card.classList.toggle('selected', selectedCapes.has(c.id));
      card._capeData = { src: c.dataURL, name: c.name };
      updateSelectionBar('capes');
    });
    card.addEventListener('dblclick', () => {
      addCape(c.dataURL, c.name);
      $$('.nav-tab')[0].click();
      toast('Added ' + c.name + ' to builder');
    });
    grid.appendChild(card);
  });
}

// ══════════════════ SAVED PACKS PAGE ══════════════════
async function savePackToLib(name, blob) {
  const buf = await blob.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const packs = lsGet('ez_packs');
  packs.unshift({ id: 'pack_' + Date.now(), name, savedAt: Date.now(), zip64: b64 });
  if (packs.length > 15) packs.length = 15;
  try { lsSet('ez_packs', packs); } catch { toast('Storage full — pack not saved to library', true); }
}

function renderPacksPage() {
  const list = $('#packList');
  const profileList = $('#profileList');
  const packs = lsGet('ez_packs');
  if (!packs.length) {
    list.innerHTML = '<div class="lib-empty">No saved packs yet. Build one in Pack Builder!</div>';
    profileList.innerHTML = '<div class="lib-empty" style="padding:20px">No profiles yet. Star a pack below to make it a profile.</div>';
    return;
  }

  const profiles = packs.filter(p => p.profile);
  const nonProfiles = packs;

  // Render profiles
  profileList.innerHTML = '';
  if (!profiles.length) {
    profileList.innerHTML = '<div class="lib-empty" style="padding:20px">No profiles yet. Star a pack below to make it a profile.</div>';
  } else {
    profiles.forEach(p => {
      const el = document.createElement('div'); el.className = 'pack-item';
      el.style.borderColor = 'rgba(140,110,220,0.25)';
      el.innerHTML = `<div class="pack-icon">⭐</div><div class="pack-info"><div class="pack-name">${esc(p.name)}</div></div><div class="pack-actions"><button class="btn btn-accent apply-btn" style="font-size:11px;padding:6px 14px">Apply</button></div>`;
      el.querySelector('.apply-btn').addEventListener('click', async () => {
        if (window.ezcapes && window.ezcapes.installPack) {
          try {
            const bytes = Uint8Array.from(atob(p.zip64), c => c.charCodeAt(0));
            await window.ezcapes.installPack({ zipBuffer: bytes.buffer });
            toast('Applied ' + p.name + '! Restart Minecraft.');
          } catch (e) { toast('Failed: ' + e.message, true); }
        } else {
          const bytes = Uint8Array.from(atob(p.zip64), c => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: 'application/zip' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'custom.zip'; a.click();
          toast('Downloaded ' + p.name);
        }
      });
      profileList.appendChild(el);
    });
  }

  // Render all packs
  list.innerHTML = '';
  packs.forEach(p => {
    const el = document.createElement('div'); el.className = 'pack-item';
    const date = p.savedAt ? new Date(p.savedAt).toLocaleDateString() : '';
    const starIcon = p.profile ? '⭐' : '☆';
    el.innerHTML = `<div class="pack-icon">📦</div><div class="pack-info"><div class="pack-name" title="Double-click to rename">${esc(p.name)}</div><div class="pack-date">${date}</div></div><div class="pack-actions"><button class="btn btn-sm star-btn" title="Toggle profile">${starIcon}</button><button class="btn btn-accent apply-btn" style="font-size:11px;padding:6px 14px">Apply</button><button class="btn btn-sm dl-btn">Download</button><button class="btn btn-sm btn-danger del-btn">Delete</button></div>`;

    el.querySelector('.apply-btn').addEventListener('click', async () => {
      if (window.ezcapes && window.ezcapes.installPack) {
        try {
          const bytes = Uint8Array.from(atob(p.zip64), c => c.charCodeAt(0));
          const result = await window.ezcapes.installPack({ zipBuffer: bytes.buffer });
          toast('Applied ' + p.name + '! Restart Minecraft to see changes.');
        } catch (e) {
          toast('Failed to apply: ' + e.message, true);
        }
      } else {
        // Web fallback — download
        const bytes = Uint8Array.from(atob(p.zip64), c => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'application/zip' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'custom.zip'; a.click(); URL.revokeObjectURL(a.href);
        toast('Downloaded ' + p.name + ' (apply manually)');
      }
    });

    el.querySelector('.dl-btn').addEventListener('click', () => {
      const bytes = Uint8Array.from(atob(p.zip64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/zip' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'custom.zip'; a.click(); URL.revokeObjectURL(a.href);
      toast('Downloading ' + p.name);
    });

    el.querySelector('.del-btn').addEventListener('click', () => {
      const packs = lsGet('ez_packs').filter(x => x.id !== p.id);
      lsSet('ez_packs', packs);
      renderPacksPage(); renderSidebarProfiles();
      toast('Deleted ' + p.name);
    });

    el.querySelector('.star-btn').addEventListener('click', () => {
      const packs = lsGet('ez_packs');
      const item = packs.find(x => x.id === p.id);
      if (item) item.profile = !item.profile;
      lsSet('ez_packs', packs);
      renderPacksPage(); renderSidebarProfiles();
      toast(item.profile ? p.name + ' added to profiles' : p.name + ' removed from profiles');
    });

    el.querySelector('.pack-name').addEventListener('dblclick', e => {
      const nameEl = e.target;
      const input = document.createElement('input');
      input.type = 'text'; input.value = p.name;
      input.style.cssText = 'font-size:14px;font-weight:600;background:rgba(0,0,0,0.3);border:1px solid var(--accent);color:var(--text);padding:2px 6px;border-radius:4px;font-family:var(--font);outline:none;width:200px;';
      nameEl.replaceWith(input);
      input.focus(); input.select();
      const finish = () => {
        const newName = input.value.trim() || p.name;
        const packs = lsGet('ez_packs');
        const item = packs.find(x => x.id === p.id);
        if (item) item.name = newName;
        lsSet('ez_packs', packs);
        renderPacksPage(); renderSidebarProfiles();
      };
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    });

    list.appendChild(el);
  });
}

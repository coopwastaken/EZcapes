// ═══════════════ BANNER CAPE DESIGNER ═══════════════
// Uses actual Minecraft banner pattern masks extracted from game assets
!function(){

const BW = 20, BH = 40; // Banner face resolution (for preview)
const SW = 10, SH = 20; // Shield face resolution (for cape mapping)
const CW = 64, CH = 32; // Cape texture resolution

const MC_COLORS = [
  {name:'White',     hex:'#F9FFFE', rgb:[249,255,254]},
  {name:'Orange',    hex:'#F9801D', rgb:[249,128,29]},
  {name:'Magenta',   hex:'#C74EBD', rgb:[199,78,189]},
  {name:'Light Blue',hex:'#3AB3DA', rgb:[58,179,218]},
  {name:'Yellow',    hex:'#FED83D', rgb:[254,216,61]},
  {name:'Lime',      hex:'#80C71F', rgb:[128,199,31]},
  {name:'Pink',      hex:'#F38BAA', rgb:[243,139,170]},
  {name:'Gray',      hex:'#474F52', rgb:[71,79,82]},
  {name:'Light Gray',hex:'#9D9D97', rgb:[157,157,151]},
  {name:'Cyan',      hex:'#169C9C', rgb:[22,156,156]},
  {name:'Purple',    hex:'#8932B8', rgb:[137,50,184]},
  {name:'Blue',      hex:'#3C44AA', rgb:[60,68,170]},
  {name:'Brown',     hex:'#835432', rgb:[131,84,50]},
  {name:'Green',     hex:'#5E7C16', rgb:[94,124,22]},
  {name:'Red',       hex:'#B02E26', rgb:[176,46,38]},
  {name:'Black',     hex:'#1D1D21', rgb:[29,29,33]},
];

// Pattern names (matching BANNER_MASKS keys)
const PATTERN_LIST = [
  {id:'base',              name:'Base'},
  {id:'stripe_top',        name:'Stripe Top'},
  {id:'stripe_bottom',     name:'Stripe Bottom'},
  {id:'stripe_left',       name:'Stripe Left'},
  {id:'stripe_right',      name:'Stripe Right'},
  {id:'stripe_center',     name:'Stripe Center'},
  {id:'stripe_middle',     name:'Stripe Middle'},
  {id:'stripe_downright',  name:'Bend'},
  {id:'stripe_downleft',   name:'Bend Sinister'},
  {id:'small_stripes',     name:'Paly'},
  {id:'cross',             name:'Saltire'},
  {id:'straight_cross',    name:'Cross'},
  {id:'diagonal_left',     name:'Per Bend Sinister'},
  {id:'diagonal_right',    name:'Per Bend'},
  {id:'diagonal_up_left',  name:'Per Bend Inv.'},
  {id:'diagonal_up_right', name:'Per Bend Sin. Inv.'},
  {id:'half_vertical',     name:'Per Pale'},
  {id:'half_vertical_right',name:'Per Pale Inv.'},
  {id:'half_horizontal',   name:'Per Fess'},
  {id:'half_horizontal_bottom',name:'Per Fess Inv.'},
  {id:'square_top_left',   name:'Canton TL'},
  {id:'square_top_right',  name:'Canton TR'},
  {id:'square_bottom_left',name:'Canton BL'},
  {id:'square_bottom_right',name:'Canton BR'},
  {id:'triangle_top',      name:'Chevron Inv.'},
  {id:'triangle_bottom',   name:'Chevron'},
  {id:'triangles_top',     name:'Chief Indented'},
  {id:'triangles_bottom',  name:'Base Indented'},
  {id:'circle',            name:'Roundel'},
  {id:'rhombus',           name:'Lozenge'},
  {id:'border',            name:'Bordure'},
  {id:'curly_border',      name:'Bordure Indented'},
  {id:'bricks',            name:'Field Masoned'},
  {id:'gradient',          name:'Gradient'},
  {id:'gradient_up',       name:'Base Gradient'},
  {id:'creeper',           name:'Creeper'},
  {id:'skull',             name:'Skull'},
  {id:'flower',            name:'Flower'},
  {id:'mojang',            name:'Thing (Mojang)'},
  {id:'globe',             name:'Globe'},
  {id:'piglin',            name:'Snout'},
  {id:'flow',              name:'Flow'},
  {id:'guster',            name:'Guster'},
];

// State
let bannerBase = 15; // black - banner background
let capeColor = 15;  // black - cape body (sides, edges, front)
let bannerLayers = []; // [{patternId, colorIdx}]
let pickingForLayer = -1;
let loadedBannerMasks = {}; // id -> ImageData (20x40 for preview)
let loadedShieldMasks = {}; // id -> ImageData (10x20 for cape)
let banner3dCapeViewer = null;
let banner3dElytraViewer = null;

const $ = s => document.querySelector(s);

// ── Load all pattern masks as ImageData ──
async function loadMasks() {
  const promises = [];
  // Load banner masks (20x40) for preview
  if (typeof BANNER_MASKS !== 'undefined') {
    for (const [id, dataURL] of Object.entries(BANNER_MASKS)) {
      promises.push(new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = BW; c.height = BH;
          c.getContext('2d').drawImage(img, 0, 0);
          loadedBannerMasks[id] = c.getContext('2d').getImageData(0, 0, BW, BH);
          resolve();
        };
        img.onerror = resolve;
        img.src = dataURL;
      }));
    }
  }
  // Load shield masks (10x20) for cape mapping
  if (typeof SHIELD_MASKS !== 'undefined') {
    for (const [id, dataURL] of Object.entries(SHIELD_MASKS)) {
      promises.push(new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = SW; c.height = SH;
          c.getContext('2d').drawImage(img, 0, 0);
          loadedShieldMasks[id] = c.getContext('2d').getImageData(0, 0, SW, SH);
          resolve();
        };
        img.onerror = resolve;
        img.src = dataURL;
      }));
    }
  }
  await Promise.all(promises);
}

// ── Render banner at 20x40 using real banner masks (for preview) ──
function renderBanner() {
  const cvs = document.createElement('canvas'); cvs.width = BW; cvs.height = BH;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = MC_COLORS[bannerBase].hex;
  ctx.fillRect(0, 0, BW, BH);
  bannerLayers.forEach(layer => {
    const mask = loadedBannerMasks[layer.patternId];
    if (!mask) return;
    const col = MC_COLORS[layer.colorIdx].rgb;
    const imgData = ctx.getImageData(0, 0, BW, BH);
    const d = imgData.data, m = mask.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = m[i + 3] / 255;
      if (a > 0) { d[i]=Math.round(d[i]*(1-a)+col[0]*a); d[i+1]=Math.round(d[i+1]*(1-a)+col[1]*a); d[i+2]=Math.round(d[i+2]*(1-a)+col[2]*a); }
    }
    ctx.putImageData(imgData, 0, 0);
  });
  return cvs;
}

// ── Render at 10x20 using shield masks (for elytra — exact fit) ──
function renderShieldBanner() {
  const cvs = document.createElement('canvas'); cvs.width = SW; cvs.height = SH;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = MC_COLORS[bannerBase].hex;
  ctx.fillRect(0, 0, SW, SH);
  bannerLayers.forEach(layer => {
    const mask = loadedShieldMasks[layer.patternId];
    if (!mask) return;
    const col = MC_COLORS[layer.colorIdx].rgb;
    const imgData = ctx.getImageData(0, 0, SW, SH);
    const d = imgData.data, m = mask.data;
    for (let i = 0; i < d.length; i += 4) {
      const a = m[i + 3] / 255;
      if (a > 0) { d[i]=Math.round(d[i]*(1-a)+col[0]*a); d[i+1]=Math.round(d[i+1]*(1-a)+col[1]*a); d[i+2]=Math.round(d[i+2]*(1-a)+col[2]*a); }
    }
    ctx.putImageData(imgData, 0, 0);
  });
  return cvs;
}

// ── Render at cape-back resolution (10x16) by sampling banner masks ──
function renderCapeBanner() {
  const cvs = document.createElement('canvas'); cvs.width = 10; cvs.height = 16;
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // Render banner at high res (20x40) then downscale to 10x16 with smoothing enabled
  const hires = renderBanner(); // 20x40
  const temp = document.createElement('canvas'); temp.width = 10; temp.height = 16;
  const tctx = temp.getContext('2d');
  tctx.imageSmoothingEnabled = true;
  tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(hires, 0, 0, BW, BH, 0, 0, 10, 16);

  ctx.drawImage(temp, 0, 0);
  return cvs;
}

// Cape template for pixel-accurate regions
const CAPE_TMPL = new Image();
let capeTmplData = null;
CAPE_TMPL.onload = function() {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  c.getContext('2d').drawImage(CAPE_TMPL, 0, 0);
  capeTmplData = c.getContext('2d').getImageData(0, 0, CW, CH);
};
CAPE_TMPL.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAYAAACinX6EAAABU0lEQVR4AeyXPYoCQRCFu9wTLBtvvidw77DpgpmpqRgIBiqiZgZiaqqRoPfQ0MhL6A2ktAZaVGbo0ukaCyzxOdNjz5vqr9/8ldz5s9wjcoSzA3J0tmR9h9hDL5wcMU0soxydSjgb4/fcOY5Wf5/ObVtBYbOGnJra0APfD+ofkCb/v9QySYCUOceXIJBw0UHSuo+YJo7XM31eDuC66M2uf928WScoNxsiNdQAgMrgcjpkjU0CghoAWYOW3m4ApAnH9o99GqhKQPmnG5tX0E8VgGC1Ah0MgADUxJIerZOVB344t0Kyi3kdsAQQ0XeWJeDdZv9+vJYAqDagXAeW/r8AYDRl6Z601ra6BPx2IfhWGBOmOgA0uCIhqARAEIqSWgBFpUAMAF0w884iQchSXm+/vxgAfwDtSwOgfYak67MESBPW7m8J0D5D0vVZAqQJv9o/dPwTAAAA///AjVRiAAAABklEQVQDANGS0EFW/m0VAAAAAElFTkSuQmCC';

// ── Map banner to cape texture using template for pixel-perfect regions ──
function renderCapeTexture() {
  const cvs = document.createElement('canvas'); cvs.width = CW; cvs.height = CH;
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const baseRgb = MC_COLORS[bannerBase].rgb;

  const capeRgb = MC_COLORS[capeColor].rgb;

  // Step 1: Fill all template pixels with cape body color
  if (capeTmplData) {
    const imgData = ctx.getImageData(0, 0, CW, CH);
    const d = imgData.data;
    const t = capeTmplData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (t[i + 3] > 0) {
        d[i] = capeRgb[0]; d[i+1] = capeRgb[1]; d[i+2] = capeRgb[2]; d[i+3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } else {
    ctx.fillStyle = MC_COLORS[capeColor].hex;
    ctx.fillRect(1, 1, 10, 16);
    ctx.fillRect(12, 1, 10, 16);
    ctx.fillRect(0, 1, 1, 16);
    ctx.fillRect(11, 1, 1, 16);
    ctx.fillRect(1, 0, 10, 1);
    ctx.fillRect(11, 0, 10, 1);
  }

  // Step 2: Banner → cape back face only (10x16)
  const capeBanner = renderCapeBanner();
  ctx.drawImage(capeBanner, 0, 0, 10, 16, 1, 1, 10, 16);

  // Step 3: Shield → elytra, but only on pixels the template says are valid
  const shieldCvs = renderShieldBanner();
  if (capeTmplData) {
    // Draw shield onto a temp canvas, then copy only template-valid pixels
    const tmpCvs = document.createElement('canvas'); tmpCvs.width = CW; tmpCvs.height = CH;
    const tmpCtx = tmpCvs.getContext('2d');
    tmpCtx.imageSmoothingEnabled = false;
    // Left elytra
    tmpCtx.drawImage(shieldCvs, 0, 0, SW, SH, 36, 2, 10, 20);
    // Right elytra mirrored
    tmpCtx.save(); tmpCtx.translate(58, 0); tmpCtx.scale(-1, 1);
    tmpCtx.drawImage(shieldCvs, 0, 0, SW, SH, 0, 2, 10, 20);
    tmpCtx.restore();

    // Only copy elytra pixels where template has content (x >= 22)
    const elyData = tmpCtx.getImageData(0, 0, CW, CH);
    const capeData = ctx.getImageData(0, 0, CW, CH);
    const ed = elyData.data, cd = capeData.data, td = capeTmplData.data;
    for (let y = 0; y < CH; y++) {
      for (let x = 22; x < CW; x++) {
        const i = (y * CW + x) * 4;
        if (td[i + 3] > 0 && ed[i + 3] > 0) {
          cd[i] = ed[i]; cd[i+1] = ed[i+1]; cd[i+2] = ed[i+2]; cd[i+3] = 255;
        }
      }
    }
    ctx.putImageData(capeData, 0, 0);
  }

  return cvs;
}

// ── Update previews ──
function updatePreviews() {
  const banner = renderBanner(); // 20x40 for preview
  const cape = renderCapeTexture(); // uses shield masks internally

  const prev = $('#bannerPreview');
  prev.width = BW; prev.height = BH;
  prev.getContext('2d').drawImage(banner, 0, 0);

  const full = $('#bannerFullCape');
  full.getContext('2d').clearRect(0, 0, CW, CH);
  full.getContext('2d').drawImage(cape, 0, 0);

  const ely = $('#bannerElytraPreview');
  const eCtx = ely.getContext('2d');
  eCtx.imageSmoothingEnabled = false;
  eCtx.clearRect(0, 0, 22, 20);
  eCtx.drawImage(cape, 34, 2, 10, 20, 0, 0, 10, 20);
  eCtx.drawImage(cape, 46, 2, 10, 20, 12, 0, 10, 20);

  // Update 3D viewers
  const capeDataURL = full.toDataURL('image/png');
  update3DViewers(capeDataURL);
}

function update3DViewers(capeDataURL) {
  const capeWrap = $('#banner3dCape');
  const elyWrap = $('#banner3dElytra');
  if (!capeWrap || !elyWrap) return;

  try {
    // Cape viewer
    if (!banner3dCapeViewer) {
      banner3dCapeViewer = new skinview3d.SkinViewer({
        canvas: document.createElement('canvas'),
        width: 180, height: 240,
        skin: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARzQklUCAgICHwIZIgAAAGcSURBVHic7doxTgMxEIXhNwkSHIBrcAJOwY24CReghIICUVBQICQKKKCg2GLXxvZ4PPP/0iqKdlfyfPHa2U0BAAAAAAAAAHSy2voCAjiq/8HzJElnO/l5eby3sfu+Wrys3Vkxvsqb/f4y+Yr3kgP+OuSCvbdL+nGQ3JxPj6T00MNl7Yz6W79aHp43Sn2Bxk8e6u8LNH4igLNA4wgAowDAA5Aet/Y+OkAngcgJQGAByC9HwAAAADQywCklwMAegAAAAAAAADK+wGkJACeTh+vJJ1J3lM/ZHt/tS4qz9fYe9p5TZKulXhJ31M/Ar/r3yJp3/i2+3LjD+XC6VHt5GYfx/0bGNQC1GAAA6B6DOABSO8HAPR+AAAAAADQywCklwMAejoAAAAAAKC8H0BKAgAAAAAAAADK+wGkJAAetx8vJZ1LftM+0NZv+0f6dvC8dhIv0PRLM1mC5jOlV7qx9o7A+sH2Ov/18K94L1EPkDgeQ3gf+FEEAH9jPQf8/gCklwMAegAAAPQyAOnlAAAAAICe/gJJu/gGzz61GAAAAABJRU5ErkJggg=='
      });
      banner3dCapeViewer.autoRotate = false;
      banner3dCapeViewer.camera.position.set(0, 10, 38);
      banner3dCapeViewer.animation = new skinview3d.IdleAnimation();
      capeWrap.innerHTML = '';
      capeWrap.appendChild(banner3dCapeViewer.canvas);
    }
    banner3dCapeViewer.loadCape(capeDataURL, { backEquipment: 'cape' });

    // Elytra viewer
    if (!banner3dElytraViewer) {
      banner3dElytraViewer = new skinview3d.SkinViewer({
        canvas: document.createElement('canvas'),
        width: 180, height: 240,
        skin: 'https://minotar.net/skin/Coop6807'
      });
      banner3dElytraViewer.autoRotate = false;
      banner3dElytraViewer.camera.position.set(0, 10, 38);
      banner3dElytraViewer.animation = new skinview3d.IdleAnimation();
      elyWrap.innerHTML = '';
      elyWrap.appendChild(banner3dElytraViewer.canvas);
    }
    banner3dElytraViewer.loadCape(capeDataURL, { backEquipment: 'elytra' });
  } catch (e) { console.warn('3D viewer error:', e); }
}

// ── Render pattern picker grid ──
function renderPatternPicker() {
  const grid = $('#bannerPatterns'); grid.innerHTML = '';
  PATTERN_LIST.forEach((p, i) => {
    if (p.id === 'base') return;
    const btn = document.createElement('div'); btn.className = 'banner-pattern-btn';

    // Thumbnail using actual mask
    const cvs = document.createElement('canvas'); cvs.width = BW; cvs.height = BH;
    cvs.style.cssText = 'width:36px;height:72px;image-rendering:pixelated;display:block;margin:0 auto 3px;border-radius:2px';
    const ctx = cvs.getContext('2d');
    const mask = loadedBannerMasks[p.id];
    if (mask) {
      // Render with proper alpha blending like the real banner
      ctx.fillStyle = '#555'; ctx.fillRect(0, 0, BW, BH);
      const imgData = ctx.getImageData(0, 0, BW, BH);
      const d = imgData.data;
      const m = mask.data;
      for (let i = 0; i < d.length; i += 4) {
        const a = m[i + 3] / 255;
        if (a > 0) {
          d[i]   = Math.round(d[i]   * (1-a) + 221 * a);
          d[i+1] = Math.round(d[i+1] * (1-a) + 221 * a);
          d[i+2] = Math.round(d[i+2] * (1-a) + 221 * a);
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
    btn.appendChild(cvs);
    const label = document.createElement('span'); label.textContent = p.name;
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      if (pickingForLayer >= 0) {
        if (pickingForLayer >= bannerLayers.length) {
          bannerLayers.push({ patternId: p.id, colorIdx: bannerBase === 15 ? 0 : 15 });
        } else {
          bannerLayers[pickingForLayer].patternId = p.id;
        }
        pickingForLayer = -1;
        $('#bannerPatternPicker').style.display = 'none';
        renderLayers(); updatePreviews();
      }
    });
    grid.appendChild(btn);
  });
}

// ── Render layers ──
function renderLayers() {
  const container = $('#bannerLayers'); container.innerHTML = '';
  if (!bannerLayers.length) {
    container.innerHTML = '<div style="font-size:11px;color:var(--text-mut);text-align:center;padding:12px">No layers yet</div>';
    return;
  }
  bannerLayers.forEach((layer, i) => {
    const patInfo = PATTERN_LIST.find(p => p.id === layer.patternId) || { name: layer.patternId };
    const col = MC_COLORS[layer.colorIdx];
    const el = document.createElement('div'); el.className = 'banner-layer';

    // Mini preview using mask
    const cvs = document.createElement('canvas'); cvs.width = BW; cvs.height = BH;
    cvs.className = 'banner-layer-preview'; cvs.style.width = '20px'; cvs.style.height = '40px';
    const ctx = cvs.getContext('2d');
    const mask = loadedBannerMasks[layer.patternId];
    if (mask) {
      const rgb = col.rgb;
      const imgData = ctx.getImageData(0, 0, BW, BH);
      const d = imgData.data;
      const m = mask.data;
      for (let i = 0; i < d.length; i += 4) {
        const a = m[i + 3] / 255;
        if (a > 0) { d[i] = Math.round(rgb[0]*a); d[i+1] = Math.round(rgb[1]*a); d[i+2] = Math.round(rgb[2]*a); d[i+3] = Math.round(255*a); }
      }
      ctx.putImageData(imgData, 0, 0);
    }
    el.appendChild(cvs);

    const nameSpan = document.createElement('span'); nameSpan.className = 'banner-layer-name';
    nameSpan.textContent = patInfo.name;
    el.appendChild(nameSpan);

    // Inline color swatches
    const colorWrap = document.createElement('div');
    colorWrap.style.cssText = 'display:flex;gap:2px;flex-wrap:wrap;max-width:70px';
    MC_COLORS.forEach((mc, ci) => {
      const sw = document.createElement('div');
      sw.style.cssText = `width:12px;height:12px;background:${mc.hex};border-radius:2px;cursor:pointer;border:1px solid ${ci===layer.colorIdx?'#fff':'transparent'}`;
      sw.title = mc.name;
      sw.addEventListener('click', e => { e.stopPropagation(); layer.colorIdx = ci; renderLayers(); updatePreviews(); });
      colorWrap.appendChild(sw);
    });
    el.appendChild(colorWrap);

    // Arrows
    const arrows = document.createElement('div'); arrows.className = 'banner-layer-arrows';
    const up = document.createElement('button'); up.textContent = '▲';
    up.addEventListener('click', e => { e.stopPropagation(); if (i > 0) { [bannerLayers[i], bannerLayers[i-1]] = [bannerLayers[i-1], bannerLayers[i]]; renderLayers(); updatePreviews(); }});
    const down = document.createElement('button'); down.textContent = '▼';
    down.addEventListener('click', e => { e.stopPropagation(); if (i < bannerLayers.length-1) { [bannerLayers[i], bannerLayers[i+1]] = [bannerLayers[i+1], bannerLayers[i]]; renderLayers(); updatePreviews(); }});
    arrows.appendChild(up); arrows.appendChild(down);
    el.appendChild(arrows);

    const rm = document.createElement('button'); rm.className = 'banner-layer-rm'; rm.textContent = '✕';
    rm.addEventListener('click', e => { e.stopPropagation(); bannerLayers.splice(i, 1); renderLayers(); updatePreviews(); });
    el.appendChild(rm);

    container.appendChild(el);
  });
}

// ── Init ──
async function init() {
  if (!$('#bannerBaseColors')) return;

  await loadMasks();

  // Banner base colors
  const baseGrid = $('#bannerBaseColors');
  MC_COLORS.forEach((c, i) => {
    const sw = document.createElement('div'); sw.className = 'banner-color-swatch' + (i === bannerBase ? ' active' : '');
    sw.style.background = c.hex; sw.title = c.name;
    sw.addEventListener('click', () => {
      bannerBase = i;
      baseGrid.querySelectorAll('.banner-color-swatch').forEach((s,j) => s.classList.toggle('active', j===i));
      updatePreviews();
    });
    baseGrid.appendChild(sw);
  });

  // Cape body colors
  const capeGrid = $('#bannerCapeColors');
  MC_COLORS.forEach((c, i) => {
    const sw = document.createElement('div'); sw.className = 'banner-color-swatch' + (i === capeColor ? ' active' : '');
    sw.style.background = c.hex; sw.title = c.name;
    sw.addEventListener('click', () => {
      capeColor = i;
      capeGrid.querySelectorAll('.banner-color-swatch').forEach((s,j) => s.classList.toggle('active', j===i));
      updatePreviews();
    });
    capeGrid.appendChild(sw);
  });

  renderPatternPicker();

  $('#bannerAddLayer').addEventListener('click', () => {
    pickingForLayer = bannerLayers.length;
    $('#bannerPatternPicker').style.display = '';
  });

  $('#bannerDownload').addEventListener('click', () => {
    const cape = renderCapeTexture();
    const a = document.createElement('a');
    a.href = cape.toDataURL('image/png'); a.download = 'banner_cape.png'; a.click();
    if (typeof toast === 'function') toast('Cape downloaded!');
  });

  $('#bannerSaveLib').addEventListener('click', () => {
    const cape = renderCapeTexture();
    const name = 'Banner Cape ' + new Date().toLocaleTimeString();
    if (typeof saveCapeToLib === 'function') {
      saveCapeToLib(name, cape.toDataURL('image/png'));
      if (typeof renderCapeLibPage === 'function') renderCapeLibPage();
      if (typeof toast === 'function') toast('Saved to cape library!');
    }
  });

  $('#bannerClear').addEventListener('click', () => { bannerLayers = []; renderLayers(); updatePreviews(); });

  renderLayers();
  updatePreviews();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

}();

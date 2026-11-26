// Sunset notice (v1.9.4): EZCAPES is no longer supported; point users to the MCTools app
// and let them download everything they made in EZCAPES as one zip.
(function () {
  const URL_NEW = 'https://www.overwolf.com/app/mc-tools.net-mctools';
  const css = `
  .sunset-scrim{position:fixed;inset:0;z-index:99999;background:rgba(6,5,14,.78);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;font-family:var(--font,'Inter',sans-serif)}
  .sunset-card{width:min(440px,calc(100vw - 48px));background:var(--card-bg-solid,#16122a);border:1px solid var(--border-hi,rgba(140,110,220,.3));border-radius:var(--radius,14px);padding:28px 28px 22px;box-shadow:0 24px 60px rgba(0,0,0,.55);text-align:center;color:var(--text,#ddd8f0)}
  .sunset-card h2{font-size:20px;font-weight:800;margin-bottom:10px;color:#fff}
  .sunset-card p{font-size:13.5px;line-height:1.55;color:var(--text-sec,#9994b8);margin-bottom:20px}
  .sunset-card p b{color:var(--text,#ddd8f0)}
  .sunset-go{display:block;width:100%;padding:12px 16px;border:0;border-radius:var(--radius-sm,10px);background:var(--accent-dk,#7c4dff);color:#fff;font:700 14px var(--font,'Inter',sans-serif);cursor:pointer}
  .sunset-go:hover{background:var(--accent,#a47cff)}
  .sunset-link{display:block;margin-top:10px;font-size:11.5px;color:var(--text-mut,#5c5678);word-break:break-all;cursor:pointer;text-decoration:underline}
  .sunset-export{display:block;width:100%;margin-top:16px;padding:11px 16px;border:1px solid var(--border-hi,rgba(140,110,220,.3));border-radius:var(--radius-sm,10px);background:transparent;color:var(--text,#ddd8f0);font:600 13.5px var(--font,'Inter',sans-serif);cursor:pointer}
  .sunset-export:hover{background:rgba(140,110,220,.08)}
  .sunset-export:disabled{opacity:.6;cursor:default}
  .sunset-export-note{margin:6px 0 0!important;font-size:11.5px!important;color:var(--text-mut,#5c5678)!important}
  .sunset-result{margin-top:12px;padding:10px 12px;border-radius:var(--radius-sm,10px);font-size:12.5px;line-height:1.5;text-align:left;word-break:break-all}
  .sunset-result.ok{background:rgba(80,200,120,.1);border:1px solid rgba(80,200,120,.35)}
  .sunset-result.err{background:rgba(240,80,80,.1);border:1px solid rgba(240,80,80,.35)}
  .sunset-result code{font-size:11.5px;color:#fff}
  .sunset-result button{margin-top:8px;padding:6px 12px;border:0;border-radius:8px;background:var(--accent-dk,#7c4dff);color:#fff;font:600 12px var(--font,'Inter',sans-serif);cursor:pointer}
  .sunset-close{margin-top:14px;background:none;border:0;color:var(--text-mut,#5c5678);font:500 12px var(--font,'Inter',sans-serif);cursor:pointer}
  .sunset-close:hover{color:var(--text-sec,#9994b8)}
  .sunset-navbtn{font-family:var(--font);font-size:13px;font-weight:500;padding:11px 16px;border:none;border-radius:var(--radius-sm);cursor:pointer;background:transparent;color:var(--text-sec);text-align:left;display:flex;align-items:center;gap:10px;width:100%}
  .sunset-navbtn:hover{background:rgba(140,110,220,.06);color:var(--text)}`;

  function open() {
    if (window.ezcapes && window.ezcapes.openNewApp) window.ezcapes.openNewApp();
    else window.open(URL_NEW, '_blank');
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  // Grab everything EZCAPES saved in local storage and hand it to the main process,
  // which asks where to save and writes ONE zip.
  async function exportAll() {
    if (!window.ezcapes || !window.ezcapes.exportAllData) {
      return { ok: false, error: 'Export is only available in the EZCAPES desktop app.' };
    }
    const store = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        store[k] = localStorage.getItem(k);
      }
    } catch (e) { /* storage unreadable: still export app-data files */ }
    try { return await window.ezcapes.exportAllData({ localStorage: store }); }
    catch (e) { return { ok: false, error: (e && e.message) || String(e) }; }
  }

  // Wires an export button + a result box. Used by the launch popup and the in-app modal.
  function bindExport(btn, resultBox) {
    const label = btn.textContent;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Preparing your backup...';
      resultBox.hidden = true;
      const r = await exportAll();
      btn.disabled = false;
      btn.textContent = label;
      if (r.canceled) return;
      resultBox.hidden = false;
      if (r.ok) {
        const c = r.counts || {};
        const parts = [plural(c.skins || 0, 'skin'), plural(c.capes || 0, 'cape'), plural(c.packs || 0, 'saved pack')];
        if (c.appFiles) parts.push(plural(c.appFiles, 'app file'));
        if (c.installedPack) parts.push(plural(c.installedPack, 'installed pack file'));
        const empty = !(c.skins || c.capes || c.packs || c.appFiles || c.installedPack);
        resultBox.className = 'sunset-result ok';
        resultBox.innerHTML = `<b>Backup saved</b> (${fmtSize(r.size || 0)})<br>${empty ? 'Your library was empty, so the zip only has a README.' : esc(parts.join(', '))}<br><code>${esc(r.path)}</code><br><button type="button">Show in folder</button>`;
        resultBox.querySelector('button').addEventListener('click', () => window.ezcapes.showInFolder(r.path));
      } else {
        resultBox.className = 'sunset-result err';
        resultBox.innerHTML = `<b>Couldn't save the backup.</b><br>${esc(r.error || 'Unknown error')}<br>Try again and pick a different folder.`;
      }
    });
  }

  const exportBlock = `
    <button class="sunset-export" type="button">Download all my EZCAPES data</button>
    <p class="sunset-export-note">Your skins, capes and saved packs, in one .zip</p>
    <div class="sunset-result" hidden></div>`;

  function show() {
    const scrim = document.createElement('div');
    scrim.className = 'sunset-scrim';
    scrim.innerHTML = `
      <div class="sunset-card" role="dialog" aria-modal="true" aria-labelledby="sunset-title">
        <h2 id="sunset-title">Sorry, EZCAPES is no longer supported</h2>
        <p>Thanks for using it! Check out the new and improved version: <b>MCTools</b>, with the cape creator, skin studio and a lot more tools in one app.</p>
        <button class="sunset-go" type="button">Get the new MCTools app</button>
        <a class="sunset-link">${URL_NEW}</a>
        ${exportBlock}
        <button class="sunset-close" type="button">Continue to EZCAPES anyway</button>
      </div>`;
    scrim.querySelector('.sunset-go').addEventListener('click', open);
    scrim.querySelector('.sunset-link').addEventListener('click', open);
    bindExport(scrim.querySelector('.sunset-export'), scrim.querySelector('.sunset-result'));
    scrim.querySelector('.sunset-close').addEventListener('click', () => scrim.remove());
    document.body.appendChild(scrim);
  }

  // In-app entry point: sidebar button opens a small export dialog
  function showExportDialog() {
    const scrim = document.createElement('div');
    scrim.className = 'sunset-scrim';
    scrim.innerHTML = `
      <div class="sunset-card" role="dialog" aria-modal="true" aria-labelledby="sunset-exp-title">
        <h2 id="sunset-exp-title">Download all my EZCAPES data</h2>
        <p>Saves every skin, cape and saved pack you have in EZCAPES into one .zip you can keep or bring into <b>MCTools</b>.</p>
        ${exportBlock}
        <button class="sunset-close" type="button">Close</button>
      </div>`;
    scrim.querySelector('.sunset-export-note').remove();
    bindExport(scrim.querySelector('.sunset-export'), scrim.querySelector('.sunset-result'));
    scrim.querySelector('.sunset-close').addEventListener('click', () => scrim.remove());
    scrim.addEventListener('click', e => { if (e.target === scrim) scrim.remove(); });
    document.body.appendChild(scrim);
  }

  function addSidebarButton() {
    const links = document.querySelector('.sidebar-nav .nav-links');
    if (!links || document.querySelector('.sunset-navbtn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    // Not a .nav-tab on purpose: app.js treats those as page switches
    btn.className = 'sunset-navbtn';
    btn.innerHTML = '<span class="nav-icon">💾</span> Download My Data';
    btn.addEventListener('click', showExportDialog);
    links.appendChild(btn);
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    addSidebarButton();
    show();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

// Sunset notice (v1.9.4): EZCAPES is no longer supported; point users to the MCTools app.
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
  .sunset-close{margin-top:14px;background:none;border:0;color:var(--text-mut,#5c5678);font:500 12px var(--font,'Inter',sans-serif);cursor:pointer}
  .sunset-close:hover{color:var(--text-sec,#9994b8)}`;
  function open() {
    if (window.ezcapes && window.ezcapes.openNewApp) window.ezcapes.openNewApp();
    else window.open(URL_NEW, '_blank');
  }
  function show() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const scrim = document.createElement('div');
    scrim.className = 'sunset-scrim';
    scrim.innerHTML = `
      <div class="sunset-card" role="dialog" aria-modal="true" aria-labelledby="sunset-title">
        <h2 id="sunset-title">Sorry, EZCAPES is no longer supported</h2>
        <p>Thanks for using it! Check out the new and improved version: <b>MCTools</b>, with the cape creator, skin studio and a lot more tools in one app.</p>
        <button class="sunset-go" type="button">Get the new MCTools app</button>
        <a class="sunset-link">${URL_NEW}</a>
        <button class="sunset-close" type="button">Continue to EZCAPES anyway</button>
      </div>`;
    scrim.querySelector('.sunset-go').addEventListener('click', open);
    scrim.querySelector('.sunset-link').addEventListener('click', open);
    scrim.querySelector('.sunset-close').addEventListener('click', () => scrim.remove());
    document.body.appendChild(scrim);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();

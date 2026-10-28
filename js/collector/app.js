import {get, put, putMany, del} from '../core/db.js';
import {isOn, verify, disable, enable, supported} from './lock.js';
import {loadFiles} from './fileLoader.js';
import {st, refresh, renderHome, renderLedger, toast, esc, clearFilter} from './browse.js';
import {renderArchive, renderDetails} from './details.js';
import {renderSearch} from './search.js';
import {reconcile} from './reconcile.js';
import {choose} from './personal.js';
import {renderMenu} from './buttons.js';
import {check} from './updateCheck.js';
import {exportArchive} from './export.js';

const $ = id => document.getElementById(id);
const view = $('view');
let tab = 'home';

const R = {
  home: () => renderHome(view),
  ledger: () => renderLedger(view, reload, doExport),
  search: () => renderSearch(view),
  searchAll: () => renderSearch(view, true),
  searchFromHome: () => renderSearch(view, true, true),
  archive: () => renderArchive(view),
  details: () => renderDetails(view, () => show('home'))
};

function show(t){
  tab = t;
  st.bld = null; st.all = false;
  // إخفاء زر الرجوع لم يعد له داعي
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  try { R[t](); } catch(e){ console.error('show(' + t + ')', e); toast('خطأ: ' + e.message); }
}

async function doExport(){
  try{
    const a = await get('meta', 'auth');
    const r = await exportArchive(a);
    toast(r.n ? `جُهّز ${r.n} عملية` : 'لا جديد');
  }catch(e){ toast(e.message); }
}

async function reload(){
  try{
    const a = await get('meta', 'auth');
    const f = await get('meta', 'file');
    toast('جارٍ تحديث الملف…');
    await loadFiles(a, () => {}, async n => {
      const r = await reconcile(st.S, n.pairs, f?.cycle, n.full.cycle);
      await put('previousFile', 'prev', {cycle: f?.cycle, subs: st.S});
      if (r.other.length){
        await choose(`سيتحول ${r.other.length} عميل إلى مسدد. هل تتابع؟`, ['موافق'], false);
        await putMany('otherSource', r.other.map(o => [o.id, o]));
      }
    });
    await refresh();
    toast('تم تحديث الملف');
    const f2 = await get('meta', 'file');
    st.cycle = f2.cycle;
    renderMenu();
    $('who').textContent = `${a.name} · إصدار ${f2.cycle}`;
    show(tab);
  }catch(e){ toast('خطأ: ' + e.message); console.error(e); }
}

let unlocked = false, hiddenAt = 0, booted = false;
const LOCK_MS = 60 * 60 * 1000;

function showLocked(){
  $('app').hidden = true;
  $('tabs').hidden = true;
  $('locked').setAttribute('data-show', '1');
  tryUnlock();
}

function hideLocked(){
  $('locked').removeAttribute('data-show');
}

async function tryUnlock(){
  $('lmsg').textContent = '';
  try{
    await verify();
    unlocked = true;
    hideLocked();
    await boot();
  }catch(e){
    $('lmsg').textContent = 'لم يتم التحقق. اضغط «فتح» وحاول مرة أخرى.';
    console.warn(e);
  }
}

async function boot(){
  try{
    const a = await get('meta', 'auth');
    const f = await get('meta', 'file');
    if (!a || !f){ location.replace('login.html'); return; }
    if (!unlocked && await isOn()){ showLocked(); return; }
    booted = true;
    st.no = a.no; st.cycle = f.cycle; st.who = a.name;
    $('who').textContent = `${a.name} · إصدار ${f.cycle}`;
    hideLocked();
    $('diag').removeAttribute('data-show');
    if ($('menuBtn')) $('menuBtn').hidden = false;
    $('app').hidden = false;
    $('tabs').hidden = false;
    const ft = document.getElementById('footer');
    if (ft) ft.hidden = false;
    try { renderMenu(); } catch(e){ console.warn('menu', e); }
    try { await refresh(); } catch(e){ console.warn('refresh', e); }
    try { show('home'); } catch(e){ console.warn('show', e); }
    try { check(); } catch(e){ console.warn('check', e); }
  }catch(e){
    console.error('boot', e);
    $('who').textContent = 'خطأ: ' + e.message;
  }
}

$('unlockBtn').onclick = tryUnlock;
$('relogin').onclick = async () => {
  if (!confirm('ستدخل بالاسم وكلمة السر من جديد. بياناتك تبقى محفوظة. متابعة؟')) return;
  try{ await disable(); }catch(e){}
  try{ await del('meta', 'auth'); }catch(e){}
  unlocked = false; booted = false;
  location.replace('login.html');
};

document.addEventListener('visibilitychange', async () => {
  if (document.hidden){ hiddenAt = Date.now(); }
  else if (hiddenAt && Date.now() - hiddenAt > LOCK_MS){
    try{
      if (await isOn()){ unlocked = false; booted = false; hiddenAt = 0; boot(); }
    }catch(e){}
  }
});

document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
  st.sel.clear(); st.open = null;
  show(b.dataset.t);
});

window.addEventListener('openTab', e => {
  const t = e.detail && e.detail.tab;
  if (!t) return;
  st.sel.clear(); st.open = null;
  show(t);
});

// (تم حذف سطر زر الرجوع القديم من هنا)

addEventListener('popstate', () => {
  if (st.sel.size && !confirm('لديك تحديد غير محفوظ، هل تخرج؟')){
    history.pushState({v: 'bld'}, ''); return;
  }
  st.sel.clear(); show(tab);
});

const net = () => {
  $('net').textContent = navigator.onLine ? 'متصل' : 'بدون إنترنت';
  $('net').dataset.on = navigator.onLine;
};
addEventListener('online', net);
addEventListener('offline', net);
net();

if ('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then(r => {
    r.addEventListener('updatefound', () => {
      const w = r.installing;
      if (w) w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) w.postMessage({type: 'SKIP_WAITING'});
      });
    });
  }).catch(console.warn);
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data && e.data.type === 'RELOAD') location.reload();
  });
}

$('menuBtn').onclick = e => { e.stopPropagation(); $('menu').hidden = !$('menu').hidden; };
document.addEventListener('click', () => { $('menu').hidden = true; });


// ===== استرجاع الوضع المحفوظ (يدعم 4 أوضاع) =====
const VALID_THEMES = ['light', 'dark', 'desert', 'highcontrast'];
const savedTheme = (localStorage.getItem('app-theme') || 'light').toLowerCase();
document.body.setAttribute('data-theme', VALID_THEMES.includes(savedTheme) ? savedTheme : 'light');

/* ===== زر الخروج (SVG) مع تأكيد + fallback ===== */
const exitBtn = document.getElementById('exitBtn');
if (exitBtn){
  exitBtn.onclick = async () => {
    if (!confirm('هل تريد الخروج من التطبيق؟')) return;
    try{
      window.close();
      setTimeout(async () => {
        try{
          const {disable} = await import('./lock.js');
          await disable();
        }catch(e){}
        try{
          const {del} = await import('../core/db.js');
          await del('meta', 'auth');
        }catch(e){}
        location.replace('login.html');
      }, 200);
    }catch(e){
      location.replace('login.html');
    }
  };
}

/* ===== دعم إيماءات السحب للرجوع (Swipe Right) ===== */
let touchStartX = 0;
let touchStartY = 0;
const minSwipeDistance = 100;

document.addEventListener('touchstart', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.addEventListener('touchend', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  const touchEndX = e.changedTouches[0].screenX;
  const touchEndY = e.changedTouches[0].screenY;
  const distanceX = touchEndX - touchStartX;
  const distanceY = touchEndY - touchStartY;

  if (Math.abs(distanceX) > minSwipeDistance && Math.abs(distanceY) < 60) {
    if (distanceX > 0) { 
      const openDialog = document.querySelector('dialog[open]');
      if (openDialog) { openDialog.close(); openDialog.remove(); return; }
      
      const activeTab = document.querySelector('#tabs button.on');
      if (activeTab && activeTab.dataset.t !== 'home') {
        document.querySelector('#tabs button[data-t="home"]').click();
        return;
      }
      
      const backBtn = document.getElementById('back');
      if (backBtn && !backBtn.hidden) {
        history.back();
      } else if (typeof st !== 'undefined' && st.open) {
        st.open = null;
        st.sel.clear();
        if (typeof renderHome === 'function') renderHome(document.getElementById('view'));
      }
    }
  }
}, { passive: true });

console.log('[app] started');
boot();

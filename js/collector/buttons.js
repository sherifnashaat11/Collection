import { get } from '../core/db.js';
import { isOn, enable, disable, verify } from './lock.js';
import { openExportDialog } from './exportExcel.js';
import { toast } from './browse.js';

const ok = f => /^https:\/\//.test(f) || /^[\w.-]+\.html?$/.test(f);

const url = f => {
  if (/^https:/.test(f)) return f;
  if (f.startsWith('gas_') || f === 'index.html') return f;
  return 'pages/' + f;
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ===== الأنماط الأربعة ===== */
const THEMES = [
  { id: 'light',    label: 'الوضع الفاتح',  icon: '☀️' },
  { id: 'dark',     label: 'الوضع الداكن',  icon: '🌙' },
  { id: 'emerald',  label: 'الوضع الأخضر',  icon: '🌿' },
  { id: 'midnight', label: 'الأزرق الليلي', icon: '🌌' },
];

function currentThemeId() {
  const id = document.body.getAttribute('data-theme');
  return THEMES.some(t => t.id === id) ? id : 'light';
}
function nextTheme() {
  const cur = currentThemeId();
  const i = THEMES.findIndex(t => t.id === cur);
  return THEMES[(i + 1) % THEMES.length];
}
function applyTheme(id) {
  if (!THEMES.some(t => t.id === id)) id = 'light';
  if (id === 'light') document.body.removeAttribute('data-theme');
  else document.body.setAttribute('data-theme', id);
  try { localStorage.setItem('app-theme', id); } catch (_) {}
  document.dispatchEvent(new CustomEvent('themechange', { detail: { id } }));
  document.querySelector('#tabs button.on')?.click();
}

export function openPage(file, params){
  const u = url(file) + (params ? '?' + params : '');
  const d = document.createElement('dialog');
  d.className = 'viewer';
  d.innerHTML = `<iframe src="${esc(u)}" loading="lazy"></iframe>
    <div class="actions">
      <a class="btn ghost sm" href="${esc(u)}" target="_blank" rel="noopener">فتح في نافذة جديدة</a>
      <button class="btn sm" id="cl" type="button">إغلاق</button>
    </div>`;
  d.querySelector('#cl').onclick = () => { d.close(); d.remove(); };
  document.body.append(d);
  d.showModal();
}

export async function renderMenu(){
  const f = await get('meta','file');
  const btns = ((f && f.buttons) || [])
    .filter(x => ok(x.file))
    .sort((p, q) => p.order - q.order);

  const m = document.getElementById('menu');
  if (!m) return;

  const lockOn = await isOn();

  let html = '';
  html += `<button type="button" data-lock="1">
    ${lockOn ? '🔓 إلغاء قفل التطبيق' : '🔒 قفل التطبيق ببصمة أو نقش أو كلمة الجهاز'}
  </button>`;
  html += '<hr>';
  html += `<button type="button" data-calc="1">🧮 حساب الفاتورة</button>`;
  html += `<button type="button" data-export="1">📊 تصدير Excel (غير المسددين)</button>`;
  html += `<button type="button" data-full-search="1">🔍 بحث شامل</button>`;

  const nxt = nextTheme();
  html += `<button type="button" data-theme-toggle="1">${nxt.icon} ${nxt.label}</button>`;

  html += '<hr>';
  btns.forEach(x => {
    html += `<button type="button" data-f="${esc(x.file)}">${esc(x.name)}</button>`;
  });
  html += '<hr>';
  html += '<button type="button" data-archive="1">📚 الأرشيف</button>';
  html += '<button type="button" data-details="1">📋 التفاصيل</button>';

  m.innerHTML = html;

  m.querySelector('[data-lock]').onclick = async () => {
    m.hidden = true;
    try{
      if (lockOn){
        await verify(); await disable();
        alert('أُلغي قفل التطبيق.');
      } else {
        await enable();
        alert('تم تفعيل القفل. سيطلب التطبيق بصمتك عند كل فتح.');
      }
    }catch(e){ alert(e.message || 'تعذر تنفيذ العملية'); }
    renderMenu();
  };

  m.querySelector('[data-calc]').onclick = () => { m.hidden = true; openPage('gas_Calculator.html'); };
  m.querySelector('[data-export]').onclick = () => { m.hidden = true; openExportDialog(); };

  const btnFullSearch = m.querySelector('[data-full-search]');
  if (btnFullSearch) {
    btnFullSearch.onclick = () => {
      m.hidden = true;
      document.querySelector('#tabs button[data-t="search"]').click();
    };
  }

  const btnTheme = m.querySelector('[data-theme-toggle]');
  if (btnTheme) {
    btnTheme.onclick = () => {
      m.hidden = true;
      const n = nextTheme();
      applyTheme(n.id);
      toast(`تم تفعيل ${n.label}`);
    };
  }

  m.querySelectorAll('[data-f]').forEach(btn => {
    btn.onclick = () => { m.hidden = true; openPage(btn.dataset.f); };
  });

  m.querySelector('[data-archive]').onclick = () => {
    m.hidden = true;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('on'));
    window.dispatchEvent(new CustomEvent('openTab', {detail:{tab:'archive'}}));
  };
  m.querySelector('[data-details]').onclick = () => {
    m.hidden = true;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('on'));
    window.dispatchEvent(new CustomEvent('openTab', {detail:{tab:'details'}}));
  };
}

export function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('app-theme'); } catch (_) {}
  if (saved && THEMES.some(t => t.id === saved)) applyTheme(saved);
  else document.body.removeAttribute('data-theme');
}

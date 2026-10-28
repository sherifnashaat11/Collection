import {get} from '../core/db.js';
import {isOn, enable, disable, verify} from './lock.js';
import {openExportDialog} from './exportExcel.js';

function showToast(msg) {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg;
    t.className = 'show';
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.className = ''; }, 2400);
  } else {
    alert(msg);
  }
}

const ok = f => /^https:\/\//.test(f) || /^[\w.-]+\.html?$/.test(f);

const url = f => {
  if (/^https:/.test(f)) return f;
  if (f.startsWith('gas_') || f === 'index.html') return f;
  return 'pages/' + f;
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export const THEMES = [
  { id: 'light',        label: '☀️ فاتح',              desc: 'نهاراً indoors',              preview: { bg: '#ffffff', fg: '#0f2438' } },
  { id: 'dark',         label: '🌙 داكن',              desc: 'ليلاً، توفير بطارية',          preview: { bg: '#1e293b', fg: '#f1f5f9' } },
  { id: 'desert',       label: '🏜️ صحراوي',            desc: 'شمس مباشرة، تقليل الوهج',      preview: { bg: '#fdf6ec', fg: '#3b2a1a' } },
  { id: 'highcontrast', label: '🌑 ليلي عالي التباين',  desc: 'تباين أقصى لضعف البصر',        preview: { bg: '#000000', fg: '#ffffff' } }
];

const VALID_IDS = THEMES.map(t => t.id);

export function applyTheme(id){
  if (!VALID_IDS.includes(id)) id = 'light';
  document.body.setAttribute('data-theme', id);
  try { localStorage.setItem('app-theme', id); } catch(e){}
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
  const currentTheme = (document.body.getAttribute('data-theme') || 'light').toLowerCase();

  let html = '';

  // زر القفل
  html += `<button type="button" data-lock="1">
    ${lockOn ? '🔓 إلغاء قفل التطبيق' : '🔒 قفل التطبيق ببصمة أو نقش أو كلمة الجهاز'}
  </button>`;

  html += '<hr>';

  // زر حساب الفاتورة (الحاسبة المستقلة)
  html += `<button type="button" data-calc="1">🧮 حساب الفاتورة (مستقل)</button>`;

  // تصدير Excel
  html += `<button type="button" data-export="1">📊 تصدير Excel (غير المسددين)</button>`;

  // البحث خارج النطاق
  html += `<button type="button" data-search-all="1">🔍 بحث خارج النطاق</button>`;

  // قائمة أوضاع العرض
  const currentLabel = (THEMES.find(t => t.id === currentTheme) || THEMES[0]).label;
  html += `
    <div class="themes-group" data-themes-group="1">
      <button type="button" class="themes-toggle" data-themes-toggle="1" aria-expanded="false">
        <span>🎨 وضع العرض</span>
        <span class="themes-current">${currentLabel}</span>
        <span class="themes-arrow">▾</span>
      </button>
      <div class="themes-list" data-themes-list="1" hidden>
        ${THEMES.map(t => {
          const active = currentTheme === t.id;
          return `<button type="button" class="theme-btn ${active ? 'active' : ''}" data-theme-pick="${t.id}" title="${esc(t.desc)}">
            <span class="theme-preview" style="background:${t.preview.bg};color:${t.preview.fg};border-color:${t.preview.fg}33">Aa</span>
            <span class="theme-txt">
              <span class="theme-lbl">${t.label}</span>
              <span class="theme-desc">${esc(t.desc)}</span>
            </span>
            <span class="theme-chk">${active ? '✓' : ''}</span>
          </button>`;
        }).join('')}
      </div>
    </div>
  `;

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
        await verify();
        await disable();
        showToast('أُلغي قفل التطبيق.');
      } else {
        await enable();
        showToast('تم تفعيل القفل. سيطلب التطبيق بصمتك عند كل فتح.');
      }
    }catch(e){
      showToast(e.message || 'تعذر تنفيذ العملية');
    }
    renderMenu();
  };

  // فتح الحاسبة المستقلة بدون أي بيانات
  m.querySelector('[data-calc]').onclick = () => {
    m.hidden = true;
    openPage('calculator.html'); 
  };

  m.querySelector('[data-export]').onclick = () => {
    m.hidden = true;
    openExportDialog();
  };

  const btnSearchAll = m.querySelector('[data-search-all]');
  if (btnSearchAll) {
    btnSearchAll.onclick = () => {
      m.hidden = true;
      document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('on'));
      const ev = new CustomEvent('openTab', {detail:{tab:'searchAll'}});
      window.dispatchEvent(ev);
    };
  }

  const themesToggle = m.querySelector('[data-themes-toggle]');
  const themesList = m.querySelector('[data-themes-list]');
  if (themesToggle && themesList){
    themesToggle.onclick = (ev) => {
      ev.stopPropagation();
      const willOpen = themesList.hidden;
      themesList.hidden = !willOpen;
      themesToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      const arrow = themesToggle.querySelector('.themes-arrow');
      if (arrow) arrow.textContent = willOpen ? '▴' : '▾';
    };
  }

  m.querySelectorAll('[data-theme-pick]').forEach(btn => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      applyTheme(btn.dataset.themePick);
      showToast('تم تفعيل الوضع');
      renderMenu();
      document.querySelector('#tabs button.on')?.click();
    };
  });

  m.querySelectorAll('[data-f]').forEach(btn => {
    btn.onclick = () => { m.hidden = true; openPage(btn.dataset.f); };
  });

  m.querySelector('[data-archive]').onclick = () => {
    m.hidden = true;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('on'));
    const ev = new CustomEvent('openTab', {detail:{tab:'archive'}});
    window.dispatchEvent(ev);
  };

  m.querySelector('[data-details]').onclick = () => {
    m.hidden = true;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.remove('on'));
    const ev = new CustomEvent('openTab', {detail:{tab:'details'}});
    window.dispatchEvent(ev);
  };
}

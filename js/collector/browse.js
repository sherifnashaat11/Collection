import { all, get, put } from '../core/db.js';
import { money } from '../core/utils.js';
import { list, pay, addAdvance, undo, canUndo, ldate, keyOf as key, partialPay } from './ledger.js';
import { totals } from './payment.js';
import { openPage } from './buttons.js';
import { getManual, saveManual } from './names.js';
import { choose } from './personal.js';
import { monthOptions } from './monthly.js';
import { searchKey } from '../core/normalize.js';





export function setFilter(f){ st.filter = f; }
export function clearFilter(){ st.filter = null; }




export const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

export const st = {
  S: [], by: new Map(), paid: new Set(), adv: new Map(), sel: new Set(),
  sector: '', blk: '', bld: null, apt: null, open: null,
  pager: true, all: false, cycle: '', who: '', no: '0',
  filter: null, filterSel: new Set()
};

const srt = (a,b) => Number(a)-Number(b);
const num = s => +String(s||'').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const due = s => Math.max(0, s.value - (st.adv.get(key(s))||0));
const tot = a => totals(a, due);
const fz = s => searchKey(s).replace(/[خج]/g, 'ح').replace(/ذ/g, 'د');

export async function refresh(){
  const mn = await getManual();
  st.S = await all('subscribers');
  st.S.forEach(s => { const n = mn[key(s)]; if (n) s.name = n; });
  st.by = new Map(st.S.map(s => [key(s), s]));
  const e = await list();
  const fullPaid = new Set(e.filter(x => x.type === 'pay' && !x.partial && !x.personal).map(x => x.key));
  const stillDue = new Set(st.S.filter(s => (s.value||0) > 0 || (s.count||0) > 0).map(s => key(s)));
  st.paid = new Set([...fullPaid].filter(k => !stillDue.has(k)));
  st.adv = new Map((await all('advance')).map(v => [v.key, v.balance]));
}

export const work = () => st.S.filter(s => (st.all || s.inRoute) && !st.paid.has(key(s)));

export const toast = t => {
  const e = document.getElementById('toast');
  if (!e) return;
  e.textContent = t;
  e.className = 'show';
  clearTimeout(e._t);
  e._t = setTimeout(() => { e.className = ''; }, 2600);
};

/* ===== دالة تأكيد الطباعة ===== */
function askPrint(entries) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.innerHTML = `
      <h3 style="margin-bottom: 10px;">✅ تم السداد بنجاح</h3>
      <p class="mute" style="margin-bottom: 15px;">هل تريد طباعة الإيصال الآن؟</p>
      <div class="actions" style="display: flex; gap: 10px;">
        <button class="btn" id="printYes" style="flex: 1;">🖨️ نعم، طباعة</button>
        <button class="btn ghost" id="printNo" style="flex: 1;">❌ لا، شكراً</button>
      </div>
    `;
    document.body.append(d);
    d.showModal();
    
    d.querySelector('#printNo').onclick = () => { d.close(); d.remove(); resolve(false); };
    d.querySelector('#printYes').onclick = () => {
      d.close(); d.remove();
      entries.forEach((e, idx) => {
        setTimeout(() => {
          const s = st.by.get(e.key) || {};
          const q = new URLSearchParams({
            n: s.name || '', s: s.sector || '', b: s.blk || '', d: s.bld || '', a: s.apt || '',
            v: e.due || s.value || 0, r: e.fromAdvance || 0, q: e.amount || 0,
            c: e.count || 0, m: st.cycle, u: st.who, k: e.key
          }).toString();
          window.open('pages/print.html?' + q, '_blank');
        }, idx * 500);
      });
      resolve(true);
    };
  });
}

/* ===== تصميم بطاقات الشقق ===== */
function aptsView(a){
  const ch = a.filter(s => st.sel.has(key(s)));
  const ct = tot(ch);
  const allTot = tot(a);
  
  const totalBuildingDue = allTot.value;
  const selectedDue = ct.value;
  const remainingValue = totalBuildingDue - selectedDue;

  const cards = a.map(s => {
    const k = key(s);
    const b = st.adv.get(k) || 0;
    const selected = st.sel.has(k);
    const nameHtml = s.name ? esc(s.name) : '<em class="empty-name">بدون اسم</em>';
    const isOdd = Number(s.apt) % 2 === 1 ? '1' : '0';
    const partial = (s.count || 0) > 1;
    
    return `<div class="apt-card ${selected?'on':''}" data-card="${k}" data-apt-odd="${isOdd}">
      <div class="apt-row-1">
        <div class="apt-name" data-nm="${k}">${nameHtml}</div>
        <button class="apt-val-btn" data-p="${k}" type="button">${money(due(s))}</button>
      </div>
      
      <div class="apt-row-2">
        <div class="apt-info">
          <span class="apt-apt-box">${s.apt}</span>
          <span class="apt-count">${s.count} فاتورة</span>
        </div>
        <label class="apt-chk"><input type="checkbox" data-k="${k}" ${selected?'checked':''}></label>
        <div class="apt-menu-wrap">
          <button class="apt-dots" data-m="${k}" type="button" aria-label="خيارات">⋮</button>
          <div class="apt-pop" data-pop="${k}" hidden>
            <button data-act="read" data-id="${k}" type="button">قراءة عداد</button>
            ${partial ? `<button data-act="partial" data-id="${k}" type="button">سداد جزئي</button>` : ''}
            <div class="apt-pop-info">الفواتير: ${s.count} · القيمة: ${money(s.value)}</div>
            ${!s.name ? `<button data-act="name" data-id="${k}" type="button">تعديل الاسم</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  let barHtml = '';
  if (ch.length > 0) {
    barHtml = `
      <div class="building-bottom-card">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; color: var(--ink);">
          <span>إجمالي العمارة:</span>
          <b>${money(allTot.value)} ج</b>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; color: var(--ink);">
          <span>المتبقي بعد السداد:</span>
          <b>${money(remainingValue)} ج</b>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; color: var(--ember); font-weight: 800;">
          <span>المحدد (${ch.length} شقة · ${ch.reduce((t,s) => t + (s.count||0), 0)} فاتورة):</span>
          <b>${money(ct.value)} ج</b>
        </div>
        <button class="btn" id="pay" style="width: 100%; background: var(--ok); color: #fff;">
          سداد المحدد (${money(ct.value)} ج)
        </button>
      </div>
    `;
  }

  return {html: cards, ch, ct, allTot, barHtml};
}

/* ===== ربط أحداث الشقق ===== */
function bind(el, a, v, again){
  el.querySelectorAll('[data-k]').forEach(c => {
    c.onchange = () => { c.checked ? st.sel.add(c.dataset.k) : st.sel.delete(c.dataset.k); again(); };
  });
  el.querySelectorAll('[data-nm]').forEach(nm => {
    nm.onclick = ev => {
      ev.stopPropagation();
      const k = nm.dataset.nm;
      if (st.sel.has(k)) st.sel.delete(k); else st.sel.add(k);
      again();
    };
  });
  el.querySelectorAll('[data-m]').forEach(btn => {
    btn.onclick = ev => {
      ev.stopPropagation();
      el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
      const pop = el.querySelector(`[data-pop="${btn.dataset.m}"]`);
      if (pop) pop.hidden = !pop.hidden;
    };
  });
  document.addEventListener('click', () => { el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true); });

  el.querySelectorAll('[data-act]').forEach(b => {
    b.onclick = async ev => {
      ev.stopPropagation();
      const k = b.dataset.id, s = st.by.get(k);
      const act = b.dataset.act;
      if (act === 'read'){
        const q = new URLSearchParams({
          n: s.name||'', s: s.sector, b: s.blk, d: s.bld, a: s.apt,
          v: s.value, r: st.adv.get(k)||0, q: due(s), c: s.count, m: st.cycle, u: st.who, k
        }).toString();
        openPage('reading.html', q);
        el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
      }
      if (act === 'name'){
        const n = prompt('اسم العميل', s?.name || '');
        if (n && n.trim()){
          await saveManual(k, n.trim());
          await refresh();
          el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
          again();
        }
      }
      if (act === 'partial'){
        const res = await partialDialog(s);
        if (res){
          await partialPay(st.no, s, res, st.adv);
          await refresh();
          toast(`تم سداد جزئي: ${res.count} فاتورة (${money(res.amount)} جنيه)`);
          el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
          again();
        }
      }
    };
  });

  el.querySelectorAll('[data-p]').forEach(btn => {
    btn.onclick = async ev => {
      ev.stopPropagation();
      const k = btn.dataset.p, s = st.by.get(k), amt = due(s);
      if (!amt){ toast('لا يوجد مبلغ مستحق'); return; }
      if (!confirm(`تأكيد سداد شقة ${s.apt} — ${s.name||'بدون اسم'} بمبلغ ${money(amt)} جنيه؟`)) return;
      const entry = await pay(st.no, [s], st.adv);
      await put('lastPosition','last',{sector:st.sector, blk:st.blk, bld:st.bld});
      st.sel.delete(k);
      await refresh();
      toast(`تم سداد شقة ${s.apt} (${money(amt)} جنيه)`);
      await askPrint([entry || { key: k, due: s.value, amount: amt, count: s.count, fromAdvance: 0 }]);
      again();
    };
  });

  const p = el.querySelector('#pay');
  if (p) p.onclick = async () => {
    if (!v.ch.length) return;
    const amt = v.ct.value;
    if (!confirm(`تأكيد سداد ${v.ch.length} شقة بمبلغ ${money(amt)} جنيه؟`)) return;
    const entries = await pay(st.no, v.ch, st.adv);
    await put('lastPosition','last',{sector:st.sector, blk:st.blk, bld:st.bld});
    st.sel.clear();
    await refresh();
    toast(`تم سداد ${v.ch.length} شقة (${money(amt)} جنيه)`);
    await askPrint(entries || v.ch.map(s => ({ key: key(s), due: s.value, amount: due(s), count: s.count, fromAdvance: 0 })));
    again();
  };
}

/* ===== السداد الجزئي ===== */
function partialDialog(s){
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'partial-dialog';
    const maxCount = s.count || 1;
    const unitValue = maxCount > 0 ? Math.round((s.value / maxCount) * 100) / 100 : s.value;
    const mOpts = monthOptions(s);
    let options = '';
    if (mOpts && mOpts.length > 1){
      mOpts.forEach(opt => {
        options += `<button class="partial-opt" type="button" data-cnt="${opt.count}" data-amt="${opt.amount}">
          عدد ${opt.count} — ${money(opt.amount)} جنيه
          <small>${opt.label}</small>
        </button>`;
      });
    }
    d.innerHTML = `
      <h3>سداد جزئي — شقة ${s.apt}</h3>
      <p class="mute">المديونية الحالية: ${s.count} فاتورة بقيمة ${money(s.value)} جنيه</p>
      ${options ? `<div class="partial-options">${options}</div>` : `
      <div class="stack">
        <label class="field"><span>عدد الفواتير المسددة</span><input id="pCount" type="number" min="1" max="${maxCount}" value="1"></label>
        <label class="field"><span>القيمة المسددة</span><input id="pAmount" type="number" min="1" value="${unitValue}"></label>
      </div>
      `}
      <div class="actions">
        <button class="btn" id="pOk" type="button">تأكيد السداد</button>
        <button class="btn ghost" id="pCancel" type="button">إلغاء</button>
      </div>
    `;
    document.body.append(d);
    d.showModal();
    d.querySelector('#pCancel').onclick = () => { d.close(); d.remove(); resolve(null); };
    d.querySelector('#pOk').onclick = () => {
      let count, amount;
      if (options){
        const sel = d.querySelector('.partial-opt.selected');
        if (!sel){ alert('اختر إحدى القيم'); return; }
        count = +sel.dataset.cnt;
        amount = +sel.dataset.amt;
      } else {
        count = +d.querySelector('#pCount').value;
        amount = +d.querySelector('#pAmount').value;
      }
      if (!(count > 0) || !(amount > 0)){ alert('أدخل قيماً صحيحة'); return; }
      if (count > maxCount){ alert('عدد الفواتير أكبر من المديونية'); return; }
      if (amount > s.value){ alert('القيمة أكبر من المديونية'); return; }
      d.close(); d.remove();
      resolve({count, amount});
    };
    d.querySelectorAll('.partial-opt').forEach(b => {
      b.onclick = () => {
        d.querySelectorAll('.partial-opt').forEach(x => x.classList.remove('selected'));
        b.classList.add('selected');
      };
    });
  });
}

/* ===== الصفحة الرئيسية ===== */
export async function renderHome(el){
  const y = scrollY;
  const w = work();
  if (!st.S.length){
    el.innerHTML = '<div class="empty">لا توجد بيانات بعد. اضغط «تحديث الملف» من تبويب «ما تم تحصيله».</div>';
    return;
  }
  const secs = [...new Set(w.map(s => s.sector))].sort(srt);
  if (!secs.length){
    el.innerHTML = '<div class="empty">لا يوجد عملاء غير مسددين في خط سيرك. ما شاء الله.</div>';
    return;
  }
  if (!secs.includes(st.sector)) st.sector = secs[0];
  const blks = [...new Set(w.filter(s => s.sector===st.sector).map(s => s.blk))].sort(srt);
  if (!blks.includes(st.blk)) st.blk = blks[0];
  const rows = w.filter(s => s.sector===st.sector && s.blk===st.blk);
  const g = {};
  rows.forEach(s => (g[s.bld] = g[s.bld] || []).push(s));
  const t = tot(rows);
  const opt = (a,v) => a.map(x => `<option ${x===v?'selected':''}>${x}</option>`).join('');

  let ov = null;

  let html = `
  <div class="card" id="searchBarCard" style="margin-bottom: 15px;">
    <div class="view-mode" style="display: flex; gap: 10px; margin-bottom: 10px;">
      <button class="btn ${currentMode === 'search-name' ? '' : 'ghost'}" id="btnSearchName" style="flex:1; font-size:13px;">🔍 بحث بالاسم</button>
      <button class="btn ${currentMode === 'search-code' ? '' : 'ghost'}" id="btnSearchCode" style="flex:1; font-size:13px;">🔍 بحث برقم المشترك</button>
    </div>
    <div id="searchPanel" style="display:none;">
      <div id="searchNameWrap" style="display:none;">
        <input id="mainSearchInput" type="text" placeholder="اكتب اسم العميل…" style="width:100%; padding: 10px; border-radius: 8px; border: 1px solid var(--line); font-family: inherit; margin-bottom: 10px;">
        <button class="btn sm" id="mainSearchBtnName" style="width:100%;">بحث</button>
      </div>
      <div id="searchCodeWrap" style="display:none;">
        <div class="pick" style="grid-template-columns:1fr 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
          <label class="field"><span>القطاع</span><input id="mSec" class="num2" type="text" maxlength="2"></label>
          <label class="field"><span>البلوك</span><input id="mBlk" class="num2" type="text" maxlength="2"></label>
          <label class="field"><span>العمارة</span><input id="mBld" class="num2" type="text" maxlength="2"></label>
          <label class="field"><span>الشقة</span><input id="mApt" class="num2" type="text" maxlength="2"></label>
        </div>
        <button class="btn sm" id="mainSearchBtnCode" style="width:100%;">بحث</button>
      </div>
      <button class="btn ghost sm" id="cancelSearchBtn" style="width:100%; margin-top: 10px;">إلغاء البحث</button>
    </div>
  </div>

  <div class="pick">
    <label class="field"><span>القطاع</span><select id="sSec">${opt(secs,st.sector)}</select></label>
    <label class="field"><span>البلوك</span><select id="sBlk">${opt(blks,st.blk)}</select></label>
    <label class="field"><span>العمارة</span>
      <select id="sBld">
        <option value="">— اختر —</option>
        ${Object.keys(g).sort((a,b)=> Number(a)-Number(b)).map(b => `<option value="${b}" ${st.open === b ? 'selected' : ''}>${b}</option>`).join('')}
      </select>
    </label>
  </div>
  <div class="view-mode" style="display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-top: 10px;">
    <button class="btn ghost sm" id="modeList" type="button" style="flex: 1;">عرض القائمة</button>
    <input id="bldIn" class="num2" type="text" inputmode="numeric" maxlength="2" placeholder="رقم العمارة" value="${st.open||''}" style="flex: 1; min-height: 40px; text-align: center; font-weight: 800;">
  </div>
  <p class="sum" style="text-align:center; color:var(--mute); margin: 10px 0;">${t.n} شقة · ${t.count} فاتورة · <b>${money(t.value)}</b> جنيه</p>
  <div class="blist" id="mainBlist">`;

  if (st.open && g[st.open]){
    st.bld = st.open;
    localStorage.setItem('lastPosition', JSON.stringify({ sector: st.sector, blk: st.blk, bld: st.open }));
    const aa = g[st.open].sort((p,q) => srt(p.apt, q.apt));
    ov = {a: aa, v: aptsView(aa)};
    
    const sortedBlds = Object.keys(g).sort((a,b) => Number(a)-Number(b));
    const currentIdx = sortedBlds.indexOf(st.open);
    const prevBld = currentIdx > 0 ? sortedBlds[currentIdx - 1] : null;
    const nextBld = currentIdx < sortedBlds.length - 1 ? sortedBlds[currentIdx + 1] : null;

    html += `
    </div>
    <div id="buildingView">
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <button class="btn ghost sm" data-nav="prev" ${prevBld ? '' : 'disabled'} style="flex:1; margin-left:5px;">⏪ السابق</button>
        <button class="btn ghost sm" data-nav="next" ${nextBld ? '' : 'disabled'} style="flex:1; margin-right:5px;">التالي ⏩</button>
      </div>
      <div class="card apts" style="padding: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h2 style="margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">عمارة ${st.open} <span style="font-size: 16px; color: var(--ember); font-weight: 800;">(${money(tot(aa).value)} ج)</span></h2>
          <label class="chk"><input type="checkbox" id="selectAllApts" ${aa.length > 0 && aa.every(s => st.sel.has(key(s))) ? 'checked' : ''}> تحديد الكل</label>
        </div>
        ${ov.v.html}
        ${ov.v.barHtml}
      </div>
    </div>`;
  } else {
    Object.keys(g).sort(srt).forEach(b => {
      const x = tot(g[b]);
      const o = st.open === b;
      const cells = `<b>عمارة ${b}</b><span>${x.n} شقة</span><span>${x.count} فاتورة</span><strong>${money(x.value)}</strong>`;
      html += `<div class="brow prow ${o?'open':''}" data-b="${b}" role="button" tabindex="0">${cells}</div>`;
    });
    html += `</div></div>`;
  }

  el.innerHTML = html;

  /* ربط الأحداث */
  const searchPanel = el.querySelector('#searchPanel');
  const nameWrap = el.querySelector('#searchNameWrap');
  const codeWrap = el.querySelector('#searchCodeWrap');
  const inputName = el.querySelector('#mainSearchInput');
  const mainBlist = el.querySelector('#mainBlist');

  el.querySelector('#btnSearchName').onclick = () => {
    searchPanel.style.display = 'block';
    nameWrap.style.display = 'block';
    codeWrap.style.display = 'none';
    el.querySelector('#btnSearchName').classList.remove('ghost');
    el.querySelector('#btnSearchCode').classList.add('ghost');
    mainBlist.innerHTML = '';
    inputName.focus();
  };

  el.querySelector('#btnSearchCode').onclick = () => {
    searchPanel.style.display = 'block';
    nameWrap.style.display = 'none';
    codeWrap.style.display = 'block';
    el.querySelector('#btnSearchCode').classList.remove('ghost');
    el.querySelector('#btnSearchName').classList.add('ghost');
    mainBlist.innerHTML = '';
  };

  el.querySelector('#cancelSearchBtn').onclick = () => {
    searchPanel.style.display = 'none';
    el.querySelector('#btnSearchName').classList.add('ghost');
    el.querySelector('#btnSearchCode').classList.add('ghost');
    renderHome(el);
  };

  const doNameSearch = () => {
    const q = fz(inputName.value.trim());
    if (!q) return;
    const words = q.split(' ').filter(Boolean);
    const m = st.S.filter(s => 
      !st.paid.has(key(s)) && 
      s.inRoute &&
      words.every(w => fz(s.name || '').includes(w))
    );
    
    const grouped = {};
    m.forEach(s => (grouped[s.bld] = grouped[s.bld] || []).push(s));

    let resHtml = '';
    if (!m.length) {
      resHtml = '<div class="empty">لا نتائج مطابقة.</div>';
    } else {
      Object.keys(grouped).sort(srt).forEach(b => {
        const x = tot(grouped[b]);
        const a = grouped[b][0];
        resHtml += `<div class="brow prow" data-bld="${b}" data-sec="${a.sector}" data-blk="${a.blk}" role="button" tabindex="0">
          <b>عمارة ${b} (قطاع ${a.sector} · بلوك ${a.blk})</b>
          <span>${grouped[b].slice(0,3).map(s => esc(s.name)).join('، ')}${grouped[b].length > 3 ? '...' : ''}</span>
          <strong>${money(x.value)}</strong>
        </div>`;
      });
    }
    mainBlist.innerHTML = resHtml;
    bindSearchResultClicks();
  };

  const doCodeSearch = () => {
    const sec = el.querySelector('#mSec').value.trim();
    const blk = el.querySelector('#mBlk').value.trim();
    const bld = el.querySelector('#mBld').value.trim();
    if (!sec || !blk || !bld) { alert('أدخل القطاع والبلوك والعمارة'); return; }
    st.sector = sec;
    st.blk = blk;
    st.open = bld;
    renderHome(el);
  };

  el.querySelector('#mainSearchBtnName').onclick = doNameSearch;
  el.querySelector('#mainSearchBtnCode').onclick = doCodeSearch;

  const bindSearchResultClicks = () => {
    mainBlist.querySelectorAll('[data-bld]').forEach(btn => {
      btn.onclick = () => {
        st.sector = btn.dataset.sec;
        st.blk = btn.dataset.blk;
        st.open = btn.dataset.bld;
        renderHome(el);
      };
    });
  };

  if (!ov) {
    el.querySelector('#sSec').onchange = e => { st.sector = e.target.value; st.open = null; renderHome(el); };
    el.querySelector('#sBlk').onchange = e => { st.blk = e.target.value; st.open = null; renderHome(el); };
    el.querySelector('#sBld').onchange = e => { st.open = e.target.value; st.bld = e.target.value; renderHome(el); };
    el.querySelector('#modeList').onclick = () => { st.open = null; renderHome(el); };
    el.querySelector('#bldIn').addEventListener('input', (e) => {
      if (e.target.value.length === 2) { st.open = e.target.value; st.bld = e.target.value; renderHome(el); }
    });
    el.querySelectorAll('[data-b]').forEach(btn => {
      btn.onclick = () => { st.sel.clear(); st.open = btn.dataset.b; st.bld = st.open; renderHome(el); };
    });
  } else {
    el.querySelectorAll('[data-nav]').forEach(btn => {
      btn.onclick = () => {
        const dir = btn.dataset.nav;
        const sortedBlds = Object.keys(g).sort((a,b) => Number(a) - Number(b));
        const currentIdx = sortedBlds.indexOf(st.open);
        let target = null;
        if (dir === 'prev' && currentIdx > 0) target = sortedBlds[currentIdx - 1];
        if (dir === 'next' && currentIdx < sortedBlds.length - 1) target = sortedBlds[currentIdx + 1];
        if (target) { st.open = target; st.bld = target; renderHome(el); }
      };
    });
    const selectAllCb = el.querySelector('#selectAllApts');
    if (selectAllCb && ov) {
      selectAllCb.onchange = (e) => {
        if (e.target.checked) ov.a.forEach(s => st.sel.add(key(s)));
        else st.sel.clear();
        renderHome(el);
      };
    }
    if (ov) bind(el, ov.a, ov.v, () => renderHome(el));
  }

  scrollTo(0, y);
}

/* ===== صفحة ما تم تحصيله ===== */
export async function renderLedger(el, reload, exp){
  await refresh();
  const e = await list();
  const td = e.filter(x => ldate(x.time) === ldate(new Date()));
  const sum = td.reduce((s,x) => s + x.amount, 0);
  const tagFor = x => {
    const arr = [];
    if (x.personal) arr.push('<span class="tag personal">شخصي</span>');
    if (x.partial) arr.push('<span class="tag partial">جزئي</span>');
    if (x.type === 'advance') arr.push('<span class="tag advance">مقدم</span>');
    if (x.out) arr.push('<span class="tag out">خارج خط سيري</span>');
    if (x.other) arr.push('<span class="tag other">من مصدر آخر</span>');
    return arr.join('');
  };
  el.innerHTML = `<div class="card"><h2>اليوم: ${td.length} عملية · ${money(sum)} جنيه</h2></div>
  <div class="ledger-list">` +
    (e.map(x => {
      const s = st.by.get(x.key) || {};
      const tags = tagFor(x);
      return `<div class="led-row">
        <div class="led-main">
          <span class="led-apt">${s.apt || '?'}</span>
          <div class="led-info">
            <div class="led-name">${esc(s.name || 'بدون اسم')}</div>
            <div class="led-meta">قطاع ${s.sector||''} · بلوك ${s.blk||''} · عمارة ${s.bld||''} · ${new Date(x.time).toLocaleString('ar-EG',{dateStyle:'short',timeStyle:'short'})}</div>
          </div>
          <div class="led-right">
            <div class="led-tags">${tags}</div>
            <div class="led-amount">${money(x.amount)}</div>
          </div>
          <div class="led-menu-wrap">
            <button class="menu-dots" data-m="${x.id}" type="button" aria-label="خيارات">⋮</button>
            <div class="menu-pop" data-pop="${x.id}" hidden>
              ${canUndo(x)?`<button data-act="undo" data-id="${x.id}" type="button">تراجع</button>`:''}
              <button data-act="print" data-id="${x.id}" type="button">إعادة طباعة</button>
              ${(s.value||0) === 0 ? `<button data-act="advance" data-id="${x.id}" type="button">سداد مقدم</button>` : ''}
            </div>
          </div>
        </div>
      </div>`;
    }).join('') || '<p class="mute">لا توجد تحصيلات بعد.</p>') +
  `</div>
  <div class="card">
    <div class="actions">
      <button class="btn" id="ex" type="button">إرسال الأرشيف</button>
      <button class="btn ghost" id="rl" type="button">تحديث الملف</button>
    </div>
  </div>`;

  el.querySelectorAll('[data-m]').forEach(btn => {
    btn.onclick = ev => {
      ev.stopPropagation();
      el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
      const pop = el.querySelector(`[data-pop="${btn.dataset.m}"]`);
      if (pop) pop.hidden = !pop.hidden;
    };
  });
  document.addEventListener('click', () => { el.querySelectorAll('[data-pop]').forEach(p => p.hidden = true); });
  el.querySelectorAll('[data-act]').forEach(b => {
    b.onclick = async ev => {
      ev.stopPropagation();
      const id = b.dataset.id;
      const entry = e.find(x => x.id === id);
      if (!entry) return;
      const act = b.dataset.act;
      if (act === 'undo'){
        if (confirm('التراجع عن هذه العملية؟')){
          await undo(entry);
          renderLedger(el, reload, exp);
        }
      }
      if (act === 'print'){
        await put('ledger', entry.id, { ...entry, printed: true });
        const s = st.by.get(entry.key) || {};
        const q = new URLSearchParams({
          n: s.name||'', s: s.sector||'', b: s.blk||'', d: s.bld||'', a: s.apt||'',
          v: s.value||0, r: st.adv.get(entry.key)||0, q: entry.due||s.value||0,
          c: s.count||0, m: st.cycle, u: st.who, k: entry.key
        }).toString();
        openPage('print.html', q + '&reprint=1');
      }
      if (act === 'advance'){
        const s = st.by.get(entry.key);
        if (!s) return;
        if ((s.value||0) > 0){ toast('لا يمكن السداد المقدم لعميل ما زال عليه مديونية'); return; }
        const x = num(prompt('مبلغ السداد المقدم'));
        if (x > 0){
          await addAdvance(st.no, s, x);
          await refresh();
          toast(`سُجّل مقدم ${money(x)} جنيه`);
          renderLedger(el, reload, exp);
        }
      }
    };
  });
  el.querySelector('#rl').onclick = reload;
  el.querySelector('#ex').onclick = exp;
}

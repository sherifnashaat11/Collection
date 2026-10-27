import {st, esc, refresh} from './browse.js';
import {keyOf as key, pay} from './ledger.js';
import {searchKey} from '../core/normalize.js';
import {money} from '../core/utils.js';

let q = '';
let scope = 'route';

const fz = s => searchKey(s).replace(/[خج]/g, 'ح').replace(/ذ/g, 'د');

const num2Input = (id, nextId, placeholder = '') =>
  `<input id="${id}" class="num2" type="text" inputmode="numeric" maxlength="2" pattern="[0-9]*" placeholder="${placeholder}" ${nextId ? `data-next="${nextId}"` : ''}>`;

export async function renderSearch(el, forceAll = false, fromHome = false){
  document.getElementById('back').hidden = true;
  await refresh();
  if (forceAll) {
    scope = 'all';
  }

  el.innerHTML = `
    ${fromHome ? `
    <div style="margin: 10px 0;">
      <button class="btn ghost" id="btnBackHome" style="width: 100%; font-size: 14px;">⏪ العودة لصفحة التحصيل</button>
    </div>
    ` : ''}
    <div class="card" id="searchBarCard">
      <div style="display:flex; gap:10px; margin-bottom: 1rem; justify-content: center;">
        <button class="btn" id="btnModeName" style="flex:1; font-size:0.9rem;">بحث بالاسم</button>
        <button class="btn ghost" id="btnModeCode" style="flex:1; font-size:0.9rem;">بحث برقم المشترك</button>
      </div>

      <div id="searchNameWrap" style="display:block;">
        <input id="q" class="srch" placeholder="اكتب اسم العميل…" value="${esc(q)}" autocomplete="off">
        ${!forceAll ? `
        <div class="tools" style="margin-top: 0.8rem; justify-content: center;">
          <label class="chk"><input type="radio" name="scName" value="route" ${scope === 'route' ? 'checked' : ''}> خط سيري فقط</label>
          <label class="chk"><input type="radio" name="scName" value="all" ${scope === 'all' ? 'checked' : ''}> الملف كاملاً</label>
        </div>
        ` : ''}
      </div>
      
      <div id="searchCodeWrap" style="display:none;">
        <div class="pick" style="grid-template-columns:1fr 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
          <label class="field"><span>القطاع</span>${num2Input('sSec', 'sBlk', '—')}</label>
          <label class="field"><span>البلوك</span>${num2Input('sBlk', 'sBld', '—')}</label>
          <label class="field"><span>العمارة</span>${num2Input('sBld', 'sApt', '—')}</label>
          <label class="field"><span>الشقة (اختياري)</span>${num2Input('sApt', '', '—')}</label>
        </div>
        <button class="btn" id="searchCodeBtn" type="button" style="width: 100%;">بحث برقم المشترك</button>
      </div>
    </div>
    
    <div id="sr" class="blist"></div>
    <div id="buildingWrapper"></div>
  `;

  const searchBarCard = el.querySelector('#searchBarCard');
  const searchNameWrap = el.querySelector('#searchNameWrap');
  const searchCodeWrap = el.querySelector('#searchCodeWrap');
  const resultsDiv = el.querySelector('#sr');
  const buildingWrapper = el.querySelector('#buildingWrapper');
  const btnModeName = el.querySelector('#btnModeName');
  const btnModeCode = el.querySelector('#btnModeCode');
  const inputQ = el.querySelector('#q');

  const toggleMode = (mode) => {
    if (mode === 'code') {
      btnModeCode.classList.remove('ghost');
      btnModeName.classList.add('ghost');
      searchNameWrap.style.display = 'none';
      searchCodeWrap.style.display = 'block';
      setTimeout(() => el.querySelector('#sSec').focus(), 50);
    } else {
      btnModeName.classList.remove('ghost');
      btnModeCode.classList.add('ghost');
      searchNameWrap.style.display = 'block';
      searchCodeWrap.style.display = 'none';
      setTimeout(() => inputQ.focus(), 50);
    }
    resultsDiv.innerHTML = '';
  };

  btnModeName.onclick = () => toggleMode('name');
  btnModeCode.onclick = () => toggleMode('code');

  const wireAutoNext = (scopeEl) => {
    scopeEl.querySelectorAll('[data-next]').forEach(inp => {
      inp.addEventListener('input', () => {
        const v = String(inp.value || '').replace(/\D/g, '').slice(0, 2);
        if (inp.value !== v) inp.value = v;
        if (v.length === 2) {
          const next = scopeEl.querySelector('#' + inp.dataset.next);
          if (next) {
            next.focus();
            next.select?.();
          }
        }
      });
    });
  };

  const resetView = () => {
    searchBarCard.style.display = 'block';
    resultsDiv.style.display = 'block';
    buildingWrapper.innerHTML = '';
  };

  // نسخة محلية من دالة التصميم (لأنها غير مصدرة)
  const aptsViewLocal = (a) => {
    const ch = a.filter(s => st.sel.has(key(s)));
    const ct = a.reduce((t, s) => {
      if (st.sel.has(key(s))) {
        const adv = st.adv.get(key(s)) || 0;
        t.value += Math.max(0, s.value - adv);
        t.count += s.count;
      }
      return t;
    }, {value: 0, count: 0});
    const allTot = a.reduce((t, s) => t + s.value, 0);

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
          <button class="apt-val-btn" data-p="${k}" type="button">${money(Math.max(0, s.value - b))}</button>
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
        <div class="building-bottom-card" style="background: var(--card); border-top: 2px solid var(--line); padding: 12px; margin-top: 10px; border-radius: 0 0 var(--r-lg) var(--r-lg);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; color: var(--ink);">
            <span>إجمالي العمارة:</span>
            <b>${money(allTot)} ج</b>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; color: var(--ember); font-weight: 800;">
            <span>المحدد (${ch.length} شقة · ${ct.count} فاتورة):</span>
            <b>${money(ct.value)} ج</b>
          </div>
          <button class="btn" id="paySearch" style="width: 100%; background: var(--ok); color: #fff;">
            سداد المحدد (${money(ct.value)} ج)
          </button>
        </div>
      `;
    }

    return {html: cards, ch, ct, barHtml};
  };

  // عرض العمارة داخل صفحة البحث
  const openBuildingInsideSearch = (sec, blk, bld, aptToSelect) => {
    searchBarCard.style.display = 'none';
    resultsDiv.style.display = 'none';
    buildingWrapper.innerHTML = '';

    const allApts = st.S.filter(s => 
      String(s.sector) === sec && 
      String(s.blk) === blk && 
      String(s.bld) === bld &&
      !st.paid.has(key(s))
    ).sort((a,b) => Number(a.apt) - Number(b.apt));

    if (!allApts.length) {
      alert('هذه العمارة مسددة بالكامل.');
      resetView();
      return;
    }

    if (aptToSelect) {
      st.sel.clear();
      const target = allApts.find(s => String(s.apt) === aptToSelect);
      if (target) st.sel.add(key(target));
    }

    const v = aptsViewLocal(allApts);
    const allTotalValue = allApts.reduce((t,s) => t + s.value, 0);

    buildingWrapper.innerHTML = `
      <div style="margin-bottom: 10px;">
        <button class="btn ghost sm" id="btnBackToSearch" style="width: 100%;">⏪ رجوع للبحث</button>
      </div>
      <div class="card" style="padding: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h2 style="margin: 0; font-size: 16px; display: flex; align-items: center; gap: 8px;">
            عمارة ${bld} 
            <span style="font-size: 16px; color: var(--ember); font-weight: 800;">(${money(allTotalValue)} ج)</span>
          </h2>
          <label class="chk">
            <input type="checkbox" id="selectAllSearch" ${allApts.length > 0 && allApts.every(s => st.sel.has(key(s))) ? 'checked' : ''}> 
            تحديد الكل
          </label>
        </div>
        ${v.html}
        ${v.barHtml}
      </div>
    `;

    el.querySelector('#btnBackToSearch').onclick = () => {
      st.sel.clear();
      resetView();
      if (q) drawNameSearch();
    };

    const selectAllCb = el.querySelector('#selectAllSearch');
    if (selectAllCb) {
      selectAllCb.onchange = (e) => {
        if (e.target.checked) {
          allApts.forEach(s => st.sel.add(key(s)));
        } else {
          st.sel.clear();
        }
        openBuildingInsideSearch(sec, blk, bld, aptToSelect);
      };
    }

    // ربط أحداث الشقق
    buildingWrapper.querySelectorAll('[data-k]').forEach(c => {
      c.onchange = () => { 
        c.checked ? st.sel.add(c.dataset.k) : st.sel.delete(c.dataset.k); 
        openBuildingInsideSearch(sec, blk, bld, aptToSelect); 
      };
    });

    buildingWrapper.querySelectorAll('[data-nm]').forEach(nm => {
      nm.onclick = (ev) => {
        ev.stopPropagation();
        const k = nm.dataset.nm;
        if (st.sel.has(k)) st.sel.delete(k); else st.sel.add(k);
        openBuildingInsideSearch(sec, blk, bld, aptToSelect);
      };
    });

    buildingWrapper.querySelectorAll('[data-m]').forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        buildingWrapper.querySelectorAll('[data-pop]').forEach(p => p.hidden = true);
        const pop = buildingWrapper.querySelector(`[data-pop="${btn.dataset.m}"]`);
        if (pop) pop.hidden = !pop.hidden;
      };
    });
    document.addEventListener('click', () => { buildingWrapper.querySelectorAll('[data-pop]').forEach(p => p.hidden = true); });

    buildingWrapper.querySelectorAll('[data-p]').forEach(btn => {
      btn.onclick = async (ev) => {
        ev.stopPropagation();
        const k = btn.dataset.p;
        const s = st.S.find(item => key(item) === k);
        if (!s) return;
        const advAmount = st.adv.get(k) || 0;
        const amt = Math.max(0, s.value - advAmount);
        if (!amt) { alert('لا يوجد مبلغ مستحق'); return; }
        if (!confirm(`تأكيد سداد شقة ${s.apt} — ${s.name || 'بدون اسم'} بمبلغ ${money(amt)} جنيه؟`)) return;
        
        await pay(st.no, [s], st.adv);
        st.sel.delete(k);
        await refresh();
        openBuildingInsideSearch(sec, blk, bld, aptToSelect);
      };
    });

    const payBtn = el.querySelector('#paySearch');
    if (payBtn) {
      payBtn.onclick = async () => {
        const subs = Array.from(st.sel).map(k => st.S.find(item => key(item) === k)).filter(Boolean);
        if (!subs.length) return;
        if (!confirm(`تأكيد سداد ${subs.length} شقة بمبلغ ${money(v.ct.value)} جنيه؟`)) return;
        
        await pay(st.no, subs, st.adv);
        st.sel.clear();
        await refresh();
        openBuildingInsideSearch(sec, blk, bld, aptToSelect);
      };
    }
  };

  // البحث بالاسم
  const drawNameSearch = () => {
    const ws = fz(q).split(' ').filter(Boolean);
    if (!ws.length) { resultsDiv.innerHTML = ''; return; }
    
    const m = st.S.filter(s => 
      !st.paid.has(key(s)) && 
      (scope === 'all' || s.inRoute) && 
      ws.every(w => fz(s.name || '').includes(w))
    );
    
    const g = {};
    m.forEach(s => (g[`${s.sector}|${s.blk}|${s.bld}`] ??= []).push(s));
    
    resultsDiv.innerHTML = Object.entries(g).slice(0, 40).map(([k, a]) => {
      const [x, b, d] = k.split('|');
      return `<button class="brow srow" data-g="${k}">
        <b>قطاع ${x} · بلوك ${b} · عمارة ${d}</b>
        <span>${a.slice(0, 3).map(s => esc(s.name)).join('، ')}${a.length > 3 ? ` +${a.length - 3}` : ''}</span>
        <span>${a[0].inRoute ? '' : '<em class="tag">خارج خط سيري</em>'}</span>
        <strong>${money(a.reduce((t, s) => t + s.value, 0))}</strong>
      </button>`;
    }).join('') || '<div class="card empty">لا نتائج.</div>';

    resultsDiv.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
      const [x, bl, d] = b.dataset.g.split('|');
      st.sector = x; st.blk = bl; st.bld = d; st.all = (scope === 'all');
      openBuildingInsideSearch(x, bl, d, null);
    });
  };

  // البحث برقم المشترك
  const drawCodeSearch = () => {
    const sec = String(el.querySelector('#sSec').value || '').trim();
    const blk = String(el.querySelector('#sBlk').value || '').trim();
    const bld = String(el.querySelector('#sBld').value || '').trim();
    const apt = String(el.querySelector('#sApt').value || '').trim();

    if (!sec || !blk || !bld) {
      alert('يرجى إدخال القطاع والبلوك والعمارة على الأقل.');
      return;
    }

    st.sector = sec;
    st.blk = blk;
    st.bld = bld;
    openBuildingInsideSearch(sec, blk, bld, apt || null);
  };

  inputQ.oninput = e => { q = e.target.value; drawNameSearch(); };
  el.querySelector('#searchCodeBtn').onclick = drawCodeSearch;

  el.querySelectorAll('[name=scName]').forEach(r => {
    r.onchange = () => {
      scope = r.value;
      drawNameSearch();
    };
  });

  wireAutoNext(el);
  
  if (fromHome) {
    const backHomeBtn = el.querySelector('#btnBackHome');
    if (backHomeBtn) {
      backHomeBtn.onclick = () => {
        st.sel.clear();
        document.querySelector('#tabs button[data-t="home"]').click();
      };
    }
  }

  if (q) drawNameSearch();
}
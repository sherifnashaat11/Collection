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
  await refresh();
  if (forceAll) {
    scope = 'all';
  }

  el.innerHTML = `
    ${fromHome ? `
    <div style="margin: 10px 0;">
      <button class="btn ghost" id="btnBackHome" style="width: 100%; font-size: 14px;">⏪ العودة للتحصيل</button>
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
    }).join('') || '<div class="empty">لا نتائج.</div>';

    resultsDiv.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
      const [x, bl, d] = b.dataset.g.split('|');
      st.sector = x; st.blk = bl; st.bld = d; st.all = (scope === 'all');
      openBuildingInsideSearch(x, bl, d, null);
    });
  };

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

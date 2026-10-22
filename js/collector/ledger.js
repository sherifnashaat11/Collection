import {put,del,all,putMany,get} from '../core/db.js';
import {uid} from '../core/utils.js';

export const keyOf = s => [s.cat,s.sector,s.blk,s.bld,s.apt].join('|');
export const ldate = d => new Date(d).toLocaleDateString('en-CA');


export const canUndo = (e) => {
  // 1. التأكد أن العملية تمت اليوم (لا تراجع عن أيام سابقة)
  if (ldate(e.time) !== ldate(new Date())) return false;

  // 2. التأكد أن الفاتورة لم تُطبع (إذا كانت هناك علامة طباعة)
  if (e.printed) return false;

  // 3. التأكد أننا لم ننتقل لعمارة أخرى
  try {
    const lastPosStr = localStorage.getItem('lastPosition');
    if (lastPosStr) {
      const lastPos = JSON.parse(lastPosStr);
      const lastKey = `${lastPos.sector}|${lastPos.blk}|${lastPos.bld}`;
      const parts = e.key.split('|');
      const opKey = `${parts[1]}|${parts[2]}|${parts[3]}`;
      if (lastKey !== opKey) return false;
    }
  } catch (err) {
    console.warn('Error reading lastPosition', err);
  }

  // 4. التأكد من عدم وجود تحديث ملف جديد (إذا كانت العملية قبل التحديث)
  if (window.st && window.st.cycle) {
    const cycleDate = new Date(window.st.cycle);
    if (new Date(e.time) < cycleDate) return false;
  }

  return true;
};










export const list = async () => (await all('ledger')).sort((a,b) => a.time < b.time ? 1 : -1);

export async function pay(no, subs, adv){
  const time = new Date().toISOString(), L = [], A = [], U = [];
  const entries = [];
  for (const s of subs){
    const k = keyOf(s), b = adv.get(k) || 0, use = Math.min(b, s.value), id = uid(no);
    const entry = {id, no, type:'pay', key:k, amount:s.value - use, due:s.value, fromAdvance:use, out:!s.inRoute, count:s.count, time, status:'temp'};
    entries.push(entry);
    L.push([id, entry]);
    if (use) A.push([k, {key:k, balance:b - use}]);
    U.push([k, {...s, value:0, count:0}]);
  }
  await putMany('ledger', L);
  if (A.length) await putMany('advance', A);
  await putMany('subscribers', U);
  return entries; // <--- إرجاع العمليات
}

export async function partialPay(no, s, {count, amount}, adv){
  const k = keyOf(s);
  const b = adv.get(k) || 0;
  const useAdv = Math.min(b, amount);
  const id = uid(no);
  const time = new Date().toISOString();
  
  await put('ledger', id, {
    id, no, type:'pay', key:k,
    amount: amount - useAdv,
    due: amount,
    fromAdvance: useAdv,
    out: !s.inRoute,
    count: count,
    time, status:'temp',
    partial: true
  });
  
  if (useAdv){
    await put('advance', k, {key:k, balance: b - useAdv});
  }
  
  const newCount = Math.max(0, (s.count || 0) - count);
  const newValue = Math.max(0, (s.value || 0) - amount);
  await put('subscribers', k, {
    ...s,
    count: newCount,
    value: newValue
  });
  
  return {newCount, newValue};
}

/* ====== السداد الشخصي: سداد كامل المديونية ====== */
export async function personalSettle(no, s, adv){
  const k = keyOf(s);
  const b = adv.get(k) || 0;
  const amt = s.value || 0;
  const useAdv = Math.min(b, amt);
  const id = uid(no);
  const time = new Date().toISOString();
  
  await put('ledger', id, {
    id, no, type:'pay', key:k,
    amount: amt - useAdv,
    due: amt,
    fromAdvance: useAdv,
    out: !s.inRoute,
    count: s.count || 0,
    time, status:'temp',
    personal: true
  });
  
  if (useAdv){
    await put('advance', k, {key:k, balance: b - useAdv});
  }
  
  await put('subscribers', k, {...s, value:0, count:0});
  
  return {amount: amt};
}

export async function addAdvance(no, s, amt){
  const k = keyOf(s), id = uid(no), b = (await get('advance', k))?.balance || 0;
  await put('ledger', id, {id, no, type:'advance', key:k, amount:amt, count:0, time:new Date().toISOString(), status:'temp'});
  await put('advance', k, {key:k, balance:b + amt});
}

export async function undo(e){
  await del('ledger', e.id);
  const b = (await get('advance', e.key))?.balance || 0;
  if (e.type === 'pay' && e.fromAdvance) await put('advance', e.key, {key:e.key, balance:b + e.fromAdvance});
  if (e.type === 'advance') await put('advance', e.key, {key:e.key, balance:Math.max(0, b - e.amount)});
  
  if (e.type === 'pay' && (e.partial || e.personal)){
    const s = await get('subscribers', e.key);
    if (s){
      await put('subscribers', e.key, {
        ...s,
        count: (s.count || 0) + (e.count || 0),
        value: (s.value || 0) + (e.due || 0)
      });
    }
  }
}
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const KEY = 'fuellog.v1', SKEY = 'fuellog.settings.v1';
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { toast('Could not save: storage full or blocked'); } };

  let entries = load(KEY, []);
  const CKEY = 'fuellog.costs.v1';
  let costs = load(CKEY, []); // other car costs: { id, vehicleId, date, cat, amount, odo, note, done: [reminder ids] }
  let settings = Object.assign({ unit: 'kmpl', period: 'all', theme: 'auto' }, load(SKEY, {}));
  const saveSettings = () => save(SKEY, settings);

  /* ---------- language: English or Bahasa Melayu ----------
     The app is written in English. In Malay mode every piece of text the app puts on screen is translated as it appears:
     exact phrases first, then patterns for text with numbers and dates in it. Dates use the Malay locale directly. */
  const LANG = settings.lang || (/^ms\b/i.test(navigator.language || '') ? 'ms' : 'en');
  const LOC = LANG === 'ms' ? 'ms-MY' : 'en-MY';
  document.documentElement.lang = LANG;
  const { MS, RULES, tw } = window.FUEL_LOG_MS;
  function trMS(str) {
    const core = str.trim(); if (!core || !/[A-Za-z]/.test(core)) return str;
    let out = MS[core];
    if (out == null) {
      const icon = core.match(/^([^A-Za-z\d(+]+ )(.+)$/u); // "🔧 Service"
      if (icon && MS[icon[2]] != null) out = icon[1] + MS[icon[2]];
      else if (/^[A-Za-z' ]+(, [A-Za-z' ]+)+$/.test(core) && core.split(', ').every(w => MS[w] != null)) out = core.split(', ').map(tw).join(', ');
      else { out = core; for (const [re, to] of RULES) out = out.replace(re, to); }
    }
    return out === core ? str : str.replace(core, () => out);
  }
  const T = t => LANG === 'ms' ? trMS(String(t)) : t;
  const L2 = (en, ms) => LANG === 'ms' ? ms : en; // for new sentences written in both languages directly
  if (LANG === 'ms') {
    const ATTRS = ['placeholder', 'aria-label', 'title'];
    const skip = n => n.parentElement?.closest('script, style, [lang="en"], [translate="no"]');
    const doText = n => { if (skip(n)) return; const t = trMS(n.data); if (t !== n.data) n.data = t; };
    const doEl = el => ATTRS.forEach(a => { const v = el.getAttribute?.(a); if (v) { const t = trMS(v); if (t !== v) el.setAttribute(a, t); } });
    const walk = root => {
      if (root.nodeType === 3) return doText(root);
      if (root.nodeType !== 1) return;
      doEl(root); root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(doEl);
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); while (w.nextNode()) doText(w.currentNode);
    };
    walk(document.body);
    new MutationObserver(ms => ms.forEach(m => {
      if (m.type === 'characterData') doText(m.target);
      else if (m.type === 'attributes') doEl(m.target);
      else m.addedNodes.forEach(walk);
    })).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    const ask = window.confirm.bind(window); window.confirm = m => ask(T(m));
  }
  // BUDI95 (Malaysia): RON95 at RM1.99/L up to a monthly quota per person (300 L since 1 Sep 2026; e-hailing 800 L).
  settings.budi = Object.assign({ on: true, quota: 300, price: 1.99, market: 3.87 }, settings.budi || {});
  const newVehicle = (name, extra = {}) => ({ id: 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, tank: '', budget: '', lastType: 'RON95', lastStation: '', ...extra });
  // Older versions had one vehicle with settings at the top level: turn that into the first vehicle.
  if (!Array.isArray(settings.vehicles) || !settings.vehicles.length) {
    const v = newVehicle('My car', { tank: settings.tank || '', lastType: settings.lastType || 'RON95', lastStation: settings.lastStation || '' });
    settings.vehicles = [v]; settings.current = v.id;
  }
  delete settings.tank; delete settings.lastType; delete settings.lastStation;
  if (!settings.vehicles.some(v => v.id === settings.current)) settings.current = settings.vehicles[0].id;
  const veh = () => settings.vehicles.find(v => v.id === settings.current);
  const mine = () => entries.filter(x => x.vehicleId === settings.current);
  function adoptOrphans() { // entries without a known vehicle go to the current one
    let changed = false;
    entries.forEach(x => { if (!settings.vehicles.some(v => v.id === x.vehicleId)) { x.vehicleId = settings.current; changed = true; } });
    if (changed) save(KEY, entries);
  }
  adoptOrphans(); saveSettings();
  let pendingThumb = null;

  const rm = n => 'RM ' + (n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (n, d = 1) => (n == null || !isFinite(n)) ? '–' : n.toLocaleString('en-MY', { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtDate = s => new Date(s + 'T00:00').toLocaleDateString(LOC, { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtDay = s => new Date(s + 'T00:00').toLocaleDateString(LOC, { weekday: 'short', day: 'numeric', month: 'short' });
  const localISO = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const today = () => localISO(new Date());
  const daysAgo = s => { const n = Math.round((new Date(today() + 'T00:00') - new Date(s + 'T00:00')) / 864e5); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'; };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = (msg, label, fn) => {
    const t = $('#toast'); t.textContent = msg; t.classList.toggle('action', !!label);
    if (label) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { t.classList.remove('show', 'action'); fn(); }; t.append(b); }
    t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show', 'action'), label ? 6000 : 2200);
  };

  /* ---------- receipt photo store (IndexedDB) ---------- */
  const idb = (() => {
    let p;
    const open = () => p ??= new Promise((res, rej) => {
      const r = indexedDB.open('fuellog', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('receipts');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
      const t = db.transaction('receipts', mode), r = fn(t.objectStore('receipts'));
      t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error);
    }));
    return {
      get: id => tx('readonly', s => s.get(id)), keys: () => tx('readonly', s => s.getAllKeys()),
      put: (id, v) => tx('readwrite', s => s.put(v, id)), del: id => tx('readwrite', s => s.delete(id)), clear: () => tx('readwrite', s => s.clear())
    };
  })();
  async function tidyPhotos() {
    try {
      let moved = false;
      for (const x of entries) if (x.thumb) { await idb.put(x.id, x.thumb); delete x.thumb; x.hasReceipt = true; moved = true; }
      if (moved) save(KEY, entries);
      const ids = new Set(entries.map(x => x.id));
      for (const k of await idb.keys()) if (!ids.has(k)) await idb.del(k);
    } catch (e) { console.warn('photo store unavailable', e); }
  }
  navigator.storage?.persist?.().catch(() => {});
  async function showReceipt(src, title) {
    if (!src) { toast('Receipt photo not found'); return; }
    $('#receiptDlgImg').src = src; $('#receiptDlgTitle').textContent = title; $('#receiptDlg').showModal();
  }
  const dlg = $('#receiptDlg');
  $('#receiptDlgClose').onclick = () => dlg.close();
  dlg.onclick = e => { if (e.target === dlg) dlg.close(); };

  /* ---------- navigation ---------- */
  let view = 'home';
  function go(v, push = true) {
    if (v === view && push) return;
    view = v;
    ['home', 'history', 'add', 'settings'].forEach(n => $('#view-' + n).hidden = n !== v);
    $$('.bottom .nav').forEach(b => b.dataset.go === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
    document.body.classList.toggle('sub', v === 'add' || v === 'settings');
    const sub = v === 'add' || v === 'settings';
    $('#backBtn').hidden = !sub; $('#gearBtn').hidden = sub; $('#themeBtn').hidden = sub;
    renderTitle();
    if (v === 'home') renderHome();
    if (v === 'history') renderHistory();
    if (v === 'settings') renderSettings();
    if (push) history.pushState({ v, d: ++depth }, '');
    window.scrollTo(0, 0);
  }
  function renderTitle() {
    const multi = settings.vehicles.length > 1;
    $('#topTitle').innerHTML = view === 'add' ? ($('#f-id').value ? 'Edit fill-up' : 'Isi minyak' + (multi ? ` <small class="sub">· ${esc(veh().name)}</small>` : ''))
      : view === 'settings' ? 'Settings'
      : multi ? `<button class="vehbtn" id="vehBtn" aria-haspopup="dialog"><img src="icons/icon-192.png" alt="">${esc(veh().name)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>`
      : '<img src="icons/icon-192.png" alt="">Fuel Log';
  }
  function switchVehicle(id) {
    settings.current = id; saveSettings(); resetForm(); $('#savedNote').hidden = true;
    renderTitle(); if (view === 'home') renderHome(); if (view === 'history') renderHistory(); if (view === 'settings') renderSettings();
  }
  const vehDlg = $('#vehDlg');
  document.addEventListener('click', e => {
    if (e.target.closest('#vehBtn')) {
      $('#vehList').innerHTML = settings.vehicles.map(v => {
        const n = entries.filter(x => x.vehicleId === v.id).length;
        return `<button type="button" data-veh="${v.id}" aria-pressed="${v.id === settings.current}"><b>${esc(v.name)}</b><span>${n} fill-up${n === 1 ? '' : 's'}</span></button>`;
      }).join('');
      vehDlg.showModal();
    }
    const vb = e.target.closest('[data-veh]');
    if (vb) { vehDlg.close(); switchVehicle(vb.dataset.veh); }
  });
  vehDlg.onclick = e => { if (e.target === vehDlg) vehDlg.close(); };
  $('#vehManage').onclick = () => { vehDlg.close(); go('settings'); };
  // depth = how many screens this page has pushed, so Back never jumps to a stale entry from before a reload
  let depth = 0;
  const back = () => depth > 0 ? history.back() : go('home');
  window.addEventListener('popstate', e => { depth = e.state?.d || 0; go(e.state?.v || 'home', false); });
  history.replaceState({ v: 'home', d: 0 }, '');
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-go]'); if (!b) return;
    if (b.dataset.go === 'add') { resetForm(); $('#savedNote').hidden = true; autoStation(); }
    go(b.dataset.go);
  });
  $('#gearBtn').onclick = () => go('settings');
  $('#backBtn').onclick = () => back();

  /* ---------- fill-up form ---------- */
  const F = id => $('#f-' + id);
  const gauge = { before: null, after: 100 };
  // Gauge readings are stored as a percentage; the picker shows the vehicle's own dashboard marks (8 steps by default).
  const steps = () => +veh().gaugeSteps || 8;
  const toIdx = v => Math.round(v / 100 * steps());
  const tickKind = (i, n) => (i === 0 || i === n || 2 * i === n) ? 'l' : (n % 4 === 0 && (4 * i === n || 4 * i === 3 * n)) ? 'm' : '';
  function buildMeters() {
    const n = steps();
    $$('.meter').forEach(m => {
      m.style.setProperty('--n', n + 1);
      m.innerHTML = Array.from({ length: n + 1 }, (_, i) =>
        `<button type="button" role="radio" data-i="${i}" aria-label="${i === 0 ? 'Empty, 0' : i === n ? 'Full, 1' : `${i} of ${n} marks`}">` +
        `<span class="tk ${tickKind(i, n)}"></span><span class="lb">${i === 0 ? '0' : i === n ? '1' : 2 * i === n ? '½' : ''}</span></button>`).join('');
    });
    setGauge('before', gauge.before); setGauge('after', gauge.after);
  }
  function setGauge(k, v) {
    gauge[k] = v;
    const n = steps(), idx = v == null ? null : toIdx(v);
    $$(`.meter[data-g="${k}"] button`).forEach(b => {
      const i = +b.dataset.i;
      b.classList.toggle('on', idx != null && i <= idx); b.classList.toggle('cur', i === idx); b.setAttribute('aria-checked', i === idx);
    });
    const h = $('#h-' + k);
    h.className = v == null && k === 'before' ? 'warn' : '';
    h.textContent = v == null ? 'Not recorded' : idx === n ? 'Full' : idx === 0 ? 'Empty' : `${idx} of ${n} marks`;
    if (k === 'before') $('#meterHint').hidden = v != null;
  }
  $$('.meter').forEach(m => m.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const k = m.dataset.g, i = +b.dataset.i;
    setGauge(k, gauge[k] != null && toIdx(gauge[k]) === i ? null : Math.round(i / steps() * 1000) / 10); // tap again to clear
  });

  // fill any two of total / litres / price
  let lastEdited = [];
  ['total', 'litres', 'price'].forEach(k => F(k).addEventListener('input', () => {
    lastEdited = [k, ...lastEdited.filter(x => x !== k)].slice(0, 2);
    if (lastEdited.length < 2) return;
    const target = ['total', 'litres', 'price'].find(x => !lastEdited.includes(x));
    const t = +F('total').value, l = +F('litres').value, p = +F('price').value;
    if (target === 'total' && l && p) F('total').value = (l * p).toFixed(2);
    if (target === 'litres' && t && p) F('litres').value = (t / p).toFixed(3);
    if (target === 'price' && t && l) F('price').value = (t / l).toFixed(3);
  }));

  // ---- BUDI95 ----
  const budiPrice = () => +settings.budi.price || 1.99;
  const isBudi = x => x.budi ?? (x.type === 'RON95' && Math.abs(x.price - budiPrice()) < 0.006);
  const budiUsed = (monthKey, exceptId) => entries.filter(x => x.id !== exceptId && x.date.startsWith(monthKey) && isBudi(x)).reduce((a, x) => a + x.litres, 0);
  const budiLeft = (monthKey, exceptId) => Math.max(0, (+settings.budi.quota || 0) - budiUsed(monthKey, exceptId));
  function updateBudiRow() {
    const show = settings.budi.on && F('type').value === 'RON95';
    $('#budiRow').hidden = !show;
    if (!show) return;
    $('#budiPriceLbl').textContent = num(budiPrice(), 2);
    const left = budiLeft((F('date').value || today()).slice(0, 7), F('id').value), l = +F('litres').value || 0, h = $('#budiQuotaHint');
    h.classList.remove('warn');
    if (F('budi').checked && l > left + 0.05) { h.textContent = `Only ${num(left, 1)} L of quota left this month`; h.classList.add('warn'); }
    else h.textContent = `${num(left, 0)} L of ${num(+settings.budi.quota, 0)} L quota left this month`;
  }
  // Ticking BUDI95 fills in the subsidised price; unticking puts in the normal price.
  F('budi').addEventListener('change', () => {
    const p = F('budi').checked ? budiPrice() : +settings.budi.market;
    if (p) { F('price').value = p.toFixed(2); F('price').dispatchEvent(new Event('input', { bubbles: true })); }
    updateBudiRow();
  });
  F('price').addEventListener('input', () => { if (!$('#budiRow').hidden) F('budi').checked = Math.abs(+F('price').value - budiPrice()) < 0.006; updateBudiRow(); });
  ['litres', 'total'].forEach(k => F(k).addEventListener('input', updateBudiRow));
  ['type', 'date'].forEach(k => F(k).addEventListener('change', updateBudiRow));

  const sorted = () => mine().sort((a, b) => a.date.localeCompare(b.date) || a.odo - b.odo);
  const prevOf = (date, id) => sorted().filter(x => x.id !== id && x.date <= date).at(-1);

  function odoHint() {
    const prev = prevOf(F('date').value || today(), F('id').value), v = +F('odo').value, h = $('#odoHint');
    h.classList.remove('warn');
    if (!prev) { h.textContent = ''; return; }
    if (!v) { h.textContent = `Last fill-up: ${num(prev.odo, 0)} km (${daysAgo(prev.date)})`; return; }
    const d = v - prev.odo;
    if (d <= 0) { h.textContent = `Lower than your last fill-up (${num(prev.odo, 0)} km). Check for a typo.`; h.classList.add('warn'); }
    else if (d > 2000) { h.textContent = `+${num(d, 0)} km since last fill-up. That's a lot, check for a typo.`; h.classList.add('warn'); }
    else h.textContent = `+${num(d, 0)} km since your last fill-up`;
  }
  F('odo').addEventListener('input', odoHint);

  const syncTypePills = () => $$('#typePills button').forEach(b => b.setAttribute('aria-checked', b.dataset.v === F('type').value));
  $('#typePills').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    F('type').value = b.dataset.v; F('type').dispatchEvent(new Event('change'));
  };
  function moreSummary() {
    syncTypePills();
    const bits = [F('date').value === today() ? 'Today' : fmtDate(F('date').value), F('type').value];
    if (F('station').value.trim()) bits.push(F('station').value.trim());
    if (F('missed').checked) bits.push('after missed fill-up');
    $('#moreSummary').textContent = '· ' + bits.join(' · ');
  }
  ['date', 'type', 'station', 'missed'].forEach(k => F(k).addEventListener(k === 'station' ? 'input' : 'change', () => { moreSummary(); if (k === 'date') odoHint(); }));

  // Last price paid for a fuel type (any vehicle, since pump prices are the same), newest first.
  const lastPriceOf = type => entries.filter(x => x.type === type && x.price > 0 && !(type === 'RON95' && isBudi(x)))
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.price;
  // Put a sensible RM/litre in for the chosen fuel: BUDI95 price while there's quota, otherwise what you paid last time.
  // This week's pump price from data.gov.my, if we have a recent one
  const officialPrice = type => {
    const pr = settings.prices; if (!pr || daysSince(pr.date) > 21) return null;
    return { RON95: pr.ron95, RON97: pr.ron97, Diesel: pr.diesel }[type] || null;
  };
  function prefillPrice() {
    const type = F('type').value, budiOk = settings.budi.on && type === 'RON95';
    let p = null;
    F('budi').checked = false;
    if (budiOk && budiLeft((F('date').value || today()).slice(0, 7), F('id').value) > 0) { p = budiPrice(); F('budi').checked = true; }
    else if (budiOk && +settings.budi.market) p = +settings.budi.market;
    else p = officialPrice(type) || lastPriceOf(type) || null;
    if (!p) {
      // No price known for this fuel: clear it, and whatever was worked out from the old price.
      if (!F('price').value) return;
      const computed = ['total', 'litres', 'price'].find(x => !lastEdited.includes(x));
      if (lastEdited.length === 2 && computed !== 'price') F(computed).value = '';
      F('price').value = ''; lastEdited = lastEdited.filter(k => k !== 'price');
      return;
    }
    F('price').value = (+p).toFixed(2);
    if (F('total').value || F('litres').value) F('price').dispatchEvent(new Event('input', { bubbles: true }));
    else lastEdited = ['price'];
  }
  F('type').addEventListener('change', () => { if (!F('id').value) prefillPrice(); updateBudiRow(); });

  /* Petrol stations: the full list of Malaysian stations (OpenStreetMap) is loaded from stations.json when first needed.
     Searching and "near me" both run on the phone: your location is never sent anywhere. */
  let stations = null, stationsP = null, here = null;
  const loadStations = () => stationsP ||= fetch('stations.json').then(r => r.json()).then(d => {
    stations = d.stations.map(([lat, lon, brand, name, street, area, town]) => {
      const title = brand || name || town || 'Petrol station';
      const sub = [...new Set([brand ? name : '', street, area, town].filter(Boolean).map(x => x.trim()))]
        .filter((x, i, a) => !a.slice(0, i).some(y => y.toLowerCase() === x.toLowerCase())).join(', ');
      const short = [brand, name || street || area || town].filter(Boolean).join(' ');
      return { lat, lon, title, sub, short, hay: [brand, name, street, area, town].join(' ').toLowerCase() };
    });
    return stations;
  }).catch(e => { stationsP = null; throw e; });
  const distKm = (a, b) => {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(x));
  };
  const fmtKm = d => d < 1 ? Math.round(d * 1000 / 10) * 10 + ' m' : num(d, d < 10 ? 1 : 0) + ' km';
  const getHere = (maxAge = 120000) => new Promise((ok, no) => {
    if (!navigator.geolocation) return no(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(p => { here = { lat: p.coords.latitude, lon: p.coords.longitude, at: Date.now() }; ok(here); }, no,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: maxAge });
  });
  const sugRow = (st, d) => `<button type="button" role="option" data-short="${esc(st.short)}"><b>${esc(st.title)}</b>${d != null ? `<span class="d">${fmtKm(d)}</span>` : ''}<small>${esc(st.sub)}</small></button>`;
  let sugMode = null; // 'near' | 'search' | null
  function showSug(html) { $('#stationSug').innerHTML = html && html.includes('<button') ? html + '<div class="h" style="padding:6px 12px 8px">© OpenStreetMap contributors</div>' : html; }
  function nearList() {
    const list = stations.map(st => [st, distKm(here, st)]).sort((a, b) => a[1] - b[1]).slice(0, 5);
    return `<div class="h">${L2('Nearest to you', 'Paling dekat dengan anda')}</div>` + list.map(([st, d]) => sugRow(st, d)).join('');
  }
  async function searchStations() {
    const q = F('station').value.trim().toLowerCase();
    if (q.length < 2) { if (sugMode === 'search') { sugMode = null; showSug(''); } return; }
    try { await loadStations(); } catch { showSug(`<div class="msg">${L2('Station list not available offline yet. Type the name instead.', 'Senarai stesen belum ada di luar talian. Taip nama stesen.')}</div>`); return; }
    if (F('station').value.trim().toLowerCase() !== q) return; // typed on
    const words = q.split(/\s+/);
    let hits = stations.filter(st => words.every(w => st.hay.includes(w)));
    const withD = hits.map(st => [st, here ? distKm(here, st) : null]);
    if (here) withD.sort((a, b) => a[1] - b[1]);
    sugMode = 'search';
    showSug(withD.length ? withD.slice(0, 6).map(([st, d]) => sugRow(st, d)).join('')
      : `<div class="msg">${L2('No station found. You can keep what you typed.', 'Tiada stesen dijumpai. Anda boleh guna apa yang ditaip.')}</div>`);
  }
  let searchT;
  F('station').addEventListener('input', () => { $('#stationHint').hidden = true; clearTimeout(searchT); searchT = setTimeout(searchStations, 120); });
  F('station').addEventListener('focus', () => loadStations().catch(() => {}));
  $('#stationSug').onclick = e => {
    const b = e.target.closest('button[data-short]'); if (!b) return;
    F('station').value = b.dataset.short; F('station').dispatchEvent(new Event('input')); clearTimeout(searchT);
    sugMode = null; showSug(''); renderStations(); moreSummary();
  };
  $('#nearBtn').onclick = async () => {
    showSug(`<div class="msg">${L2('Finding stations near you…', 'Mencari stesen berdekatan…')}</div>`);
    try {
      await Promise.all([loadStations(), getHere()]);
      sugMode = 'near'; showSug(nearList());
    } catch (e) {
      showSug(`<div class="msg">${e?.code === 1 ? L2('Location is off for this app. Allow it in your browser settings, or search by name.', 'Lokasi dimatikan untuk apl ini. Benarkan dalam tetapan pelayar, atau cari mengikut nama.')
        : L2("Couldn't get your location. Search by name instead.", 'Tidak dapat lokasi anda. Cari mengikut nama.')}</div>`);
    }
  };
  // At the pump: if you've allowed location before, fill in the station you're at (within 300 m).
  async function autoStation() {
    try {
      if (!navigator.permissions || (await navigator.permissions.query({ name: 'geolocation' })).state !== 'granted') return;
      const before = F('station').value;
      const [list, pos] = await Promise.all([loadStations(), getHere(300000)]);
      if (F('id').value || F('station').value !== before) return; // you've changed something meanwhile
      let best = null, bd = 0.3;
      list.forEach(st => { const d = distKm(pos, st); if (d < bd) { bd = d; best = st; } });
      if (!best) return;
      F('station').value = best.short; renderStations(); moreSummary();
      $('#stationHint').textContent = L2('📍 Filled in from your location', '📍 Diisi berdasarkan lokasi anda'); $('#stationHint').hidden = false;
    } catch {}
  }

  // Recent stations as one-tap pills under the station field
  function renderStations() {
    const seen = new Set(), list = [];
    [...entries].sort((a, b) => b.date.localeCompare(a.date)).forEach(x => {
      const n = (x.station || '').trim(), k = n.toLowerCase();
      if (n && !seen.has(k) && list.length < 4) { seen.add(k); list.push(n); }
    });
    const cur = F('station').value.trim().toLowerCase();
    $('#stationPills').innerHTML = list.map(n => `<button type="button" aria-pressed="${n.toLowerCase() === cur}">${esc(n)}</button>`).join('');
    $('#stationPills').hidden = !list.length;
  }
  $('#stationPills').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    F('station').value = b.textContent; F('station').dispatchEvent(new Event('input'));
  };
  F('station').addEventListener('input', renderStations);

  function resetForm() {
    $('#entryForm').reset();
    F('id').value = ''; F('date').value = today(); F('missed').checked = false;
    F('type').value = veh().lastType || 'RON95'; F('station').value = veh().lastStation || '';
    gauge.before = null; gauge.after = 100; buildMeters();
    lastEdited = []; pendingThumb = null;
    // Start with the right price for the fuel, so typing the total is enough.
    prefillPrice();
    updateBudiRow(); renderStations(); showSug(''); sugMode = null; $('#stationHint').hidden = true;
    $('#scanRes').hidden = true; $('#ocrRawWrap').hidden = true; $('#ocrStatus').textContent = ''; $('#scanLabel').textContent = 'Scan receipt';
    $('#delBtn').hidden = true; $('#saveBtn').textContent = 'Save'; $('#more').open = false;
    odoHint(); moreSummary();
  }

  function editEntry(id) {
    const x = entries.find(e => e.id === id); if (!x) return;
    resetForm();
    F('id').value = x.id; F('date').value = x.date; F('odo').value = x.odo; F('total').value = x.total;
    F('litres').value = x.litres; F('price').value = x.price; F('type').value = x.type;
    F('station').value = x.station || ''; F('missed').checked = !!x.missed;
    F('rangeBefore').value = x.rangeBefore ?? ''; F('rangeAfter').value = x.rangeAfter ?? '';
    F('budi').checked = isBudi(x); lastEdited = []; updateBudiRow(); renderStations();
    setGauge('before', x.before ?? null); setGauge('after', x.after ?? (x.full ? 100 : null));
    $('#more').open = !!x.missed;
    $('#delBtn').hidden = false; $('#saveBtn').textContent = 'Save changes';
    if (x.hasReceipt) idb.get(x.id).then(src => {
      if (src && F('id').value === x.id) { $('#receiptThumb').src = src; $('#scanRes').hidden = false; $('#ocrStatus').textContent = 'Receipt saved. Scan again to replace it.'; }
    }).catch(() => {});
    odoHint(); moreSummary();
    go('add');
  }
  $('#delBtn').onclick = () => { const id = F('id').value; back(); setTimeout(() => deleteEntry(id), 50); };
  $('#receiptThumb').onclick = () => showReceipt($('#receiptThumb').src, 'Receipt');

  $('#entryForm').onsubmit = async e => {
    e.preventDefault();
    let t = +F('total').value || 0, l = +F('litres').value || 0, p = +F('price').value || 0;
    if (!t && l && p) t = +(l * p).toFixed(2);
    if (!l && t && p) l = +(t / p).toFixed(3);
    if (!p && t && l) p = +(t / l).toFixed(3);
    if (!t || !l) { toast('Enter two of: total, litres, RM/litre'); F(t ? 'litres' : 'total').focus(); return; }
    const odo = +F('odo').value;
    if (!odo) { toast('Enter the odometer reading'); F('odo').focus(); return; }
    const id = F('id').value || crypto.randomUUID?.() || String(Date.now());
    const old = entries.find(x => x.id === id);
    const entry = {
      id, date: F('date').value || today(), odo, total: t, litres: l, price: p, type: F('type').value,
      before: gauge.before, after: gauge.after, full: gauge.after === 100, missed: F('missed').checked,
      station: F('station').value.trim(), hasReceipt: !!old?.hasReceipt, vehicleId: old?.vehicleId || settings.current,
      budi: !$('#budiRow').hidden && F('budi').checked,
      rangeBefore: +F('rangeBefore').value || null, rangeAfter: +F('rangeAfter').value || null
    };
    const prev = prevOf(entry.date, id);
    if (prev && odo <= prev.odo && !confirm(`Odometer ${odo} is not higher than the previous fill-up (${prev.odo}). Save anyway?`)) return;
    if (pendingThumb) {
      try { await idb.put(id, pendingThumb); entry.hasReceipt = true; }
      catch { toast('Receipt photo could not be stored'); }
    }
    entries = entries.filter(x => x.id !== id).concat(entry);
    save(KEY, entries); keepData();
    const v = settings.vehicles.find(v => v.id === entry.vehicleId);
    if (v) { v.lastType = entry.type; v.lastStation = entry.station; saveSettings(); }
    if (old) { back(); toast('Fill-up updated'); return; }
    showSavedNote(entry);
    history.replaceState({ v: 'home', d: depth }, ''); view = 'add'; go('home', false);
  };

  function showSavedNote(entry) {
    const L = legs(), leg = L.find(x => x.id === entry.id), others = L.filter(x => x.id !== entry.id);
    let html;
    if (leg) {
      const avg = others.length ? others.reduce((a, x) => a + x.km, 0) / others.reduce((a, x) => a + x.litres, 0) : null;
      let cmp = '';
      if (avg) {
        const pct = Math.round((leg.kmpl / avg - 1) * 100);
        cmp = pct === 0 ? ', same as your average' : `, <b>${Math.abs(pct)}% ${pct > 0 ? 'better' : 'worse'}</b> than your average`;
      }
      html = `Saved. This tank: <b>${effText(leg.kmpl)}</b> over ${num(leg.km, 0)} km${cmp}.`;
    } else if (entry.missed) html = 'Saved. Consumption restarts from this fill-up.';
    else if (!mine().some(x => x.id !== entry.id)) html = 'Saved your first fill-up. Consumption shows after the next one.';
    else html = entry.full || veh().tank ? 'Saved. Not enough readings for a consumption figure this time.'
      : 'Saved. Consumption shows after your next full-tank fill-up.';
    $('#savedText').innerHTML = html; $('#savedNote').hidden = false;
  }

  /* ---------- receipt OCR ---------- */
  $('.scanbtn').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#receipt').click(); } };
  $('#receipt').onchange = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const img = await loadImage(file);
    pendingThumb = downscale(img, 1100, 0.7);
    $('#receiptThumb').src = pendingThumb; $('#scanRes').hidden = false; $('#ocrRawWrap').hidden = true; $('#scanLabel').textContent = 'Scan again';
    if (!window.Tesseract) { $('#ocrStatus').textContent = 'Receipt reader not loaded (offline?). Photo kept, type the values in.'; return; }
    const prog = $('#ocrProg'), bar = prog.firstElementChild;
    prog.hidden = false; bar.style.width = '0';
    $('#ocrStatus').textContent = 'Reading receipt…';
    try {
      const { data } = await Tesseract.recognize(downscale(img, 1600, 0.9, true), 'eng', {
        logger: m => { if (m.status === 'recognizing text') bar.style.width = Math.round(m.progress * 100) + '%'; }
      });
      $('#ocrRaw').textContent = data.text; $('#ocrRawWrap').hidden = false;
      applyParsed(parseReceipt(data.text));
    } catch (err) {
      console.error(err);
      $('#ocrStatus').textContent = 'Could not read this receipt. Type the values in.';
    } finally { prog.hidden = true; }
  };

  function applyParsed(r) {
    const found = [];
    if (r.total) { F('total').value = r.total.toFixed(2); found.push('total'); }
    if (r.litres) { F('litres').value = r.litres.toFixed(3); found.push('litres'); }
    if (r.price) { F('price').value = r.price.toFixed(3); found.push('price'); }
    const t = +F('total').value, l = +F('litres').value, p = +F('price').value;
    if (t && l && !p) F('price').value = (t / l).toFixed(3);
    if (t && p && !l) F('litres').value = (t / p).toFixed(3);
    if (l && p && !t) F('total').value = (l * p).toFixed(2);
    if (r.type) { F('type').value = r.type; found.push(r.type); }
    updateBudiRow();
    if (r.budi && !$('#budiRow').hidden && !F('budi').checked) { F('budi').checked = true; F('budi').dispatchEvent(new Event('change')); }
    if (!$('#budiRow').hidden && F('budi').checked) found.push('BUDI95');
    if (r.date) { F('date').value = r.date; found.push('date'); }
    moreSummary(); odoHint();
    $('#ocrStatus').textContent = found.length ? 'Found ' + found.join(', ') + '. Check them, then add the odometer.'
      : 'No amounts found. Type them in.';
    if (found.length) F('odo').focus({ preventScroll: true });
  }

  function parseReceipt(raw) {
    const text = raw.toUpperCase().replace(/[|]/g, ' ').replace(/(\d)\s*[,]\s*(\d{2})(?!\d)/g, '$1.$2');
    const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const nums = s => (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
    const out = {};

    // fuel type
    if (/RON\s*97|PRIMAX\s*97|V-?POWER\s*97/.test(text)) out.type = 'RON97';
    else if (/RON\s*100|V-?POWER\s*RACING|BLAZE\s*100/.test(text)) out.type = 'RON100';
    else if (/DIESEL|DYNAMIC\s*DIESEL|EURO\s*5|B10|B7/.test(text)) out.type = 'Diesel';
    else if (/RON\s*95|PRIMAX\s*95|FUELSAVE|PETROL|GASOLINE|ULP/.test(text)) out.type = 'RON95';

    if (/BUDI|SUBSIDI/.test(text)) out.budi = true;

    // litres: "24.390 L", "24.39LTR", "LITRE 24.39", "VOLUME: 24.39", "QTY 24.390"
    let m = text.match(/(\d{1,3}\.\d{2,3})\s*(?:L\b|LT\b|LTR|LITRE|LITER|LTRS)/);
    if (m) out.litres = +m[1];
    if (!out.litres) for (const ln of lines) if (/LITRE|LITER|LTR|VOLUME|QTY|QUANTITY|VOL\b/.test(ln)) {
      const n = nums(ln).filter(x => x > 0.5 && x < 200 && String(x).includes('.')); if (n.length) { out.litres = n[0]; break; }
    }

    // price per litre: "@ 2.050", "RM2.05/L", "PRICE/L 2.05", "UNIT PRICE 2.05"
    m = text.match(/@\s*(?:RM)?\s*(\d\.\d{2,3})/) || text.match(/(?:RM)?\s*(\d\.\d{2,3})\s*\/\s*(?:L|LTR|LITRE)/)
      || text.match(/(?:PRICE|UNIT|RATE|HARGA)[^\n\d]{0,15}(\d\.\d{2,3})/);
    if (m) out.price = +m[1];

    // total: lines with TOTAL / JUMLAH / AMOUNT etc. (prefer the last "TOTAL" not "SUBTOTAL")
    const totalRe = /(GRAND\s*TOTAL|NETT?\s*TOTAL|TOTAL\s*(?:AMOUNT|SALE|RM)?|JUMLAH|AMOUNT\s*DUE|AMOUNT|AMT|NETT|PAID|BAYARAN)/;
    let cands = [];
    lines.forEach((ln, i) => {
      if (totalRe.test(ln) && !/SUB\s*TOTAL|TAX|GST|SST|CHANGE|BAKI|ROUNDING/.test(ln)) {
        const money = s => (s.match(/\d+\.\d{2}(?!\d)/g) || []).map(Number).filter(x => x >= 1 && x < 2000);
        let n = money(ln);
        if (!n.length && lines[i + 1]) n = money(lines[i + 1]);
        if (n.length) cands.push(n.at(-1));
      }
    });
    if (cands.length) out.total = Math.max(...cands);
    if (!out.total) {
      const rms = [...text.matchAll(/RM\s*(\d{1,4}\.\d{2})/g)].map(x => +x[1]).filter(x => x >= 1 && x < 2000);
      if (rms.length) out.total = Math.max(...rms);
    }

    // sanity: price must be plausible
    if (out.price && (out.price < 0.5 || out.price > 10)) delete out.price;
    if (out.total && out.litres && !out.price) { const p = out.total / out.litres; if (p > 0.5 && p < 10) out.price = p; }
    if (out.total && out.price && out.litres && Math.abs(out.litres * out.price - out.total) > Math.max(1, out.total * 0.05)) {
      // inconsistent — trust total & price, recompute litres
      out.litres = out.total / out.price;
    }

    // date: dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd
    m = text.match(/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);
    let d = m ? [+m[1], +m[2], +m[3]] : null;
    if (!d) { m = text.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/); if (m) d = [+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]]; }
    if (d && d[1] >= 1 && d[1] <= 12 && d[2] >= 1 && d[2] <= 31 && d[0] > 2000 && d[0] <= new Date().getFullYear() + 1)
      out.date = `${d[0]}-${String(d[1]).padStart(2, '0')}-${String(d[2]).padStart(2, '0')}`;
    return out;
  }

  function loadImage(file) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  }
  function downscale(img, max, q, gray) {
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const g = c.getContext('2d'); if (gray) g.filter = 'grayscale(1) contrast(1.4)'; g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  }

  /* ---------- calculations ---------- */
  // For each fill-up, work out km driven and fuel used since the previous one.
  // Gauge method: tank capacity known → fuel used = (prev.after − cur.before) × tank.
  // Full-to-full: when cur is a full fill, fuel used = litres added since the last full fill.
  // "Missed the one before" breaks the chain: no figure for it, counting restarts there.
  function legs() {
    const s = sorted(), tank = +veh().tank || 0, out = [];
    let lastFull = null, litresSinceFull = 0;
    s.forEach((cur, i) => {
      const prev = s[i - 1];
      litresSinceFull += cur.litres;
      if (cur.missed) { lastFull = cur.full ? { odo: cur.odo, litresAtFull: litresSinceFull } : null; return; }
      let leg = null;
      if (prev && tank && prev.after != null && cur.before != null && prev.after > cur.before) {
        const used = (prev.after - cur.before) / 100 * tank, km = cur.odo - prev.odo;
        if (km > 0 && used > 0) leg = { id: cur.id, date: cur.date, km, litres: used };
      }
      if (!leg && cur.full && lastFull) {
        const km = cur.odo - lastFull.odo, used = litresSinceFull - lastFull.litresAtFull;
        if (km > 0 && used > 0) leg = { id: cur.id, date: cur.date, km, litres: used };
      }
      if (leg) { leg.kmpl = leg.km / leg.litres; out.push(leg); }
      if (cur.full) lastFull = { odo: cur.odo, litresAtFull: litresSinceFull };
    });
    return out;
  }
  const effText = kmpl => !kmpl ? '–' : settings.unit === 'l100' ? num(100 / kmpl, 1) + ' L/100km' : num(kmpl, 1) + ' km/L';
  const effParts = kmpl => !kmpl ? ['–', ''] : settings.unit === 'l100' ? [num(100 / kmpl, 1), 'L/100km'] : [num(kmpl, 1), 'km/L'];
  const avgOf = L => { const l = L.reduce((a, x) => a + x.litres, 0); return l ? L.reduce((a, x) => a + x.km, 0) / l : null; };

  function inPeriod(date, p) {
    const d = new Date(date + 'T00:00'), now = new Date();
    if (p === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    if (p === '3m') { const c = new Date(now); c.setMonth(c.getMonth() - 3); return d >= c; }
    if (p === 'year') return d.getFullYear() === now.getFullYear();
    return true;
  }

  /* ---------- home ---------- */
  $('#periodChips').onclick = e => { const b = e.target.closest('button'); if (!b) return; settings.period = b.dataset.p; saveSettings(); renderHome(); };
  function renderHome() {
    const has = mine().length > 0;
    $('#emptyState').hidden = has; $('#homeContent').hidden = !has;
    $('#emptyTitle').textContent = settings.vehicles.length > 1 ? `No fill-ups for ${veh().name} yet` : 'No fill-ups yet';
    if (!has) return;
    const s = sorted(), L = legs(), now = new Date();
    const mk = today().slice(0, 7), pmk = localISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
    const monthEntries = s.filter(x => x.date.startsWith(mk));
    const spent = monthEntries.reduce((a, x) => a + x.total, 0), lastMonth = s.filter(x => x.date.startsWith(pmk)).reduce((a, x) => a + x.total, 0);
    const n = monthEntries.length;
    $('#heroMonthLabel').textContent = 'Spent in ' + now.toLocaleDateString(LOC, { month: 'short' });
    $('#heroSpent').innerHTML = '<small>RM</small> ' + num(spent, 2);
    $('#heroSpentSub').textContent = lastMonth ? `RM ${num(lastMonth, 0)} last month` : `${n} fill-up${n === 1 ? '' : 's'}`;
    const avg = avgOf(L), [ev, eu] = effParts(avg);
    $('#heroEff').innerHTML = avg ? `${ev} <small>${eu}</small>` : '–';
    $('#heroEffSub').textContent = L.length ? 'Last tank ' + effText(L.at(-1).kmpl) : 'After 2 full tanks';

    // monthly budget: one full-width line under the two numbers
    const budget = +veh().budget || 0, bEl = $('#budget');
    if (budget) {
      const day = now.getDate(), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const pace = day >= 5 ? spent / day * dim : null, pct = Math.min(100, spent / budget * 100);
      const over = spent > budget, warn = !over && pace && pace > budget * 1.05;
      bEl.innerHTML = `<div class="bar ${over ? 'over' : warn ? 'pace' : ''}" role="progressbar" aria-valuenow="${Math.round(spent)}" aria-valuemin="0" aria-valuemax="${budget}" aria-label="Monthly budget used"><div style="width:${pct}%"></div></div>
        <div class="row2"><span>${over ? `<b class="bad">RM ${num(spent - budget, 0)} over budget</b>` : warn ? `<b class="warnt">On pace for RM ${num(pace, 0)}</b>` : `RM ${num(budget - spent, 0)} left`}</span><span>Budget RM ${num(budget, 0)}</span></div>`;
    } else bEl.innerHTML = '';

    const last = s.at(-1), nf = nextFill(s, L);
    $('#heroFoot').innerHTML = (nf?.level != null ? fuelGauge(nf.level) : '') + '<div class="txt">' +
      (nf?.left != null ? `<div class="range${nf.low ? ' low' : ''}">≈ ${num(nf.left, 0)} <small>km left${nf.low ? ' · fill up soon' : ''}</small></div>` : '') +
      (nf?.when ? `<div class="next">Next fill ${nf.when}${nf.every ? ` · every ~${nf.every} days` : ''}</div>` : '') +
      `<div>${nf?.checked ? `Checked dashboard ${daysAgo(nf.checked)}` : `Filled ${daysAgo(last.date)} · ${num(last.odo, 0)} km`}` +
      ' · <button class="link upd" id="rangeUpd" aria-label="Update the range from your dashboard">Update</button></div></div>';

    renderNudge(s, nf); renderDue(); renderInsights(s, L);

    // BUDI95 quota: per person, so counted across every vehicle. Warn before the pump when about one fill is left.
    const quotaNote = (left, saved) => {
      if (!(+settings.budi.quota)) return '';
      if (left <= 0.5) return `<b class="bad">Quota used up · RM ${num(+settings.budi.market, 2)}/L</b>`;
      const fills = entries.filter(isBudi).slice(-5).map(x => x.litres).sort((a, b) => a - b), typical = fills[Math.floor(fills.length / 2)] || 30;
      if (left < typical * 1.5) { const n = Math.floor(left / typical); return `<b class="warnt">${num(left, 0)} L left · ${n >= 1 ? `about ${n} fill${n > 1 ? 's' : ''}` : 'not a full tank'}</b>`; }
      return saved >= 1 ? `saved ≈ RM ${num(saved, 0)}` : '';
    };
    const qEl = $('#budiLine');
    if (settings.budi.on && entries.some(isBudi)) {
      const quota = +settings.budi.quota || 0, used = budiUsed(mk), pct = quota ? Math.min(100, used / quota * 100) : 0;
      const saved = used * Math.max(0, (+settings.budi.market || 0) - budiPrice());
      qEl.innerHTML = `<div class="bar budi-bar ${pct >= 100 ? 'over' : pct >= 85 ? 'pace' : ''}" role="progressbar" aria-valuenow="${Math.round(used)}" aria-valuemin="0" aria-valuemax="${quota}" aria-label="BUDI95 quota used this month"><div style="width:${pct}%"></div></div>
        <div class="row2"><span>BUDI95 ${num(used, 0)} / ${num(quota, 0)} L</span><span>${quotaNote(quota - used, saved)}</span></div>`;
    } else qEl.innerHTML = '';

    // period overview
    const p = settings.period;
    $$('#periodChips button').forEach(b => b.setAttribute('aria-pressed', b.dataset.p === p));
    const ps = s.filter(x => inPeriod(x.date, p)), pL = L.filter(x => inPeriod(x.date, p));
    const pSpent = ps.reduce((a, x) => a + x.total, 0), pLitres = ps.reduce((a, x) => a + x.litres, 0);
    const pAvg = avgOf(pL), avgPrice = pLitres ? pSpent / pLitres : null, rmKm = pAvg && avgPrice ? avgPrice / pAvg : null;
    const best = pL.length ? Math.max(...pL.map(x => x.kmpl)) : null, worst = pL.length ? Math.min(...pL.map(x => x.kmpl)) : null;
    const [bv] = effParts(best), [wv] = effParts(worst);
    const pc = myCosts().filter(c => inPeriod(c.date, p)), pOther = pc.reduce((a, c) => a + c.amount, 0), pKm = kmIn(s, p);
    const mini = [
      ['Fuel spent', rm(pSpent), `${ps.length} fill-up${ps.length === 1 ? '' : 's'}`],
      ['Litres', num(pLitres, 1) + ' L', avgPrice ? 'avg RM ' + num(avgPrice, 2) + '/L' : ''],
      ['Fuel per km', rmKm ? 'RM ' + num(rmKm, 2) : '–', rmKm ? 'RM ' + num(rmKm * 100, 0) + ' / 100 km' : ''],
      ['Consumption', effText(pAvg), pL.length > 1 ? `best ${bv} · worst ${wv}` : ''],
    ];
    if (pc.length) mini.push(
      ['Car costs', rm(pOther), topCats(pc)],
      ['All-in per km', pKm > 0 ? 'RM ' + num((pSpent + pOther) / pKm, 2) : '–', 'fuel + car costs']);
    $('#miniStats').innerHTML = ps.length ? mini.map(([k, v, sub]) => `<div><div class="k">${k}</div><div class="v">${v}</div><div class="s">${sub}</div></div>`).join('')
      : '<div class="hint" style="grid-column:1/-1">No fill-ups in this period.</div>';

    // one chart at a time, picked with the tabs
    const c = settings.chart || 'spend', box = $('#chart'), W = Math.max(260, box.clientWidth || 300);
    $('#effTab').textContent = settings.unit === 'l100' ? 'L/100km' : 'km/L';
    $$('#chartTabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.c === c));
    const dLabel = d => new Date(d + 'T00:00').toLocaleDateString(LOC, { day: 'numeric', month: 'short' });
    let note = '', html = '';
    if (c === 'spend') {
      const byMonth = {};
      ps.forEach(x => { const k = x.date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + x.total; });
      const months = Object.keys(byMonth).sort().slice(-Math.min(12, Math.floor(W / 42)));
      note = 'RM spent per month';
      html = months.length ? barChart(months.map(m => ({
        label: new Date(m + '-01T00:00').toLocaleDateString(LOC, { month: 'short' }), value: byMonth[m], tip: rm(byMonth[m])
      })), W) : '';
    } else if (c === 'price') {
      const ftype = last.type, pp = ps.filter(x => x.type === ftype && x.price > 0).slice(-24);
      if (pp.length >= 2) {
        const latest = pp.at(-1).price, ch = (latest / pp[0].price - 1) * 100;
        note = `${ftype} now <b>RM ${num(latest, 2)}</b> · ` + (Math.abs(ch) < 0.5 ? 'no change' :
          `<b class="${ch > 0 ? 'bad' : 'goodt'}">${ch > 0 ? '▲' : '▼'} ${num(Math.abs(ch), 1)}%</b> since ${dLabel(pp[0].date)}`);
        html = lineChart(pp.map(x => ({ label: dLabel(x.date), value: x.price })), W, 2, 'Price per litre');
      } else note = `${ftype} price per litre`;
    } else {
      const pts = pL.slice(-20);
      note = 'Per fill-up · dashed line is your average';
      html = pts.length ? lineChart(pts.map(x => ({ label: dLabel(x.date), value: settings.unit === 'l100' ? 100 / x.kmpl : x.kmpl })), W) : '';
    }
    $('#chartNote').innerHTML = note;
    box.innerHTML = html || '<div class="hint">Not enough fill-ups in this period yet.</div>';
  }
  $('#chartTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; settings.chart = b.dataset.c; saveSettings(); renderHome(); };
  let lastW = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - lastW) > 20 && view === 'home') { lastW = innerWidth; renderHome(); } });

  /* ---------- insights: this week's price change, a drop in km/L, RON95 vs RON97 ---------- */
  function renderInsights(s, L) {
    const items = [], sen = v => Math.round(Math.abs(v) * 100);
    // 1. pump prices this week, for the fuels you actually use
    const pr = settings.prices;
    if (pr?.prev && daysSince(pr.date) <= 7) {
      const used = [...new Set(s.slice(-10).map(x => x.type))].filter(t => ['RON95', 'RON97', 'Diesel'].includes(t));
      const parts = (used.length ? used : ['RON95']).map(t => {
        const k = { RON95: 'ron95', RON97: 'ron97', Diesel: 'diesel' }[t], ch = pr[k] - pr.prev[k];
        const label = t === 'RON95' && settings.budi.on ? L2('RON95 without BUDI', 'RON95 tanpa BUDI') : t;
        return `${label} RM ${num(pr[k], 2)} ${Math.abs(ch) < 0.005 ? L2('(no change)', '(tiada perubahan)')
          : `<span class="${ch < 0 ? 'dn' : 'up'}">${ch < 0 ? '▼' : '▲'} ${sen(ch)} sen</span>`}`;
      });
      items.push(['⛽', `<b>${L2('This week at the pump', 'Harga pam minggu ini')}</b> (${shortDate(pr.date)}): ${parts.join(' · ')}`]);
    }
    // 2. km/L dropping: the last 2 tanks against your usual
    if (L.length >= 5) {
      const recent = L.slice(-2), base = L.slice(-10, -2).map(x => x.kmpl).sort((a, b) => a - b);
      const usual = base[Math.floor(base.length / 2)], now = recent.reduce((a, x) => a + x.km, 0) / recent.reduce((a, x) => a + x.litres, 0);
      const pct = Math.round((now / usual - 1) * 100);
      if (pct <= -15) items.push(['⚠️', L2(`<b>Your last 2 tanks: ${effText(now)}, ${-pct}% worse than your usual ${effText(usual)}.</b> Check the tyre pressure; if it stays low, a service may be due.`,
        `<b>2 tangki terakhir: ${effText(now)}, ${-pct}% lebih teruk daripada biasa (${effText(usual)}).</b> Periksa tekanan tayar; jika masih rendah, mungkin perlu servis.`), 'warn']);
      else if (pct >= 10) items.push(['👍', L2(`Your last 2 tanks were <b>${pct}% better</b> than usual (${effText(now)}).`, `2 tangki terakhir <b>${pct}% lebih baik</b> daripada biasa (${effText(now)}).`)]);
    }
    // 3. RON95 vs RON97 for this car: the fuel in the tank for a stretch is the one put in at the start of it
    const idx = Object.fromEntries(s.map((x, i) => [x.id, i])), by = {};
    L.forEach(l => { const start = s[idx[l.id] - 1]; if (!start || !['RON95', 'RON97'].includes(start.type)) return;
      const g = by[start.type] ||= { km: 0, litres: 0, rm: 0, n: 0 }; g.km += l.km; g.litres += l.litres; g.rm += l.litres * start.price; g.n++; });
    if (by.RON95?.n >= 2 && by.RON97?.n >= 2) {
      const e95 = by.RON95.km / by.RON95.litres, e97 = by.RON97.km / by.RON97.litres, c95 = by.RON95.rm / by.RON95.km, c97 = by.RON97.rm / by.RON97.km;
      const d = Math.round((e97 / e95 - 1) * 100), dc = c97 - c95;
      items.push(['🧪', L2(`<b>RON97 vs RON95 in this car:</b> ${d >= 0 ? `${d}% more` : `${-d}% less`} km/L, and RM ${num(Math.abs(dc), 2)} ${dc >= 0 ? 'more' : 'less'} per km.${dc > 0.01 ? ' RON95 is the better buy.' : ''}`,
        `<b>RON97 berbanding RON95 untuk kereta ini:</b> km/L ${d >= 0 ? `${d}% lebih tinggi` : `${-d}% lebih rendah`}, dan RM ${num(Math.abs(dc), 2)} ${dc >= 0 ? 'lebih mahal' : 'lebih murah'} setiap km.${dc > 0.01 ? ' RON95 lebih berbaloi.' : ''}`)]);
    }
    const el = $('#insights'); el.hidden = !items.length;
    el.innerHTML = items.length ? `<div class="k">${L2('Insights', 'Pemerhatian')}</div>` + items.map(([ic, t, cls]) => `<div class="it ${cls || ''}"><span class="ic">${ic}</span><div>${t}</div></div>`).join('') : '';
  }

  /* ---------- car costs ---------- */
  const CATS = { service: ['🔧', 'Service'], tyres: ['🛞', 'Tyres'], repair: ['🔩', 'Repair'], insurance: ['🛡️', 'Insurance'],
    roadtax: ['📄', 'Road tax'], toll: ['🛣️', 'Toll'], parking: ['🅿️', 'Parking'], tng: ['💳', 'TNG reload'], other: ['🧾', 'Other'] };
  const catName = c => (CATS[c] || CATS.other)[1], catIcon = c => (CATS[c] || CATS.other)[0];
  const myCosts = () => costs.filter(c => c.vehicleId === settings.current);
  const topCats = list => {
    const by = {}; list.forEach(c => by[c.cat] = (by[c.cat] || 0) + c.amount);
    return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => catName(c)).join(', ');
  };
  // km driven in a period: last odometer in it minus the last one before it
  const kmIn = (s, p) => {
    const inP = s.filter(x => inPeriod(x.date, p)); if (!inP.length) return 0;
    const prev = s.filter(x => x.date < inP[0].date).at(-1);
    return inP.at(-1).odo - (prev ?? inP[0]).odo;
  };
  // usual km per day over the last ~4 months of fill-ups
  function paceOf(s) {
    if (s.length < 2) return null;
    const last = s.at(-1), recent = s.filter(x => (new Date(last.date) - new Date(x.date)) / 864e5 <= 120);
    const pool = recent.length >= 2 ? recent : s.slice(-2);
    const v = (last.odo - pool[0].odo) / Math.max(1, (new Date(last.date) - new Date(pool[0].date)) / 864e5);
    return v > 0 ? v : null;
  }
  // best guess of the odometer today: newest reading (fill-up, dashboard check or cost) plus usual km/day since
  function odoNow() {
    const s = sorted(), pts = s.map(x => [x.date, x.odo]), chk = veh().check;
    if (chk?.odo) pts.push([chk.date, chk.odo]);
    myCosts().forEach(c => c.odo && pts.push([c.date, c.odo]));
    if (!pts.length) return null;
    const best = pts.reduce((a, b) => b[1] > a[1] ? b : a);
    return best[1] + (paceOf(s) || 0) * Math.max(0, daysSince(best[0]));
  }
  const odoOn = date => daysSince(date) <= 3 ? odoNow() : sorted().filter(x => x.date <= date).at(-1)?.odo ?? null;

  const costDlg = $('#costDlg');
  let remTouched = false;
  $('#catPills').innerHTML = Object.entries(CATS).map(([k, [, n]]) => `<button type="button" role="radio" data-c="${k}">${n}</button>`).join('');
  function setCat(c) {
    $('#k-cat').value = c;
    $$('#catPills button').forEach(b => b.setAttribute('aria-checked', b.dataset.c === c));
    $('#catHint').hidden = c !== 'tng';
    if (!remTouched) $$('#k-rems input').forEach(i => i.checked = (veh().reminders || []).find(r => r.id === i.dataset.rem)?.cat === c);
  }
  $('#catPills').onclick = e => { const b = e.target.closest('button'); if (b) setCat(b.dataset.c); };
  function openCost(id, preset = {}) {
    const c = costs.find(x => x.id === id), rs = veh().reminders || [];
    remTouched = !!c || !!preset.remId;
    $('#costTitle').textContent = c ? 'Edit car cost' : 'Add car cost';
    $('#k-id').value = c?.id || '';
    $('#k-amount').value = c?.amount ?? ''; $('#k-date').value = c?.date || today();
    $('#k-odo').value = c?.odo ?? (preset.odo ? Math.round(preset.odo) : ''); $('#k-note').value = c?.note || '';
    const ticked = c ? (c.done || []) : preset.remId ? [preset.remId] : [];
    $('#k-rems').innerHTML = rs.length ? '<span class="lbl">Also mark as done</span>' + rs.map(r =>
      `<label class="check"><input type="checkbox" data-rem="${r.id}"${ticked.includes(r.id) ? ' checked' : ''}> ${esc(r.name)}</label>`).join('') : '';
    setCat(c?.cat || preset.cat || 'service');
    $('#k-del').hidden = !c;
    costDlg.showModal();
  }
  $('#k-rems').addEventListener('change', () => remTouched = true);
  costDlg.onclick = e => { if (e.target === costDlg) costDlg.close(); };
  $('#costForm').onsubmit = e => {
    e.preventDefault();
    const amount = +$('#k-amount').value;
    if (!(amount > 0)) { toast('Enter the amount'); $('#k-amount').focus(); return; }
    const id = $('#k-id').value || 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), old = costs.find(x => x.id === id);
    const done = $$('#k-rems input:checked').map(i => i.dataset.rem);
    const c = { id, vehicleId: old?.vehicleId || settings.current, date: $('#k-date').value || today(), cat: $('#k-cat').value, amount,
      odo: +$('#k-odo').value || null, note: $('#k-note').value.trim(), done };
    costs = costs.filter(x => x.id !== id).concat(c); save(CKEY, costs);
    const v = settings.vehicles.find(v => v.id === c.vehicleId);
    done.forEach(rid => {
      const r = v?.reminders?.find(r => r.id === rid);
      if (r && (!r.lastDate || c.date >= r.lastDate)) { r.lastDate = c.date; const o = c.odo || odoOn(c.date); if (o) r.lastKm = Math.round(o); }
    });
    saveSettings(); costDlg.close();
    toast(old ? 'Cost updated' : `${catName(c.cat)} ${rm(amount)} added`); refreshView();
  };
  $('#k-del').onclick = () => { const id = $('#k-id').value; costDlg.close(); deleteCost(id); };
  function deleteCost(id) {
    const c = costs.find(x => x.id === id); if (!c) return;
    costs = costs.filter(x => x.id !== id); save(CKEY, costs); openRow = null; refreshView();
    toast('Cost deleted', 'Undo', () => { costs.push(c); save(CKEY, costs); refreshView(); });
  }
  function refreshView() { if (view === 'home') renderHome(); if (view === 'history') renderHistory(); if (view === 'settings') renderSettings(); }
  $('#addCostLink').onclick = () => openCost();
  $('#histTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; settings.histTab = b.dataset.h; saveSettings(); renderHistory(); };
  document.addEventListener('click', e => { if (e.target.closest('#histAddCost')) openCost(); });

  function renderCosts() {
    const list = myCosts().sort((a, b) => b.date.localeCompare(a.date) || (b.odo || 0) - (a.odo || 0));
    const add = '<button class="addcost" id="histAddCost">+ Add car cost</button>';
    $('#historyHint').hidden = !list.length; $('#historyHint').textContent = 'Tap to edit · swipe left to delete';
    if (!list.length) {
      $('#historyList').innerHTML = add + `<div class="card empty"><div class="big">🔧</div><h2>No car costs yet</h2>
        <p>Add service, tyres, road tax, insurance, tolls and parking to see what ${esc(veh().name)} really costs per km.</p></div>`;
      return;
    }
    const groups = [];
    list.forEach(c => { const k = c.date.slice(0, 7); (groups.at(-1)?.k === k ? groups.at(-1) : (groups.push({ k, items: [] }), groups.at(-1))).items.push(c); });
    $('#historyList').innerHTML = add + groups.map(g => {
      const name = new Date(g.k + '-01T00:00').toLocaleDateString(LOC, { month: 'long', year: 'numeric' });
      return `<div class="month"><div class="mh"><b>${name}</b><span>${rm(g.items.reduce((a, c) => a + c.amount, 0))}</span></div><div class="list">` +
        g.items.map(c => `<div class="swipe" data-id="${c.id}"><button class="del" tabindex="-1">Delete</button>
          <div class="front" role="button" tabindex="0" aria-label="Edit ${catName(c.cat)} on ${fmtDate(c.date)}">
            <div class="t">${catIcon(c.cat)} ${catName(c.cat)}</div><div class="amt">${rm(c.amount)}</div>
            <div class="m">${[fmtDay(c.date), c.odo ? num(c.odo, 0) + ' km' : '', esc(c.note || '')].filter(Boolean).join(' · ')}</div><div class="eff"></div>
          </div></div>`).join('') + '</div></div>';
    }).join('');
    $$('#historyList .swipe').forEach(r => bindSwipe(r, openCost, deleteCost));
  }

  /* ---------- service reminders ---------- */
  const PRESETS = [
    { name: 'Oil change', km: 10000, months: 6, cat: 'service' },
    { name: 'Road tax', months: 12, cat: 'roadtax' },
    { name: 'Insurance', months: 12, cat: 'insurance' },
    { name: 'Tyre rotation', km: 10000, cat: 'tyres' },
    { name: 'Battery', months: 24, cat: 'repair' },
    { name: 'Brake check', km: 20000, cat: 'service' },
  ];
  const shortDate = d => new Date(d + 'T00:00').toLocaleDateString(LOC, { day: 'numeric', month: 'short', ...(d.slice(0, 4) !== today().slice(0, 4) ? { year: 'numeric' } : {}) });
  function remStatus(r) {
    const now = odoNow(), pace = paceOf(sorted());
    let kmLeft = null, daysLeft = null, dueDate = null;
    if (+r.km && r.lastKm != null && r.lastKm !== '' && now != null) kmLeft = +r.lastKm + +r.km - now;
    if (+r.months && r.lastDate) { const d = new Date(r.lastDate + 'T00:00'); d.setMonth(d.getMonth() + +r.months); dueDate = localISO(d); daysLeft = -daysSince(dueDate); }
    const kmDays = kmLeft != null && pace ? kmLeft / pace : null;
    const overdue = (kmLeft != null && kmLeft < 0) || (daysLeft != null && daysLeft < 0);
    const soon = overdue || (kmLeft != null && kmLeft <= 1000) || (daysLeft != null && daysLeft <= 30);
    const parts = [];
    if (kmLeft != null) parts.push(kmLeft < 0 ? `${num(-kmLeft, 0)} km overdue` : `in ${num(kmLeft, 0)} km`);
    if (dueDate) parts.push(daysLeft < 0 ? `was due ${shortDate(dueDate)}` : daysLeft === 0 ? 'due today' : `by ${shortDate(dueDate)}`);
    return { overdue, soon, order: Math.min(daysLeft ?? Infinity, kmDays ?? Infinity), text: parts.join(' · ') || 'Add when it was last done' };
  }
  function renderDue() {
    const rs = (veh().reminders || []).map(r => ({ r, st: remStatus(r) })).filter(x => x.st.soon).sort((a, b) => a.st.order - b.st.order);
    const el = $('#dueCard'); el.hidden = !rs.length; if (!rs.length) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="k">Coming up</div>' + rs.map(({ r, st }) =>
      `<div class="duerow"><div><b>${esc(r.name)}</b><div class="s${st.overdue ? ' bad' : ''}">${st.text}</div></div><button data-done="${r.id}">Done</button></div>`).join('');
  }
  $('#dueCard').onclick = e => {
    const b = e.target.closest('[data-done]'); if (!b) return;
    const r = veh().reminders.find(x => x.id === b.dataset.done); if (!r) return;
    const o = odoNow(); r.lastDate = today(); if (o) r.lastKm = Math.round(o); saveSettings(); renderHome();
    toast(`${r.name} marked done`, 'Add cost', () => openCost(null, { cat: r.cat || 'service', remId: r.id, odo: o }));
  };
  function renderRems() {
    const rs = veh().reminders || [];
    $('#remList').innerHTML = rs.length ? rs.map(r => {
      const st = remStatus(r), every = [+r.km ? num(+r.km, 0) + ' km' : '', +r.months ? r.months + ' month' + (+r.months === 1 ? '' : 's') : ''].filter(Boolean).join(' or ');
      return `<button class="remrow" data-rem="${r.id}"><span><b>${esc(r.name)}</b> <small>· every ${every}</small></span><small class="${st.overdue ? 'bad' : st.soon ? 'warnt' : ''}">Next ${st.text}</small></button>`;
    }).join('') : '<div class="hint" style="margin:6px 0 0">Get a heads-up before the oil change, road tax or insurance is due.</div>';
  }
  const remDlg = $('#remDlg');
  remDlg.onclick = e => { if (e.target === remDlg) remDlg.close(); };
  let remCat = null;
  function openRem(id) {
    const rs = veh().reminders || [], r = rs.find(x => x.id === id);
    $('#remTitle').textContent = r ? 'Edit reminder' : 'New reminder';
    $('#r-id').value = r?.id || ''; $('#r-name').value = r?.name || ''; $('#r-km').value = r?.km || ''; $('#r-months').value = r?.months || '';
    $('#r-lastDate').value = r?.lastDate || ''; $('#r-lastKm').value = r?.lastKm ?? ''; remCat = r?.cat ?? null;
    const o = odoNow(); $('#r-lastKm').placeholder = o ? 'now ≈ ' + Math.round(o) : '';
    const free = PRESETS.filter(p => !rs.some(x => x.name.toLowerCase() === p.name.toLowerCase()));
    $('#remPresets').innerHTML = r ? '' : free.map(p => `<button type="button" data-p="${p.name}">${p.name}</button>`).join('');
    $('#remPresets').hidden = !!r || !free.length;
    $('#r-del').hidden = !r; remDlg.showModal();
  }
  $('#remPresets').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const p = PRESETS.find(x => x.name === b.dataset.p);
    $('#r-name').value = p.name; $('#r-km').value = p.km || ''; $('#r-months').value = p.months || ''; remCat = p.cat;
    $$('#remPresets button').forEach(x => x.setAttribute('aria-pressed', x === b));
  };
  $('#addRem').onclick = () => openRem();
  $('#remList').onclick = e => { const b = e.target.closest('[data-rem]'); if (b) openRem(b.dataset.rem); };
  $('#remForm').onsubmit = e => {
    e.preventDefault();
    const name = $('#r-name').value.trim(), km = +$('#r-km').value || null, months = +$('#r-months').value || null;
    if (!name) { toast('Give the reminder a name'); $('#r-name').focus(); return; }
    if (!km && !months) { toast('Set every how many km or months'); $('#r-km').focus(); return; }
    const v = veh(); v.reminders = v.reminders || [];
    const id = $('#r-id').value || 'r' + Date.now().toString(36), old = v.reminders.find(x => x.id === id);
    let lastDate = $('#r-lastDate').value || null, lastKm = $('#r-lastKm').value === '' ? null : +$('#r-lastKm').value;
    if (!lastDate && lastKm == null) { lastDate = today(); const o = odoNow(); lastKm = o ? Math.round(o) : null; } // start counting now
    const r = { id, name, km, months, lastDate, lastKm, cat: remCat ?? old?.cat ?? null };
    v.reminders = old ? v.reminders.map(x => x.id === id ? r : x) : v.reminders.concat(r);
    saveSettings(); remDlg.close(); renderRems(); toast(old ? 'Reminder updated' : 'Reminder added');
  };
  $('#r-del').onclick = () => {
    const v = veh(), id = $('#r-id').value, r = v.reminders.find(x => x.id === id);
    v.reminders = v.reminders.filter(x => x.id !== id); saveSettings(); remDlg.close(); renderRems();
    toast('Reminder deleted', 'Undo', () => { v.reminders.push(r); saveSettings(); renderRems(); });
  };

  /* ---------- weekly pump prices from data.gov.my (official, public, no user data sent) ---------- */
  const PRICE_API = 'https://api.data.gov.my/data-catalogue/?id=fuelprice&filter=level@series_type&sort=-date&limit=2';
  async function updatePrices(force) {
    const pr = settings.prices;
    if (!force && pr?.checked && Date.now() - pr.checked < 6 * 36e5) return;
    if (!navigator.onLine) { if (force) toast("You're offline"); return; }
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
      const rows = await (await fetch(PRICE_API, { signal: ctl.signal })).json(), d = rows?.[0], p = rows?.[1]; clearTimeout(t);
      if (!d?.date || !(d.ron95 > 0)) throw new Error('bad data');
      const isNew = !pr || d.date > pr.date;
      settings.prices = { date: d.date, ron95: d.ron95, ron97: d.ron97, diesel: d.diesel, dieselEast: d.diesel_eastmsia, budi95: d.ron95_budi95, checked: Date.now(),
        prev: p?.ron95 > 0 ? { date: p.date, ron95: p.ron95, ron97: p.ron97, diesel: p.diesel } : pr?.prev ?? null };
      if (isNew) { settings.budi.market = d.ron95; if (d.ron95_budi95 > 0) settings.budi.price = d.ron95_budi95; }
      saveSettings();
      if (view === 'settings') renderSettings();
      if (view === 'home') renderHome();
      if (force) toast(isNew ? 'New prices for the week of ' + shortDate(d.date) : 'Prices are up to date');
    } catch { if (force) toast("Couldn't reach data.gov.my. Try again later."); }
  }
  function renderPrices() {
    const pr = settings.prices, f = v => v > 0 ? 'RM ' + num(v, 2) : '–';
    $('#priceGrid').innerHTML = [
      ['RON95 BUDI95', f(pr?.budi95 ?? settings.budi.price)], ['RON95', f(pr?.ron95 ?? settings.budi.market)],
      ['RON97', f(pr?.ron97)], ['Diesel', f(pr?.diesel) + (pr?.dieselEast && pr.dieselEast !== pr.diesel ? ` <small class="opt">(Sabah/Sarawak RM ${num(pr.dieselEast, 2)})</small>` : '')]
    ].map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
    $('#priceSrc').innerHTML = pr ? `Official weekly prices from data.gov.my for the week of <b>${shortDate(pr.date)}</b>. Checked ${daysAgo(localISO(new Date(pr.checked)))}.`
      : 'Prices update automatically from data.gov.my when you are online.';
  }
  $('#refreshPrices').onclick = () => updatePrices(true);
  addEventListener('online', () => updatePrices());

  /* ---------- shareable report (PNG) for the period picked on Home ---------- */
  async function shareFile(file, title) {
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); return 'shared'; }
      catch (e) { if (e.name === 'AbortError') return 'aborted'; }
    }
    download(file.name, file); return 'downloaded';
  }
  function reportData() {
    const p = settings.period, s = sorted(), ps = s.filter(x => inPeriod(x.date, p)), pc = myCosts().filter(c => inPeriod(c.date, p));
    const fuel = ps.reduce((a, x) => a + x.total, 0), litres = ps.reduce((a, x) => a + x.litres, 0), other = pc.reduce((a, c) => a + c.amount, 0);
    const km = kmIn(s, p), avg = avgOf(legs().filter(x => inPeriod(x.date, p)));
    const saved = settings.budi.on ? ps.filter(isBudi).reduce((a, x) => a + x.litres, 0) * Math.max(0, (+settings.budi.market || 0) - budiPrice()) : 0;
    const byCat = {}; pc.forEach(c => byCat[c.cat] = (byCat[c.cat] || 0) + c.amount);
    const months = {}; ps.forEach(x => { const k = x.date.slice(0, 7); months[k] = months[k] || [0, 0]; months[k][0] += x.total; });
    pc.forEach(c => { const k = c.date.slice(0, 7); months[k] = months[k] || [0, 0]; months[k][1] += c.amount; });
    const dates = ps.map(x => x.date).concat(pc.map(c => c.date)).sort(), now = new Date();
    const label = p === 'month' ? now.toLocaleDateString(LOC, { month: 'long', year: 'numeric' })
      : p === '3m' ? 'Last 3 months · to ' + fmtDate(today()) : p === 'year' ? String(now.getFullYear())
      : dates.length ? fmtDate(dates[0]) + ' – ' + fmtDate(dates.at(-1)) : 'All time';
    return { ps, pc, fuel, litres, other, km, avg, saved, byCat, months, label };
  }
  $('#shareReport').onclick = async () => {
    const d = reportData();
    if (!d.ps.length && !d.pc.length) { toast('Nothing logged in this period'); return; }
    const W = 1080, P = 72, rows = [];
    rows.push(['⛽ Fuel', rm(d.fuel), `${d.ps.length} fill-up${d.ps.length === 1 ? '' : 's'} · ${num(d.litres, 1)} L`]);
    Object.entries(d.byCat).sort((a, b) => b[1] - a[1]).forEach(([c, v]) => rows.push([catIcon(c) + ' ' + catName(c), rm(v), '']));
    const stats = [];
    if (d.km > 0) stats.push(['Distance', num(d.km, 0) + ' km']);
    if (d.avg) stats.push(['Consumption', effText(d.avg)]);
    if (d.km > 0) stats.push(['Cost per km', 'RM ' + num((d.fuel + d.other) / d.km, 2) + (d.other ? ' all-in' : '')]);
    if (d.saved >= 1) stats.push(['BUDI95 saved', '≈ ' + rm(d.saved)]);
    const mk = Object.keys(d.months).sort().slice(-12), showBars = mk.length >= 2;
    const H = 330 + rows.reduce((t, r) => t + (r[2] ? 126 : 92), 0) + 40 + (stats.length ? stats.length * 74 + 66 : 0) + (showBars ? 380 : 0) + 120;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    if (LANG === 'ms') { const ft = g.fillText.bind(g); g.fillText = (t, x, y) => ft(T(t), x, y); }
    const C = { bg: '#eef2f0', card: '#ffffff', text: '#111827', muted: '#6b7280', line: '#e5e7eb', accent: '#0f766e', other: '#d97706' };
    const font = (w, sz) => g.font = `${w} ${sz}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = C.card; g.beginPath(); g.roundRect(32, 32, W - 64, H - 64, 36); g.fill();
    let y = P + 60;
    g.fillStyle = C.muted; font(600, 32); g.fillText('Fuel Log report · ' + d.label, P, y);
    y += 70; g.fillStyle = C.text; font(800, 60); g.fillText(veh().name, P, y);
    y += 110; font(800, 96); g.fillText(rm(d.fuel + d.other), P, y);
    y += 46; g.fillStyle = C.muted; font(500, 32); g.fillText('total spent', P, y);
    y += 40;
    rows.forEach(([k, v, sub]) => {
      g.strokeStyle = C.line; g.lineWidth = 2; g.beginPath(); g.moveTo(P, y); g.lineTo(W - P, y); g.stroke();
      y += 56; g.fillStyle = C.text; font(600, 38); g.fillText(k, P, y);
      g.textAlign = 'right'; font(700, 38); g.fillText(v, W - P, y); g.textAlign = 'left';
      if (sub) { g.fillStyle = C.muted; font(500, 28); g.fillText(sub, P + 58, y + 34); }
      y += sub ? 70 : 36;
    });
    if (stats.length) { y += 30; g.fillStyle = C.bg; g.beginPath(); g.roundRect(P - 16, y, W - 2 * P + 32, stats.length * 74 + 24, 24); g.fill(); y += 12; }
    stats.forEach(([k, v]) => { y += 52; g.fillStyle = C.muted; font(500, 34); g.fillText(k, P + 8, y); g.textAlign = 'right'; g.fillStyle = C.text; font(700, 36); g.fillText(v, W - P - 8, y); g.textAlign = 'left'; y += 22; });
    y += 12;
    if (showBars) {
      y += 70; g.fillStyle = C.muted; font(600, 30); g.fillText('Per month', P, y);
      g.fillStyle = C.accent; g.fillRect(W - P - 300, y - 22, 22, 22); g.fillStyle = C.muted; font(500, 26); g.fillText('Fuel', W - P - 268, y);
      g.fillStyle = C.other; g.fillRect(W - P - 170, y - 22, 22, 22); g.fillStyle = C.muted; g.fillText('Car costs', W - P - 138, y);
      const top = y + 30, base = top + 230, max = Math.max(...mk.map(k => d.months[k][0] + d.months[k][1])), bw = (W - 2 * P) / mk.length;
      mk.forEach((k, i) => {
        const [f, o] = d.months[k], x = P + i * bw + bw * 0.18, w = bw * 0.64, hf = f / max * 210, ho = o / max * 210;
        g.fillStyle = C.accent; g.fillRect(x, base - hf, w, hf); g.fillStyle = C.other; g.fillRect(x, base - hf - ho, w, ho);
        g.fillStyle = C.muted; font(500, 24); g.textAlign = 'center';
        g.fillText(new Date(k + '-01T00:00').toLocaleDateString(LOC, { month: 'short' }), x + w / 2, base + 36); g.textAlign = 'left';
      });
      y = base + 40;
    }
    g.fillStyle = C.muted; font(500, 24); g.fillText('Made with Fuel Log · ' + fmtDate(today()), P, H - P + 6);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const name = `fuel-log-${veh().name.replace(/[^\w-]+/g, '-')}-${today()}.png`.toLowerCase();
    const res = await shareFile(new File([blob], name, { type: 'image/png' }), 'Fuel Log report');
    if (res === 'downloaded') toast('Report saved as an image');
  };

  // One reminder at a time above the summary: a fill-up you may have forgotten to log, else a backup that's due.
  const daysSince = d => Math.round((new Date(today() + 'T00:00') - new Date(d + 'T00:00')) / 864e5);
  function renderNudge(s, nf) {
    const el = $('#homeNote'), last = s.at(-1), since = daysSince(last.date);
    const gaps = s.slice(-7).map((x, i, a) => i ? daysSince(a[i - 1].date) - daysSince(x.date) : null).filter(g => g > 0);
    const every = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 10;
    let html = '';
    const emptyByNow = nf?.left === 0 && !nf.checked && since >= 2;
    if (veh().nudged !== last.id && (emptyByNow || since >= Math.max(7, Math.round(every * 1.6)))) {
      html = `<div class="msg">${emptyByNow ? 'By our estimate your tank is about empty' : `It's been <b>${since} days</b> since your last fill-up`}. Isi minyak and forgot to log it?</div>
        <div class="acts"><button class="later" data-nudge="fill">Not yet</button><button class="primary" data-go="add">Log it</button></div>`;
    } else {
      const total = entries.length + costs.length, lb = settings.lastBackup, snooze = settings.backupSnooze;
      const due = total >= 5 && (!lb || daysSince(lb) >= 30) && !(snooze && snooze > today());
      if (due) html = `<div class="msg">${lb ? `Last backup <b>${daysAgo(lb)}</b>` : `<b>${total} fill-ups</b> are only on this phone`}. Save a backup in case you change phones.</div>
        <div class="acts"><button class="later" data-nudge="backup">Later</button><button class="primary" id="nudgeBackup">Back up</button></div>`;
    }
    el.innerHTML = html; el.hidden = !html;
  }
  $('#homeNote').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.nudge === 'fill') { veh().nudged = sorted().at(-1)?.id; saveSettings(); $('#homeNote').hidden = true; }
    if (b.dataset.nudge === 'backup') { const d = new Date(); d.setDate(d.getDate() + 7); settings.backupSnooze = localISO(d); saveSettings(); $('#homeNote').hidden = true; }
    if (b.id === 'nudgeBackup') backup().then(ok => ok && renderHome());
  });

  // Estimate fuel left and when the next fill-up is likely.
  // Best source first: a range you entered from the dashboard today, then the range shown after the last fill-up,
  // then gauge × tank size × your km/L. Distance since the fill-up comes from the odometer if you gave it, else your usual pace.
  function nextFill(s, L) {
    if (!s.length) return null;
    const last = s.at(-1), tank = +veh().tank || 0, avg = avgOf(L.slice(-5));
    const daysFrom = d => Math.max(0, Math.round((new Date(today() + 'T00:00') - new Date(d + 'T00:00')) / 864e5));
    let kmPerDay = null;
    if (s.length >= 2) {
      const recent = s.filter(x => (new Date(last.date) - new Date(x.date)) / 864e5 <= 120);
      const pool = recent.length >= 2 ? recent : s.slice(-2);
      const span = Math.max(1, (new Date(last.date) - new Date(pool[0].date)) / 864e5);
      kmPerDay = (last.odo - pool[0].odo) / span;
      if (!(kmPerDay > 0)) kmPerDay = null;
    }
    const chk = veh().check?.fillId === last.id ? veh().check : null;
    let kmSince = null;
    if (chk?.odo > last.odo) kmSince = chk.odo - last.odo + (kmPerDay || 0) * daysFrom(chk.date);
    else if (kmPerDay) kmSince = kmPerDay * daysFrom(last.date);

    let left = null;
    if (chk?.range != null) left = chk.range - (kmPerDay || 0) * daysFrom(chk.date);
    else if (last.rangeAfter && kmSince != null) left = last.rangeAfter - kmSince;
    else if (tank && avg && last.after != null && kmSince != null) left = last.after / 100 * tank * avg - kmSince;
    if (left != null) left = Math.max(0, left);

    // what a full tank is worth in km (for the dial), and how many km you usually have left when you refill
    const fullRange = last.rangeAfter ? last.rangeAfter / ((last.after || 100) / 100) : (tank && avg ? tank * avg : null);
    const level = left != null && fullRange ? Math.min(1, left / fullRange) : null;
    const median = a => a.length ? a.sort((x, y) => x - y)[Math.floor(a.length / 2)] : null;
    const rb = median(s.map(x => x.rangeBefore).filter(v => v > 0));
    const gb = median(s.map(x => x.before).filter(v => v != null));
    const reserve = rb ?? (fullRange ? (gb ?? 15) / 100 * fullRange : 50);

    const when = days => {
      if (days <= 0.5) return '<b>due now</b>';
      const d = new Date(); d.setDate(d.getDate() + Math.round(days));
      return '<b>' + d.toLocaleDateString(LOC, { weekday: 'short', day: 'numeric', month: 'short' }) + '</b>';
    };
    if (left != null) return { left, level, checked: chk?.date, low: left < 60, when: kmPerDay ? when((left - reserve) / kmPerDay) : '' };

    // No fuel estimate: fall back to how often you usually fill up.
    const gaps = s.slice(-7).map((x, i, a) => i ? (new Date(x.date) - new Date(a[i - 1].date)) / 864e5 : null).filter(g => g > 0);
    if (!gaps.length) return null;
    const every = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    return { when: when(every - daysFrom(last.date)), every: Math.round(every) };
  }

  // "Update" on Home: type what the dashboard shows right now.
  const checkDlg = $('#checkDlg');
  document.addEventListener('click', e => {
    if (!e.target.closest('#rangeUpd')) return;
    $('#c-range').value = ''; $('#c-odo').value = ''; checkDlg.showModal(); $('#c-range').focus();
  });
  checkDlg.onclick = e => { if (e.target === checkDlg) checkDlg.close(); };
  $('#checkForm').onsubmit = e => {
    e.preventDefault();
    const range = +$('#c-range').value, odo = +$('#c-odo').value, last = sorted().at(-1);
    if (!range && !odo) { toast('Enter the range or the odometer'); return; }
    if (odo && last && odo < last.odo) { toast(`Odometer is lower than your last fill-up (${num(last.odo, 0)} km)`); return; }
    veh().check = { date: today(), range: range || null, odo: odo || null, fillId: last?.id };
    saveSettings(); checkDlg.close(); renderHome(); toast('Range updated');
  };

  // Small fuel gauge dial like the one on the dashboard: needle sweeps from 0 (left) to 1 (right),
  // with the same marks as the vehicle's gauge and a red zone in the last step.
  function fuelGauge(level) {
    const cx = 52, cy = 54, r = 42, n = steps(), red = 1 / n;
    const pt = (f, rr) => { const a = Math.PI * (1 - f); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
    const arc = (f0, f1, rr) => { const [x0, y0] = pt(f0, rr), [x1, y1] = pt(f1, rr); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${rr} ${rr} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    const ticks = Array.from({ length: n + 1 }, (_, i) => {
      const kind = tickKind(i, n), len = kind === 'l' ? 10 : kind === 'm' ? 7 : 4.5, f = i / n;
      const [x0, y0] = pt(f, r - len), [x1, y1] = pt(f, r - 1);
      return `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="var(--tick)" stroke-width="${kind === 'l' ? 2.2 : 1.4}" stroke-linecap="round"/>`;
    }).join('');
    const [nx, ny] = pt(level, r - 11), low = level <= red;
    return `<svg class="fuelgauge" viewBox="0 0 104 64" role="img" aria-label="Estimated fuel left: about ${Math.round(level * 100)}%">
      <path d="${arc(0, 1, r)}" fill="none" stroke="var(--line)" stroke-width="4" stroke-linecap="round"/>
      <path d="${arc(0, red, r)}" fill="none" stroke="var(--danger)" stroke-width="4" stroke-linecap="round"/>
      ${level > red + .01 ? `<path d="${arc(red, level, r)}" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/>` : ''}
      ${ticks}
      <text x="6" y="63">0</text><text x="98" y="63" text-anchor="end">1</text>
      <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${low ? 'var(--danger)' : 'var(--needle)'}" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="4.5" fill="var(--card)" stroke="var(--needle)" stroke-width="2"/>
    </svg>`;
  }

  // Charts are drawn at the real on-screen width so text stays a readable 11px on phones.
  function barChart(data, W) {
    const H = 170, P = { l: 4, r: 4, t: 20, b: 22 }, max = Math.max(...data.map(d => d.value)) || 1;
    const bw = Math.min(56, (W - P.l - P.r) / data.length), gap = Math.max(6, bw * 0.28);
    const x0 = P.l + ((W - P.l - P.r) - bw * data.length) / 2;
    const bars = data.map((d, i) => {
      const h = Math.max(2, (H - P.t - P.b) * d.value / max), x = x0 + i * bw + gap / 2, y = H - P.b - h, cx = x + (bw - gap) / 2;
      return `<rect x="${x}" y="${y}" width="${bw - gap}" height="${h}" rx="4" fill="var(--accent)"><title>${d.tip}</title></rect>
        <text x="${cx}" y="${y - 6}" text-anchor="middle">${Math.round(d.value)}</text>
        <text x="${cx}" y="${H - 6}" text-anchor="middle">${d.label}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Spent per month"><line x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}" stroke="var(--line)"/>${bars}</svg>`;
  }
  function lineChart(data, W, dec = 0, label = 'Consumption per fill-up') {
    const H = 170, P = { l: dec ? 36 : 26, r: 10, t: 12, b: 22 };
    const vals = data.map(d => d.value), mn = Math.min(...vals), mx = Math.max(...vals);
    const span = (mx - mn) || mx * 0.05 || 1, lo = Math.max(0, mn - span * 0.3), hi = mx + span * 0.3;
    const X = i => data.length === 1 ? (W + P.l - P.r) / 2 : P.l + 8 + i * (W - P.l - P.r - 16) / (data.length - 1);
    const Y = v => H - P.b - (v - lo) / (hi - lo || 1) * (H - P.t - P.b);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const path = data.map((d, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(d.value).toFixed(1)).join(' ');
    const step = Math.ceil(data.length / Math.max(2, Math.floor((W - P.l) / 64)));
    const grid = [lo, (lo + hi) / 2, hi].map(v => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${P.l - 5}" y="${Y(v) + 4}" text-anchor="end">${num(v, dec)}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${label}">${grid}
      <line x1="${P.l}" x2="${W - P.r}" y1="${Y(avg)}" y2="${Y(avg)}" stroke="var(--accent)" stroke-dasharray="4 4" opacity=".5"/>
      <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
      ${data.map((d, i) => `<circle cx="${X(i)}" cy="${Y(d.value)}" r="${data.length > 14 ? 3 : 4}" fill="var(--card)" stroke="var(--accent)" stroke-width="2"><title>${d.label}: ${num(d.value, dec ? 3 : 1)}</title></circle>`).join('')}
      ${data.map((d, i) => i % step ? '' : `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${d.label}</text>`).join('')}
    </svg>`;
  }

  /* ---------- history ---------- */
  function renderHistory() {
    const tab = settings.histTab === 'costs' ? 'costs' : 'fuel';
    $$('#histTabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.h === tab));
    if (tab === 'costs') return renderCosts();
    $('#historyHint').textContent = 'Tap a fill-up to edit · swipe left to delete';
    const L = Object.fromEntries(legs().map(x => [x.id, x])), s = sorted().reverse();
    $('#historyHint').hidden = !s.length;
    if (!s.length) {
      $('#historyList').innerHTML = `<div class="card empty"><div class="big">🧾</div><h2>Nothing logged yet</h2><p>Your fill-ups will appear here, grouped by month.</p>
        <button class="primary" data-go="add" style="padding:12px 22px">Log a fill-up</button></div>`;
      return;
    }
    const groups = [];
    s.forEach(x => { const k = x.date.slice(0, 7); (groups.at(-1)?.k === k ? groups.at(-1) : (groups.push({ k, items: [] }), groups.at(-1))).items.push(x); });
    $('#historyList').innerHTML = groups.map(g => {
      const tot = g.items.reduce((a, x) => a + x.total, 0), lit = g.items.reduce((a, x) => a + x.litres, 0);
      const name = new Date(g.k + '-01T00:00').toLocaleDateString(LOC, { month: 'long', year: 'numeric' });
      return `<div class="month"><div class="mh"><b>${name}</b><span>${rm(tot)} · ${num(lit, 0)} L</span></div><div class="list">` +
        g.items.map(x => {
          const leg = L[x.id], tags = [];
          if (isBudi(x)) tags.push('<span class="pill">BUDI95</span>');
          if (!x.full) tags.push('<span class="pill w">partial</span>');
          if (x.missed) tags.push('<span class="pill w">after missed</span>');
          const meta = [num(x.odo, 0) + ' km', num(x.litres, 2) + ' L', x.type, x.station ? esc(x.station) : ''].filter(Boolean).join(' · ');
          return `<div class="swipe" data-id="${x.id}"><button class="del" tabindex="-1">Delete</button>
            <div class="front" role="button" tabindex="0" aria-label="Edit fill-up on ${fmtDate(x.date)}">
              <div class="t">${fmtDay(x.date)}${x.hasReceipt ? '<button class="rcpt" aria-label="View receipt" title="View receipt">🧾</button>' : ''}${tags.join('')}</div>
              <div class="amt">${rm(x.total)}</div>
              <div class="m">${meta}</div>
              <div class="eff">${leg ? effText(leg.kmpl) : ''}</div>
            </div></div>`;
        }).join('') + '</div></div>';
    }).join('');
    $$('#historyList .swipe').forEach(bindSwipe);
  }

  let openRow = null;
  const closeRow = r => { if (!r) return; r.querySelector('.front').style.transform = ''; r._open = false; if (openRow === r) openRow = null; };
  function bindSwipe(row, edit = editEntry, del = deleteEntry) {
    const front = row.querySelector('.front'), id = row.dataset.id, OPEN = -88;
    let x0, y0, dx = 0, down = false, moved = false;
    front.addEventListener('pointerdown', e => {
      if (e.button > 0 || e.target.closest('.rcpt')) return;
      if (openRow && openRow !== row) closeRow(openRow);
      x0 = e.clientX; y0 = e.clientY; dx = row._open ? OPEN : 0; down = true; moved = false;
    });
    front.addEventListener('pointermove', e => {
      if (!down) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!moved) {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { down = false; return; } // vertical scroll
        if (Math.abs(mx) < 8) return;
        moved = true; front.setPointerCapture(e.pointerId); front.style.transition = 'none';
      }
      dx = Math.min(0, mx + (row._open ? OPEN : 0));
      front.style.transform = `translateX(${dx}px)`;
    });
    const end = () => {
      if (!down) return; down = false; front.style.transition = '';
      if (!moved) { if (row._open) closeRow(row); else edit(id); return; }
      if (dx < -row.offsetWidth * 0.55) { front.style.transform = `translateX(-100%)`; setTimeout(() => del(id), 160); }
      else if (dx < OPEN / 2) { front.style.transform = `translateX(${OPEN}px)`; row._open = true; openRow = row; }
      else closeRow(row);
    };
    front.addEventListener('pointerup', end);
    front.addEventListener('pointercancel', () => { down = false; front.style.transition = ''; closeRow(row); });
    front.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); edit(id); }
      if (e.key === 'Delete' || e.key === 'Backspace') del(id);
    });
    row.querySelector('.del').onclick = () => del(id);
    row.querySelector('.rcpt')?.addEventListener('click', async e => {
      e.stopPropagation();
      const x = entries.find(v => v.id === id); let src = null; try { src = await idb.get(id); } catch {}
      showReceipt(src, fmtDate(x.date) + ' · ' + rm(x.total));
    });
  }

  function deleteEntry(id) {
    const x = entries.find(e => e.id === id); if (!x) return;
    entries = entries.filter(e => e.id !== id); save(KEY, entries);
    openRow = null; renderHistory(); renderHome();
    // Photo stays in storage until the next start-up tidy, so Undo restores it too.
    toast('Fill-up deleted', 'Undo', () => { entries.push(x); save(KEY, entries); renderHistory(); renderHome(); });
  }

  /* ---------- day / night ---------- */
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');
  const isNight = () => settings.theme === 'dark' || (settings.theme !== 'light' && darkMQ.matches);
  function applyTheme() {
    const t = settings.theme || 'auto';
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    const night = isNight();
    $('meta[name="theme-color"]').setAttribute('content', night ? '#060708' : '#f4f6f5');
    $('#themeBtn').setAttribute('aria-label', night ? 'Switch to day mode' : 'Switch to night mode');
    $$('#themeTabs button').forEach(b => b.setAttribute('aria-checked', b.dataset.t === t));
  }
  $('#themeBtn').onclick = () => { settings.theme = isNight() ? 'light' : 'dark'; saveSettings(); applyTheme(); toast(isNight() ? 'Night mode' : 'Day mode'); };
  $('#themeTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; settings.theme = b.dataset.t; saveSettings(); applyTheme(); };
  darkMQ.addEventListener?.('change', applyTheme);

  /* ---------- settings & data ---------- */
  function renderSettings() {
    const v = veh();
    $('#s-veh').innerHTML = settings.vehicles.map(x => `<option value="${x.id}"${x.id === v.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
    $('#s-vehRow').hidden = settings.vehicles.length < 2;
    $('#s-name').value = v.name; $('#s-tank').value = v.tank; $('#s-budget').value = v.budget; $('#s-steps').value = String(steps());
    $('#delVeh').hidden = settings.vehicles.length < 2;
    $$('#unitTabs button').forEach(b => b.setAttribute('aria-checked', b.dataset.u === settings.unit));
    $$('#langTabs button').forEach(b => b.setAttribute('aria-checked', b.dataset.l === LANG));
    renderRems(); renderPrices(); renderStorage();
    $('#s-budiOn').checked = settings.budi.on; $('#budiFields').hidden = !settings.budi.on;
    $('#s-budiQuota').value = settings.budi.quota; $('#s-budiPrice').value = settings.budi.price; $('#s-marketPrice').value = settings.budi.market;
  }
  $('#s-veh').onchange = () => switchVehicle($('#s-veh').value);
  $('#s-name').oninput = () => { veh().name = $('#s-name').value.trim() || 'Vehicle'; saveSettings(); $('#s-veh').selectedOptions[0].textContent = veh().name; };
  $('#s-tank').oninput = () => { veh().tank = $('#s-tank').value; saveSettings(); };
  $('#s-budget').oninput = () => { veh().budget = $('#s-budget').value; saveSettings(); };
  $('#s-budiOn').onchange = () => { settings.budi.on = $('#s-budiOn').checked; $('#budiFields').hidden = !settings.budi.on; saveSettings(); };
  [['s-budiQuota', 'quota'], ['s-budiPrice', 'price'], ['s-marketPrice', 'market']].forEach(([id, k]) =>
    $('#' + id).oninput = () => { settings.budi[k] = +$('#' + id).value || 0; saveSettings(); });
  $('#s-steps').onchange = () => { veh().gaugeSteps = +$('#s-steps').value; saveSettings(); buildMeters(); };
  $('#unitTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; settings.unit = b.dataset.u; saveSettings(); $$('#unitTabs button').forEach(x => x.setAttribute('aria-checked', x === b)); };
  $('#langTabs').onclick = e => { const b = e.target.closest('button'); if (!b || b.dataset.l === LANG) return; settings.lang = b.dataset.l; saveSettings(); location.reload(); };
  $('#addVeh').onclick = () => {
    const v = newVehicle('Vehicle ' + (settings.vehicles.length + 1));
    settings.vehicles.push(v); switchVehicle(v.id);
    $('#s-name').focus(); $('#s-name').select(); toast('Vehicle added. Give it a name.');
  };
  $('#delVeh').onclick = () => {
    const v = veh(), n = mine().length;
    if (!confirm(`Delete "${v.name}"${n ? ` and its ${n} fill-up${n === 1 ? '' : 's'}` : ''}? This cannot be undone.`)) return;
    entries = entries.filter(x => x.vehicleId !== v.id); save(KEY, entries);
    costs = costs.filter(c => c.vehicleId !== v.id); save(CKEY, costs);
    settings.vehicles = settings.vehicles.filter(x => x.id !== v.id);
    switchVehicle(settings.vehicles[0].id); tidyPhotos(); toast('Vehicle deleted');
  };

  const download = (name, data, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type })); a.download = name; a.click(); };
  // Ask the browser to keep our data even when the phone is low on space (installed apps usually get this).
  async function keepData() {
    try { if (navigator.storage?.persist && !(await navigator.storage.persisted()) && (entries.length || costs.length)) await navigator.storage.persist(); } catch {}
  }
  async function renderStorage() {
    let ok = false; try { ok = await navigator.storage?.persisted?.(); } catch {}
    $('#persistNote').textContent = ok ? L2('✓ This phone keeps your data permanently.', '✓ Telefon ini menyimpan data anda secara kekal.')
      : L2('Your browser may clear this data if the phone runs low on space or the app is unused for weeks. Install the app and back up now and then.',
           'Pelayar mungkin memadam data ini jika storan telefon hampir penuh atau apl tidak digunakan berminggu-minggu. Pasang apl dan buat sandaran sekali-sekala.');
    $('#s-backupPhotos').checked = !!settings.backupPhotos;
    const ids = entries.filter(x => x.hasReceipt).map(x => x.id);
    const mb = b => b < 1e5 ? (LANG === "ms" ? "kurang 0.1 MB" : "under 0.1 MB") : num(b / 1048576, 1) + " MB";
    let bytes = 0; for (const id of ids) { try { bytes += ((await idb.get(id)) || '').length * 0.75; } catch {} }
    $('#photoSize').textContent = ids.length ? L2(`${ids.length} photo${ids.length === 1 ? '' : 's'}, ${mb(bytes)}`, `${ids.length} gambar, ${mb(bytes)}`)
      : L2('No receipt photos yet', 'Belum ada gambar resit');
  }
  $('#s-backupPhotos').onchange = () => { settings.backupPhotos = $('#s-backupPhotos').checked; saveSettings(); };
  async function backup() {
    const data = { settings, entries, costs };
    if (settings.backupPhotos) {
      data.photos = {};
      for (const x of entries.filter(x => x.hasReceipt)) { try { const p = await idb.get(x.id); if (p) data.photos[x.id] = p; } catch {} }
    }
    const name = `fuel-log-${today()}.json`, text = JSON.stringify(data, null, 1);
    // On phones, the share sheet lets you save straight to Google Drive, Files, email or WhatsApp.
    if (await shareFile(new File([text], name, { type: 'application/json' }), 'Fuel Log backup') === 'aborted') return false;
    settings.lastBackup = today(); delete settings.backupSnooze; saveSettings();
    toast('Backup saved'); return true;
  }
  $('#expJson').onclick = () => backup().then(ok => ok && view === 'home' && renderHome());
  $('#expCsv').onclick = () => {
    const vname = id => settings.vehicles.find(v => v.id === id)?.name || '';
    const all = [...entries].sort((a, b) => vname(a.vehicleId).localeCompare(vname(b.vehicleId)) || a.date.localeCompare(b.date) || a.odo - b.odo);
    const legsAll = {}; const cur = settings.current;
    settings.vehicles.forEach(v => { settings.current = v.id; legs().forEach(l => legsAll[l.id] = l); }); settings.current = cur;
    const rows = [['vehicle', 'date', 'odometer_km', 'fuel', 'litres', 'price_per_l_rm', 'total_rm', 'gauge_before_pct', 'gauge_after_pct', 'full_tank', 'missed_previous', 'budi95', 'range_before_km', 'range_after_km', 'km_since_last', 'km_per_l', 'station']]
      .concat(all.map(x => ['"' + vname(x.vehicleId).replace(/"/g, '""') + '"', x.date, x.odo, x.type, x.litres, x.price, x.total, x.before ?? '', x.after ?? '', x.full, !!x.missed, isBudi(x), x.rangeBefore ?? '', x.rangeAfter ?? '',
        legsAll[x.id]?.km ?? '', legsAll[x.id] ? legsAll[x.id].kmpl.toFixed(2) : '', '"' + (x.station || '').replace(/"/g, '""') + '"']));
    download(`fuel-log-${today()}.csv`, rows.map(r => r.join(',')).join('\n'), 'text/csv');
    if (costs.length) setTimeout(() => {
      const q = t => '"' + String(t ?? '').replace(/"/g, '""') + '"';
      const cr = [['vehicle', 'date', 'category', 'amount_rm', 'odometer_km', 'note']].concat([...costs].sort((a, b) => a.date.localeCompare(b.date))
        .map(c => [q(vname(c.vehicleId)), c.date, catName(c.cat), c.amount, c.odo ?? '', q(c.note)]));
      download(`car-costs-${today()}.csv`, cr.map(r => r.join(',')).join('\n'), 'text/csv');
    }, 600);
  };
  $('#impJson').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const d = JSON.parse(await f.text()); const list = Array.isArray(d) ? d : d.entries;
      if (!Array.isArray(list)) throw 0;
      const ids = new Set(entries.map(x => x.id)); const add = list.filter(x => x && x.id && x.date && !ids.has(x.id));
      // receipt photos come along when the backup included them
      let photos = 0;
      for (const x of add) {
        const p = d.photos?.[x.id];
        if (p && /^data:image\//.test(p)) { try { await idb.put(x.id, p); x.hasReceipt = true; photos++; continue; } catch {} }
        x.hasReceipt = false;
      }
      if (Array.isArray(d.settings?.vehicles)) { // bring in vehicles we don't have yet
        const have = new Set(settings.vehicles.map(v => v.id));
        d.settings.vehicles.filter(v => v && v.id && !have.has(v.id)).forEach(v => settings.vehicles.push(v));
        saveSettings();
      }
      entries = entries.concat(add); save(KEY, entries); adoptOrphans(); await tidyPhotos();
      if (Array.isArray(d.costs)) {
        const have = new Set(costs.map(c => c.id)), vs = new Set(settings.vehicles.map(v => v.id));
        costs = costs.concat(d.costs.filter(c => c && c.id && c.date && !have.has(c.id)).map(c => vs.has(c.vehicleId) ? c : { ...c, vehicleId: settings.current }));
        save(CKEY, costs);
      }
      renderSettings(); renderTitle();
      toast(L2(`Imported ${add.length} fill-up(s)${photos ? ` and ${photos} receipt photo(s)` : ''}`, `${add.length} isian diimport${photos ? ` bersama ${photos} gambar resit` : ''}`));
    } catch { toast('That file is not a Fuel Log backup'); }
  };
  $('#wipe').onclick = () => { if (confirm('Delete ALL fill-ups, car costs and receipt photos? This cannot be undone.')) { entries = []; save(KEY, entries); costs = []; save(CKEY, costs); idb.clear().catch(() => {}); toast('All data deleted'); } };
  function loadDemo() {
    const base = new Date(); base.setMonth(base.getMonth() - 5); let odo = 42000;
    for (let i = 0; i < 14; i++) {
      const d = new Date(base); d.setDate(d.getDate() + i * 11);
      if (d > new Date()) break;
      const before = [15, 20, 25, 10, 30][i % 5], litres = +((100 - before) / 100 * 40).toFixed(2), price = budiPrice();
      entries.push({ id: 'demo' + i + Date.now(), date: localISO(d), odo, total: +(litres * price).toFixed(2), litres, price,
        type: 'RON95', before, after: 100, full: true, missed: false, station: 'Sample', hasReceipt: false, vehicleId: settings.current,
        budi: true, rangeBefore: Math.round(before / 100 * 480), rangeAfter: 480 + (i % 3) * 10 });
      odo += Math.round(380 + Math.sin(i) * 60);
    }
    if (!veh().tank) { veh().tank = '40'; saveSettings(); }
    const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return localISO(d); }, lastOdo = odo;
    [['service', 285, 120, 'Minor service, 5W-30'], ['roadtax', 90, 140, ''], ['insurance', 1180, 140, 'Renewal'], ['tyres', 640, 60, '2 front tyres'],
     ['toll', 45.6, 30, ''], ['parking', 32, 12, ''], ['toll', 38.2, 5, '']].forEach(([cat, amount, n, note], i) =>
      costs.push({ id: 'cdemo' + i + Date.now(), vehicleId: settings.current, date: ago(n), cat, amount, odo: cat === 'service' || cat === 'tyres' ? Math.round(lastOdo - n * 35) : null, note, done: [] }));
    if (!veh().reminders?.length) {
      veh().reminders = [
        { id: 'rdemo1', name: 'Oil change', km: 5000, months: 6, lastDate: ago(120), lastKm: Math.round(lastOdo - 4600), cat: 'service' },
        { id: 'rdemo2', name: 'Road tax', months: 12, lastDate: ago(140), lastKm: null, cat: 'roadtax' }];
      saveSettings();
    }
    save(CKEY, costs); save(KEY, entries); toast('Sample data added');
  }
  $('#loadDemo').onclick = () => { if (entries.length && !confirm('Add sample fill-ups to your existing data?')) return; loadDemo(); go('home'); };
  $('#demoBtn').onclick = () => { loadDemo(); renderHome(); };

  applyTheme();
  resetForm();
  renderTitle();
  renderHome();
  const action = new URLSearchParams(location.search).get('do');
  if (action) {
    history.replaceState({ v: 'home', d: 0 }, '', location.pathname);
    if (action === 'add') { go('add'); autoStation(); }
    if (action === 'range' && mine().length) $('#rangeUpd')?.click();
  }
  tidyPhotos();
  updatePrices();
  keepData();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http'))
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('offline mode unavailable', e));
})();

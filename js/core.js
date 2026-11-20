// Fuel Log core: the calculations, with no screen code, so they can be tested on their own (see tests/).
// Loaded in the browser as window.FuelCore and in Node with require('./js/core.js').
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.FuelCore = api;
})(this, function () {
  const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
  const DAY = 864e5;
  const dayDiff = (a, b) => (new Date(b + 'T00:00') - new Date(a + 'T00:00')) / DAY;

  /* ---------- consumption ----------
     For each fill-up, work out km driven and fuel used since the previous one.
     Gauge method: tank capacity known → fuel used = (prev.after − cur.before) × tank.
     Full-to-full: when cur is a full fill, fuel used = litres added since the last full fill.
     "Missed the one before" breaks the chain: no figure for it, counting restarts there. */
  function computeLegs(s, tank) {
    const out = [];
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
  // average km/L over several stretches: total km ÷ total litres (not the average of the averages)
  const avgOf = L => { const l = sum(L, x => x.litres); return l ? sum(L, x => x.km) / l : null; };

  // usual km per day over the last ~4 months of fill-ups
  function paceOf(s) {
    if (s.length < 2) return null;
    const last = s.at(-1), recent = s.filter(x => dayDiff(x.date, last.date) <= 120);
    const pool = recent.length >= 2 ? recent : s.slice(-2);
    const v = (last.odo - pool[0].odo) / Math.max(1, dayDiff(pool[0].date, last.date));
    return v > 0 ? v : null;
  }

  /* ---------- BUDI95 ---------- */
  // A fill-up counts as BUDI95 if it was marked so, or (older entries) RON95 bought at the subsidised price.
  const isBudiEntry = (x, budiPrice) => x.budi ?? (x.type === 'RON95' && Math.abs(x.price - budiPrice) < 0.006);
  const budiUsedIn = (entries, monthKey, budiPrice, exceptId) =>
    sum(entries.filter(x => x.id !== exceptId && x.date.startsWith(monthKey) && isBudiEntry(x, budiPrice)), x => x.litres);

  /* ---------- service reminders: when is it next due ---------- */
  function remDue(r, odoNow, todayISO) {
    let kmLeft = null, daysLeft = null, dueDate = null;
    if (+r.km && r.lastKm != null && r.lastKm !== '' && odoNow != null) kmLeft = +r.lastKm + +r.km - odoNow;
    if (+r.months && r.lastDate) {
      const [y, m, d] = r.lastDate.split('-').map(Number);
      const due = new Date(y, m - 1 + +r.months, d);
      if (due.getDate() !== d) due.setDate(0); // 31 Jan + 1 month → 28/29 Feb, not 2/3 Mar
      dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
      daysLeft = Math.round(dayDiff(todayISO, dueDate));
    }
    return { kmLeft, daysLeft, dueDate };
  }

  /* ---------- receipt text → values ---------- */
  function parseReceipt(raw, maxYear = new Date().getFullYear() + 1) {
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
    const cands = [];
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
      out.litres = out.total / out.price; // inconsistent: trust total & price, recompute litres
    }

    // date: dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd
    m = text.match(/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/);
    let d = m ? [+m[1], +m[2], +m[3]] : null;
    if (!d) { m = text.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/); if (m) d = [+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]]; }
    if (d && d[1] >= 1 && d[1] <= 12 && d[2] >= 1 && d[2] <= 31 && d[0] > 2000 && d[0] <= maxYear)
      out.date = `${d[0]}-${String(d[1]).padStart(2, '0')}-${String(d[2]).padStart(2, '0')}`;
    return out;
  }

  /* ---------- CSV ---------- */
  // Text cells are quoted, and a leading = + - @ gets a ' so Excel/Sheets show it as text instead of running it as a formula.
  const csvText = t => { const s = String(t ?? ''); return '"' + (/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'; };

  /* ---------- importing a backup ----------
     A backup file can come from anyone (e.g. sent on WhatsApp), so nothing in it is trusted:
     each record is rebuilt from the fields the app knows, with the right types, and anything else is dropped. */
  const FUELS = ['RON95', 'RON97', 'RON100', 'Diesel', 'Other'];
  const okId = v => typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : null;
  const okDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00')) ? v : null;
  const okNum = v => { const n = typeof v === 'string' && v.trim() ? Number(v) : v; return typeof n === 'number' && isFinite(n) ? n : null; };
  const okStr = (v, max) => typeof v === 'string' ? v.slice(0, max) : '';
  function cleanEntry(x) {
    const id = okId(x?.id), date = okDate(x?.date); if (!id || !date) return null;
    const n = k => okNum(x[k]);
    const e = { id, date, odo: n('odo') ?? 0, total: n('total') ?? 0, litres: n('litres') ?? 0, price: n('price') ?? 0,
      type: FUELS.includes(x.type) ? x.type : 'Other', before: n('before'), after: n('after'), full: !!x.full, missed: !!x.missed,
      station: okStr(x.station, 120), hasReceipt: false, vehicleId: okId(x.vehicleId), rangeBefore: n('rangeBefore'), rangeAfter: n('rangeAfter') };
    if (typeof x.budi === 'boolean') e.budi = x.budi;
    return e;
  }
  function cleanCost(c, cats) {
    const id = okId(c?.id), date = okDate(c?.date); if (!id || !date) return null;
    return { id, vehicleId: okId(c.vehicleId), date, cat: cats.includes(c.cat) ? c.cat : 'other', amount: okNum(c.amount) ?? 0,
      odo: okNum(c.odo), note: okStr(c.note, 300), done: Array.isArray(c.done) ? c.done.map(okId).filter(Boolean) : [] };
  }
  function cleanRem(r, cats) {
    const id = okId(r?.id); if (!id) return null;
    return { id, name: okStr(r.name, 60) || 'Reminder', km: okNum(r.km), months: okNum(r.months), lastDate: okDate(r.lastDate),
      lastKm: okNum(r.lastKm), cat: cats.includes(r.cat) ? r.cat : null };
  }
  function cleanVehicle(v, cats) {
    const id = okId(v?.id); if (!id) return null;
    const s = k => okNum(v[k]) != null ? String(okNum(v[k])) : '';
    const out = { id, name: okStr(v.name, 60) || 'Vehicle', tank: s('tank'), budget: s('budget'),
      lastType: FUELS.includes(v.lastType) ? v.lastType : 'RON95', lastStation: okStr(v.lastStation, 120),
      reminders: Array.isArray(v.reminders) ? v.reminders.map(r => cleanRem(r, cats)).filter(Boolean) : [] };
    if (okNum(v.gaugeSteps) > 0 && okNum(v.gaugeSteps) <= 16) out.gaugeSteps = okNum(v.gaugeSteps);
    if (okId(v.nudged)) out.nudged = v.nudged;
    if (v.check && typeof v.check === 'object' && okDate(v.check.date))
      out.check = { date: v.check.date, range: okNum(v.check.range), odo: okNum(v.check.odo), fillId: okId(v.check.fillId) };
    return out;
  }
  // only real photos (base64 PNG/JPEG/WebP/GIF), never SVG or anything that could carry script
  const okPhoto = p => typeof p === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[\w+/=]+$/.test(p);

  /* ---------- trip cost ---------- */
  // distance between two points on the map, in km
  function distKm(a, b) {
    const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  // Roads in Malaysia are typically ~15–25% longer than a straight line between towns.
  const ROAD_FACTOR = 1.2;
  const roadKm = (a, b) => Math.round(distKm(a, b) * ROAD_FACTOR);
  const RESERVE_KM = 50; // plan to refuel with about this much left
  /* What a trip costs and whether you need to stop for fuel.
     km: one way. kmpl: your car's recent km/L. price: RM/L for the fuel you use.
     budiPrice + budiLeftL: subsidised price for the quota you have left (RON95 BUDI95), the rest at `price`.
     tankL: tank size; leftKm: km left in the tank now (if known). */
  function tripCost({ km, roundTrip = false, kmpl, price, budiPrice = 0, budiLeftL = 0, tankL = 0, leftKm = null, people = 1 }) {
    if (!(km > 0) || !(kmpl > 0) || !(price > 0)) return null;
    const dist = km * (roundTrip ? 2 : 1), litres = dist / kmpl;
    const budiL = budiPrice > 0 ? Math.min(litres, Math.max(0, budiLeftL)) : 0;
    const rm = budiL * budiPrice + (litres - budiL) * price;
    const fullRange = tankL > 0 ? tankL * kmpl : null;
    const start = leftKm ?? fullRange;
    let stops = null, firstStopKm = null, leftAtEnd = null;
    if (start != null) {
      const usable = Math.max(0, start - RESERVE_KM);
      if (dist <= usable) { stops = 0; leftAtEnd = start - dist; }
      else if (fullRange && fullRange > RESERVE_KM) { stops = Math.ceil((dist - usable) / (fullRange - RESERVE_KM)); firstStopKm = usable; }
    }
    return { dist, litres, rm, budiL, perPerson: people > 1 ? rm / people : null, stops, firstStopKm, leftAtEnd, fullRange };
  }

  /* ---------- year in review ---------- */
  /* s: one vehicle's fill-ups, oldest first (all years). L: its consumption stretches. costs: its car costs.
     isBudi(x): whether a fill-up was BUDI95. market − budiPrice is what the subsidy saved per litre. */
  function yearSummary({ s, L, costs = [], year, isBudi = () => false, budiPrice = 0, market = 0 }) {
    const y = String(year), inY = x => x.date.startsWith(y);
    const fills = s.filter(inY);
    if (!fills.length) return null;
    const spent = sum(fills, x => x.total), litres = sum(fills, x => x.litres);
    const before = s.filter(x => x.date < y + '-01-01').at(-1);
    const km = fills.at(-1).odo - (before ?? fills[0]).odo;
    const Ly = L.filter(inY), avg = avgOf(Ly);
    const best = Ly.length >= 2 ? Ly.reduce((a, b) => b.kmpl > a.kmpl ? b : a) : null;
    // most-used station (ignoring case and spacing)
    const st = {};
    fills.forEach(x => { const k = (x.station || '').trim().replace(/\s+/g, ' '); if (k) { const key = k.toLowerCase(); st[key] = st[key] || { name: k, n: 0 }; st[key].n++; } });
    const top = Object.values(st).sort((a, b) => b.n - a.n)[0] || null;
    const months = Array(12).fill(0); fills.forEach(x => months[+x.date.slice(5, 7) - 1] += x.total);
    const busiest = months.indexOf(Math.max(...months));
    const prices = fills.map(x => x.price).filter(p => p > 0);
    const budiL = sum(fills.filter(isBudi), x => x.litres), saved = budiL * Math.max(0, market - budiPrice);
    const cy = costs.filter(inY), costsTotal = sum(cy, c => c.amount);
    const prevFills = s.filter(x => x.date.startsWith(String(+year - 1))), prevSpent = sum(prevFills, x => x.total);
    return {
      year: +year, fills: fills.length, spent, litres, km: km > 0 ? km : 0, avg, best, top, months, busiest,
      minPrice: prices.length ? Math.min(...prices) : null, maxPrice: prices.length ? Math.max(...prices) : null,
      budiL, saved, costsTotal, costPerKm: km > 0 ? (spent + costsTotal) / km : null,
      vsLastYear: prevFills.length >= 3 && prevSpent > 0 ? (spent - prevSpent) / prevSpent : null,
    };
  }
  // years that have fill-ups, newest first
  const yearsWithData = s => [...new Set(s.map(x => +x.date.slice(0, 4)))].sort((a, b) => b - a);

  return {
    computeLegs, avgOf, paceOf, isBudiEntry, budiUsedIn, remDue, parseReceipt, csvText,
    FUELS, okId, okDate, okNum, okStr, cleanEntry, cleanCost, cleanRem, cleanVehicle, okPhoto,
    distKm, roadKm, ROAD_FACTOR, RESERVE_KM, tripCost, yearSummary, yearsWithData,
  };
});

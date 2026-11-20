// Tests for js/core.js. Run with:  node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/core.js');

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);
let n = 0;
const fill = (date, odo, litres, extra = {}) => ({ id: 'e' + ++n, date, odo, litres, total: litres * 2, price: 2, type: 'RON95', full: true, missed: false, before: null, after: null, ...extra });

test('full-to-full: km ÷ litres put in at the second full fill', () => {
  const s = [fill('2026-01-01', 1000, 30), fill('2026-01-10', 1400, 32)];
  const L = C.computeLegs(s, 0);
  assert.equal(L.length, 1);
  assert.equal(L[0].km, 400);
  near(L[0].kmpl, 12.5);
});

test('full-to-full: partial fills in between are added up', () => {
  const s = [fill('2026-01-01', 1000, 30), fill('2026-01-05', 1200, 10, { full: false }), fill('2026-01-10', 1500, 30)];
  const L = C.computeLegs(s, 0);
  assert.equal(L.length, 1);
  near(L[0].kmpl, 500 / 40);
});

test('gauge method: fuel used = (gauge after last fill − gauge before this one) × tank', () => {
  const s = [fill('2026-01-01', 1000, 30, { before: 25, after: 100 }), fill('2026-01-08', 1360, 30, { before: 25, after: 100 })];
  const L = C.computeLegs(s, 40); // 75% of 40 L = 30 L
  near(L[0].litres, 30);
  near(L[0].kmpl, 12);
});

test('gauge method works for partial fills when the tank size is known', () => {
  const s = [fill('2026-01-01', 1000, 20, { before: 50, after: 100, full: true }), fill('2026-01-05', 1240, 10, { before: 50, after: 75, full: false })];
  const L = C.computeLegs(s, 40); // used (100−50)% of 40 = 20 L for 240 km
  near(L[0].kmpl, 12);
});

test('"missed the previous fill-up" breaks the chain: no figure for that stretch', () => {
  const s = [fill('2026-01-01', 1000, 30), fill('2026-01-10', 1800, 30, { missed: true }), fill('2026-01-20', 2200, 32)];
  const L = C.computeLegs(s, 0);
  assert.deepEqual(L.map(l => l.km), [400]); // only 1800 → 2200
});

test('average km/L is total km ÷ total litres, not the average of averages', () => {
  near(C.avgOf([{ km: 100, litres: 10 }, { km: 300, litres: 20 }]), 400 / 30);
  assert.equal(C.avgOf([]), null);
});

test('pace: km per day over recent fill-ups', () => {
  const s = [fill('2026-01-01', 1000, 30), fill('2026-01-11', 1500, 30), fill('2026-01-21', 2000, 30)];
  near(C.paceOf(s), 50);
  assert.equal(C.paceOf(s.slice(0, 1)), null);
});

test('pace ignores fill-ups older than ~4 months', () => {
  const s = [fill('2025-01-01', 0, 30), fill('2026-01-01', 10000, 30), fill('2026-01-11', 10300, 30)];
  near(C.paceOf(s), 30);
});

test('BUDI95: marked fill-ups count; older RON95 at the subsidised price counts too', () => {
  assert.equal(C.isBudiEntry({ budi: true, type: 'RON97', price: 4 }, 1.99), true);
  assert.equal(C.isBudiEntry({ budi: false, type: 'RON95', price: 1.99 }, 1.99), false);
  assert.equal(C.isBudiEntry({ type: 'RON95', price: 1.99 }, 1.99), true);
  assert.equal(C.isBudiEntry({ type: 'RON95', price: 3.87 }, 1.99), false);
  const e = [fill('2026-11-01', 0, 40, { budi: true }), fill('2026-11-10', 400, 35, { budi: true }), fill('2026-10-30', 0, 40, { budi: true }), fill('2026-11-15', 800, 30, { budi: false })];
  assert.equal(C.budiUsedIn(e, '2026-11', 1.99), 75);
  assert.equal(C.budiUsedIn(e, '2026-11', 1.99, e[0].id), 35);
});

test('service reminders: km left and due date', () => {
  const r = C.remDue({ km: 5000, months: 6, lastKm: 40000, lastDate: '2026-06-15' }, 44200, '2026-11-20');
  assert.equal(r.kmLeft, 800);
  assert.equal(r.dueDate, '2026-12-15');
  assert.equal(r.daysLeft, 25);
});

test('service reminders: month-end dates don\'t spill into the next month', () => {
  assert.equal(C.remDue({ months: 1, lastDate: '2026-01-31' }, null, '2026-01-31').dueDate, '2026-02-28');
  assert.equal(C.remDue({ months: 12, lastDate: '2028-02-29' }, null, '2028-03-01').dueDate, '2029-02-28');
});

test('service reminders: overdue shows as negative', () => {
  const r = C.remDue({ km: 5000, lastKm: 40000, months: 1, lastDate: '2026-09-01' }, 45500, '2026-11-20');
  assert.equal(r.kmLeft, -500);
  assert.ok(r.daysLeft < 0);
});

test('receipt: Petronas-style receipt', () => {
  const r = C.parseReceipt(`PETRONAS JALAN AMPANG
  20/11/2026 08:41
  PRIMAX 95 BUDI95
  25.126 L @ RM1.99
  TOTAL RM 50.00
  CASH 50.00`, 2027);
  assert.equal(r.type, 'RON95');
  assert.equal(r.budi, true);
  near(r.litres, 25.126, 0.001);
  assert.equal(r.price, 1.99);
  assert.equal(r.total, 50);
  assert.equal(r.date, '2026-11-20');
});

test('receipt: Shell-style receipt with comma decimals and totals on the next line', () => {
  const r = C.parseReceipt(`SHELL BANGSAR
  2026-11-18
  V-POWER 97
  VOLUME 15,48
  UNIT PRICE 4,20
  SUBTOTAL 65,02
  TOTAL
  65,02`, 2027);
  assert.equal(r.type, 'RON97');
  near(r.litres, 15.48);
  assert.equal(r.price, 4.2);
  assert.equal(r.total, 65.02);
  assert.equal(r.date, '2026-11-18');
});

test('receipt: litres are recalculated when they don\'t match total ÷ price', () => {
  const r = C.parseReceipt('DIESEL\n9.99 L\n@ 2.15\nTOTAL 100.00', 2027);
  assert.equal(r.type, 'Diesel');
  near(r.litres, 100 / 2.15);
});

test('receipt: implausible prices and future years are ignored', () => {
  const r = C.parseReceipt('RON95\nPRICE 25.00\nTOTAL 40.00\n01/01/2035', 2027);
  assert.equal(r.price, undefined);
  assert.equal(r.date, undefined);
});

test('CSV: text is quoted and formulas are neutralised', () => {
  assert.equal(C.csvText('Shell, Bangsar'), '"Shell, Bangsar"');
  assert.equal(C.csvText('say "hi"'), '"say ""hi"""');
  assert.equal(C.csvText('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  for (const s of ['+1', '-1', '@SUM(A1)']) assert.ok(C.csvText(s).startsWith('"\''), s);
  assert.equal(C.csvText(null), '""');
});

const CATS = ['service', 'tyres', 'repair', 'insurance', 'roadtax', 'toll', 'parking', 'tng', 'other'];
const evil = '<img src=x onerror=alert(1)>';

test('import: a normal entry comes through unchanged', () => {
  const x = { id: 'abc-123', date: '2026-11-01', odo: 1000, total: 50, litres: 25, price: 2, type: 'RON95', before: 20, after: 100, full: true, missed: false, station: 'Shell', vehicleId: 'v1', budi: true, rangeBefore: 80, rangeAfter: 480, hasReceipt: true };
  assert.deepEqual(C.cleanEntry(x), { ...x, hasReceipt: false });
});

test('import: unsafe values are dropped or made harmless', () => {
  assert.equal(C.cleanEntry({ id: 'a" onmouseover="x', date: '2026-11-01' }), null);
  assert.equal(C.cleanEntry({ id: 'a', date: '<b>' }), null);
  assert.equal(C.cleanEntry({ id: 'a', date: '2026-13-45' }), null);
  assert.equal(C.cleanEntry(null), null);
  const e = C.cleanEntry({ id: 'a', date: '2026-11-01', total: evil, type: evil, odo: '1400', extra: 'x', __proto__: { polluted: 1 } });
  assert.equal(e.total, 0);
  assert.equal(e.type, 'Other');
  assert.equal(e.odo, 1400);
  assert.equal('extra' in e, false);
  assert.equal({}.polluted, undefined);
});

test('import: costs, vehicles and reminders are rebuilt', () => {
  const c = C.cleanCost({ id: 'c1', date: '2026-11-05', cat: '__proto__', amount: evil, note: 'ok', done: ['r1', 'bad id"'] }, CATS);
  assert.deepEqual(c, { id: 'c1', vehicleId: null, date: '2026-11-05', cat: 'other', amount: 0, odo: null, note: 'ok', done: ['r1'] });
  const v = C.cleanVehicle({ id: 'v1', name: 'Myvi', tank: '40"><img>', budget: 300, gaugeSteps: 99, reminders: [{ id: 'r1', name: 'Oil', km: '5000', cat: 'service' }, { id: 'bad"', name: 'x' }] }, CATS);
  assert.equal(v.tank, '');
  assert.equal(v.budget, '300');
  assert.equal(v.gaugeSteps, undefined);
  assert.deepEqual(v.reminders.map(r => [r.id, r.km, r.cat]), [['r1', 5000, 'service']]);
});

test('import: only real photos are accepted', () => {
  assert.ok(C.okPhoto('data:image/jpeg;base64,/9j/4AAQSkZJRg=='));
  assert.ok(!C.okPhoto('data:image/svg+xml,<svg onload=alert(1)>'));
  assert.ok(!C.okPhoto('javascript:alert(1)'));
  assert.ok(!C.okPhoto({}));
});

test('distance: KL to Ipoh is about 175 km in a straight line, ~210 km by road', () => {
  const kl = { lat: 3.139, lon: 101.687 }, ipoh = { lat: 4.597, lon: 101.09 };
  near(C.distKm(kl, ipoh), 175, 5);
  near(C.roadKm(kl, ipoh), 210, 8);
});

test('trip: litres and cost, no stop needed when the tank has enough', () => {
  const t = C.tripCost({ km: 200, kmpl: 12.5, price: 3.87, tankL: 40, leftKm: 400 });
  near(t.litres, 16);
  near(t.rm, 16 * 3.87);
  assert.equal(t.stops, 0);
  assert.equal(t.leftAtEnd, 200);
});

test('trip: round trip, BUDI95 quota covers part of it', () => {
  const t = C.tripCost({ km: 200, roundTrip: true, kmpl: 10, price: 3.87, budiPrice: 1.99, budiLeftL: 30 });
  assert.equal(t.dist, 400);
  near(t.litres, 40);
  near(t.rm, 30 * 1.99 + 10 * 3.87);
  assert.equal(t.stops, null); // tank unknown
});

test('trip: refuel stops for a long drive', () => {
  // full range 40 × 12 = 480 km; start with 200 km left → first stop after 150 km, then every 430 km
  const t = C.tripCost({ km: 700, kmpl: 12, price: 2, tankL: 40, leftKm: 200 });
  assert.equal(t.firstStopKm, 150);
  assert.equal(t.stops, 2);
  const solo = C.tripCost({ km: 100, kmpl: 10, price: 2, people: 4 });
  near(solo.perPerson, 5);
});

test('trip: nothing to show without distance, km/L or price', () => {
  assert.equal(C.tripCost({ km: 0, kmpl: 10, price: 2 }), null);
  assert.equal(C.tripCost({ km: 10, kmpl: null, price: 2 }), null);
});

test('year in review', () => {
  n = 0;
  const s = [
    fill('2025-12-20', 900, 30, { station: 'Shell Bangsar' }),
    fill('2026-01-05', 1000, 30, { station: 'Petronas Ampang', budi: true, price: 1.99, total: 59.7 }),
    fill('2026-02-05', 1400, 32, { station: 'petronas  ampang', budi: true, price: 1.99, total: 63.68 }),
    fill('2026-03-05', 1800, 30, { station: 'Shell Bangsar', type: 'RON97', price: 4.2, total: 126 }),
    fill('2026-03-25', 2250, 35, { station: 'Petronas Ampang', budi: true, price: 1.99, total: 69.65 }),
  ];
  const L = C.computeLegs(s, 0);
  const y = C.yearSummary({ s, L, costs: [{ date: '2026-04-01', amount: 300 }, { date: '2025-04-01', amount: 99 }], year: 2026, isBudi: x => !!x.budi, budiPrice: 1.99, market: 3.87 });
  assert.equal(y.fills, 4);
  near(y.spent, 59.7 + 63.68 + 126 + 69.65);
  assert.equal(y.km, 2250 - 900); // from the last fill-up before the year
  assert.equal(y.top.name, 'Petronas Ampang');
  assert.equal(y.top.n, 3);
  assert.equal(y.busiest, 2); // March
  assert.equal(y.minPrice, 1.99);
  assert.equal(y.maxPrice, 4.2);
  near(y.saved, 97 * (3.87 - 1.99));
  assert.equal(y.costsTotal, 300);
  assert.ok(y.best && y.best.kmpl >= y.avg);
  assert.equal(y.vsLastYear, null); // not enough fill-ups last year to compare
  assert.deepEqual(C.yearsWithData(s), [2026, 2025]);
  assert.equal(C.yearSummary({ s, L, year: 2024 }), null);
});

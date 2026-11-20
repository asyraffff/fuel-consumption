// Tests for the Bahasa Melayu translation (js/i18n.js). Run with:  node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8'), ctx);
const { trMS } = ctx.window.FUEL_LOG_MS;

test('exact phrases', () => {
  assert.equal(trMS('Close'), 'Tutup');
  assert.equal(trMS('Car costs'), 'Kos kereta');
});

test('surrounding spaces are kept (text nodes next to other elements)', () => {
  assert.equal(trMS('  Close '), '  Tutup ');
});

test('text with numbers uses the patterns', () => {
  assert.equal(trMS('3 days ago'), '3 hari lalu');
  assert.equal(trMS('8 steps'), '8 bahagian');
  assert.equal(trMS('12 fill-ups'), '12 isian');
});

test('icon in front of a known phrase', () => {
  assert.equal(trMS('🔧 Service'), '🔧 ' + trMS('Service'));
});

test('unknown text and numbers are left alone', () => {
  assert.equal(trMS('Zzzz qqq'), 'Zzzz qqq');
  assert.equal(trMS('42.5'), '42.5');
});

test('every fixed piece of text in the app has a Malay translation', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '../tools/check-i18n.mjs')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

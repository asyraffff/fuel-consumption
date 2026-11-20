// Lists English text that has no Bahasa Melayu translation in js/i18n.js.
//
// Usage:  node tools/check-i18n.mjs        (exits with code 1 if anything is missing, so it can run in CI)
//
// It checks what can be read without running the app:
//   - every piece of text, placeholder, aria-label and title in index.html
//   - fixed messages in js/app.js: toast('…'), confirm('…'), .textContent = '…', T('…'), and the text in HTML snippets
// Text built at run time (with numbers, names or dates in it) can't all be checked this way. For that, open the app
// with ?i18n=check in Malay mode, use it, and run fuelLogMissing() in the browser console.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const read = f => readFileSync(new URL(f, root), 'utf8');

const ctx = { window: {} }; vm.runInNewContext(read('js/i18n.js'), ctx);
const { trMS, SAME } = ctx.window.FUEL_LOG_MS;
const hasWords = t => /[A-Za-z]{2}/.test(t);
const missing = new Map();
const check = (text, where) => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || !hasWords(t) || missing.has(t) || SAME.has(t)) return;
  if (trMS(t) === t && !fragmentOk(t)) missing.set(t, where);
};
// Pieces of a sentence the app finishes at run time ("Spent in" + month, "than your average" + "."):
// fine if the finished form is translated.
const fragmentOk = t => [t + '.', t + ' November 2026', t + ' 12', '12 ' + t].some(x => trMS(x) !== x);
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

// Text nodes and attributes of an HTML snippet, skipping script/style/svg and anything marked lang="en" / translate="no".
function checkHtml(html, where) {
  html = html.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(\w+)\b[^>]*\b(?:lang="en"|translate="no")[^>]*>[\s\S]*?<\/\1>/gi, '');
  for (const m of html.matchAll(/\b(placeholder|aria-label|title)="([^"]*)"/g)) if (!m[2].includes('${')) check(decode(m[2]), `${where} [${m[1]}]`);
  for (const piece of html.replace(/<[^>]*>/g, '\n').split('\n')) check(decode(piece), where);
}

// index.html (without the <head>, which the app never shows as text)
checkHtml(read('index.html').replace(/^[\s\S]*<body>/, ''), 'index.html');

// js/app.js: fixed strings that end up on screen
const app = read('js/app.js');
const lineOf = i => app.slice(0, i).split('\n').length;
// L2('English', 'Malay') is already in both languages: skip anything inside it
const inL2 = [];
for (const m of app.matchAll(/\bL2\(/g)) {
  let depth = 0, i = m.index + 2;
  for (; i < app.length; i++) { if (app[i] === '(') depth++; else if (app[i] === ')' && --depth === 0) break; }
  inL2.push([m.index, i]);
}
const skipAt = i => inL2.some(([a, b]) => i > a && i < b);
const STR = String.raw`'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|\x60((?:[^\x60\\]|\\.)*)\x60`;
const unq = m => (m[1] ?? m[2] ?? m[3]).replace(/\\(.)/g, '$1');
// messages: toast('…'), confirm('…'), T('…'), .textContent = '…'  (template strings only if they have no ${…})
for (const m of app.matchAll(new RegExp(String.raw`(?:\btoast\(|\bconfirm\(|\bT\(|\.textContent\s*=\s*)(?:${STR})`, 'g'))) {
  const s = unq(m); if (skipAt(m.index) || (m[3] != null && s.includes('${'))) continue;
  check(s, `js/app.js:${lineOf(m.index)}`);
}
// HTML snippets: the text between tags, where it doesn't depend on a ${…} value
for (const m of app.matchAll(new RegExp(STR, 'g'))) {
  const s = unq(m); if (skipAt(m.index) || !/<[a-z][^>]*>/i.test(s)) continue;
  const fixed = s.replace(/\$\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '\u0000');
  for (const piece of fixed.replace(/<[^>]*>/g, '\n').split('\n')) if (!/\u0000|\$\{|^\s*\}/.test(piece)) check(decode(piece), `js/app.js:${lineOf(m.index)}`);
  for (const a of fixed.matchAll(/\b(?:placeholder|aria-label|title)="([^"\u0000]*)"/g)) check(decode(a[1]), `js/app.js:${lineOf(m.index)}`);
}

if (!missing.size) { console.log('All checked text has a Malay translation.'); process.exit(0); }
console.log(`${missing.size} piece(s) of text with no Malay translation (add them to MS in js/i18n.js):\n`);
for (const [t, where] of missing) console.log(`  ${where.padEnd(18)} ${JSON.stringify(t)}`);
process.exit(1);

// The app version must be the same in sw.js, index.html and js/app.js. When it isn't, installed copies keep an old
// cache (sw.js) or reload in a loop looking for the new page (index.html / app.js). Bump all three together.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('sw.js, index.html and js/app.js have the same version', () => {
  const sw = read('sw.js').match(/const VERSION = '([^']+)'/)?.[1];
  const html = read('index.html').match(/<meta name="app-version" content="([^"]+)">/)?.[1];
  const app = read('js/app.js').match(/const APP_VERSION = '([^']+)'/)?.[1];
  assert.ok(sw, 'VERSION not found in sw.js');
  assert.equal(html, sw, 'index.html <meta name="app-version"> should match sw.js');
  assert.equal(app, sw, 'APP_VERSION in js/app.js should match sw.js');
});

test('every file the app needs offline is in the service worker cache list', () => {
  const shell = read('sw.js').match(/const SHELL = \[([^\]]+)\]/)[1];
  const scripts = [...read('index.html').matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
  for (const f of [...scripts, 'css/app.css', 'stations.json']) assert.ok(shell.includes(`'./${f}'`), `${f} missing from SHELL in sw.js`);
});

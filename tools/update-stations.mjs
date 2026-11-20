// Downloads the latest petrol stations and place names in Malaysia from OpenStreetMap and rebuilds stations.json.
//
// Usage:  node tools/update-stations.mjs
//
// Runs every month as a GitHub Action (.github/workflows/stations.yml). It refuses to write a list that's much
// smaller than the current one (a failed or partial download), and leaves the file alone when nothing changed.
// Only public map data is downloaded; nothing is sent except the query.
import { readFileSync, writeFileSync } from 'node:fs';
import { build } from './build-stations.mjs';

const file = new URL('../stations.json', import.meta.url);
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const AREA = 'area["ISO3166-1"="MY"][admin_level=2]->.my;';
const QUERIES = {
  fuel: `[out:json][timeout:300];${AREA}nwr["amenity"="fuel"](area.my);out center tags;`,
  places: `[out:json][timeout:300];${AREA}node["place"~"^(city|town|suburb|village|quarter|neighbourhood)$"](area.my);out skel qt;out tags qt;`,
};

async function overpass(query) {
  let last;
  for (const url of SERVERS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST', body: new URLSearchParams({ data: query }),
          headers: { 'User-Agent': 'fuel-log-station-update (static PWA; monthly)' }, signal: AbortSignal.timeout(360_000),
        });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        if (!Array.isArray(json.elements) || !json.elements.length) throw new Error('empty result');
        return json.elements;
      } catch (e) {
        last = e; console.warn(`  ${new URL(url).host} (try ${attempt}): ${e.message}`);
        await new Promise(r => setTimeout(r, 15_000 * attempt));
      }
    }
  }
  throw new Error('all Overpass servers failed: ' + last?.message);
}

console.log('Downloading petrol stations…');
const fuel = await overpass(QUERIES.fuel);
console.log(`  ${fuel.length} stations. Downloading place names…`);
const places = await overpass(QUERIES.places);
console.log(`  ${places.length} place records.`);

const next = build(fuel, places);
let current = null;
try { current = JSON.parse(readFileSync(file, 'utf8')); } catch {}
const before = current?.stations?.length || 0, after = next.stations.length;
console.log(`Stations: ${before} → ${after}`);

if (after < 3000 || (before && after < before * 0.9)) {
  console.error('That is far fewer than expected, so the download was probably incomplete. stations.json was not changed.');
  process.exit(1);
}
if (current && JSON.stringify(current.stations) === JSON.stringify(next.stations)) {
  console.log('No changes.');
  process.exit(0);
}
writeFileSync(file, JSON.stringify(next));
console.log('stations.json updated.');

// Builds stations.json: every petrol station in Malaysia from OpenStreetMap, tagged with its nearest area and town
// so the app can search ("shell bangsar") and find the nearest ones offline, without sending your location anywhere.
//
// Usage:  node tools/build-stations.mjs fuel.json places.json > stations.json
//   fuel.json   = Overpass: area["ISO3166-1"="MY"][admin_level=2]->.my; nwr["amenity"="fuel"](area.my); out center tags;
//   places.json = Overpass: same area; node["place"~"^(city|town|suburb|village|quarter|neighbourhood)$"](area.my); out skel qt; out tags qt;
// Data © OpenStreetMap contributors, ODbL.
import { readFileSync } from 'node:fs';

const [fuelFile, placesFile] = process.argv.slice(2);
const fuel = JSON.parse(readFileSync(fuelFile, 'utf8')).elements;
const raw = JSON.parse(readFileSync(placesFile, 'utf8')).elements;

// places may come as two lists (coordinates, then tags): merge them by id
const byId = new Map();
raw.forEach(e => byId.set(e.id, Object.assign(byId.get(e.id) || {}, e)));
const places = [...byId.values()].filter(p => p.lat != null && p.tags?.name);
const local = places.filter(p => /^(suburb|quarter|neighbourhood|village|town|city)$/.test(p.tags.place));
const towns = places.filter(p => /^(town|city)$/.test(p.tags.place));

const km = (a, b) => {
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const nearest = (pt, list, max) => {
  let best = null, bd = max;
  for (const p of list) { if (Math.abs(p.lat - pt.lat) > 0.3 || Math.abs(p.lon - pt.lon) > 0.3) continue; const d = km(pt, p); if (d < bd) { bd = d; best = p; } }
  return best;
};

const BRANDS = [[/^petronas|^pretonas/i, 'Petronas'], [/^shell/i, 'Shell'], [/^petron\b/i, 'Petron'], [/^caltex/i, 'Caltex'],
  [/^bhp/i, 'BHPetrol'], [/^buraq/i, 'Buraq'], [/^five\b|^5\b/i, 'FIVE'], [/^smart|^smar5/i, 'Smart'], [/^petros\b/i, 'Petros'], [/^esso/i, 'Esso']];
const brandOf = t => { const s = t.brand || t.name || ''; for (const [re, b] of BRANDS) if (re.test(s)) return b; return t.brand || ''; };

const out = [];
for (const e of fuel) {
  const pt = e.type === 'node' ? { lat: e.lat, lon: e.lon } : e.center;
  if (!pt) continue;
  const t = e.tags || {}, brand = brandOf(t);
  // the part of the name that says which station it is, e.g. "Petronas Jalan Ampang" -> "Jalan Ampang"
  let detail = (t.name || '').trim();
  if (brand && detail.toLowerCase().startsWith(brand.toLowerCase())) detail = detail.slice(brand.length).replace(/^[\s\-–,·]+/, '');
  if (!detail || detail.toLowerCase() === brand.toLowerCase()) detail = t.branch || '';
  if (!brand && !detail) detail = 'Petrol station';
  const street = t['addr:street'] || '';
  const area = nearest(pt, local, 3)?.tags.name || '';
  const town = t['addr:city'] || nearest(pt, towns, 25)?.tags.name || '';
  out.push([+pt.lat.toFixed(5), +pt.lon.toFixed(5), brand, detail, street, area === town ? '' : area, town]);
}
out.sort((a, b) => a[2].localeCompare(b[2]) || a[6].localeCompare(b[6]));
process.stdout.write(JSON.stringify({
  source: 'OpenStreetMap contributors (ODbL), ' + new Date().toISOString().slice(0, 10),
  fields: ['lat', 'lon', 'brand', 'name', 'street', 'area', 'town'],
  stations: out,
}));

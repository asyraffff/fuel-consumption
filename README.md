# ⛽ Fuel Log

A simple, phone-first app for logging every time you **isi minyak**: scan the receipt, note the odometer and fuel gauge, and see your fuel consumption and how much you spend.

**Open the app:** https://asyraffff.github.io/fuel-consumption/

No sign-up, no server, no ads. Everything stays on your phone.

---

## Features

**Logging a fill-up**
- 📷 **Scan the receipt.** Reads the total (RM), litres, price per litre, fuel type and date. You check the values before saving.
- Fill in any two of *total / litres / RM per litre* and the third is worked out. **RM per litre is filled in for you**: the BUDI95 price while you have quota, otherwise the last price you paid for that fuel, so usually typing the total is enough.
- **Fuel type** is a row of buttons (RON95 · RON97 · RON100 · Diesel · Other), and your **recent stations** are one tap away.
- **Odometer** with a "+420 km since your last fill-up" hint and a warning for likely typos.
- **Fuel gauge before and after.** The picker shows the same marks as your dashboard's fuel gauge (8 steps from 0 to 1 by default; set the number of steps per vehicle in Settings). Tap the mark the needle points to.
- **BUDI95 toggle** for RON95: fills in the subsidised price (RM 1.99/L) and shows how much of your monthly quota is left. Untick it when you're over the quota and it switches to the unsubsidised price.
- **Range on dashboard (optional)**: the km figure beside your car's fuel gauge, before and after the fill.
- **Petrol station search**: type e.g. *shell bangsar* to search all ~3,900 stations in Malaysia, or tap **📍 Near me** for the 5 nearest. If you've allowed location before, the station you're standing at (within 300 m) is filled in when you open the form. Searching and distances are worked out on the phone; your location is never sent anywhere. You can still type anything.
- Date, fuel type, station and "I missed logging the previous fill-up" are folded under **More**. The last fuel type and station are remembered.
- After saving you get one line on how that tank did, e.g. *"14.0 km/L, 19% better than your average."*

**Home**
- **Reminders** at the top, one at a time: if it's been much longer than usual since your last fill-up (or the estimate says your tank should be empty), it asks whether you forgot to log one; and once you have 5+ fill-ups it reminds you to back up every 30 days.
- **Spent this month** with an optional **monthly budget** bar. The bar turns orange when you're on pace to go over and red once you have.
- **Average consumption** (km/L or L/100 km).
- **BUDI95 quota bar**: litres used out of your monthly quota (shared across all your vehicles) and roughly how much the subsidy saved you.
- **Dashboard-style fuel gauge** with an estimate of **km left** and **when your next fill-up is due**. A warning appears under 60 km. Tap **Update** to enter the range (and odometer) your dashboard shows right now, and the estimate follows your car.
- **Insights** (only when there's something to say): this week's pump price change for the fuels you use; a warning when your last 2 tanks are 15%+ worse than usual (check tyre pressure, or a service may be due); and, once you've tried both, how RON97 compares with RON95 in your car in km/L and RM per km.
- **Coming up**: service reminders that are due within 1,000 km or 30 days, with a **Done** button. The card only appears when something is due.
- An overview for *Month / 3 months / Year / All*: fuel spent, litres, fuel cost per km, best and worst km/L, and, once you log car costs, **car costs** and **all-in cost per km**.
- **Share report**: turns the period you picked into an image (fuel, each type of car cost, distance, consumption, cost per km, BUDI95 saved, a per-month chart) to send on WhatsApp or keep.
- One chart with tabs: **Spending** per month, **Price per litre** trend, **km/L** per fill-up.

**Trip cost** (🧭 on Home)
- Pick where you're going from and to (any town or area in Malaysia, or **📍 Where I am**), or just type the distance.
- See what the drive costs with **your car's own km/L** and this week's pump price. For RON95 with BUDI95, the litres your remaining quota covers are counted at RM 1.99.
- Tick **Return trip** for pergi balik, and set **People sharing** to split the cost.
- It tells you whether you'll make it on what's in the tank, or how many times to refuel and when the first stop is due.
- Distances between towns are estimated (straight line + 20%), so change the km if you know the road distance. It works offline: the towns come from the station list.

**Year in review**
- A picture of your year to share on WhatsApp: total spent on fuel, fill-ups, distance, consumption and your best tank, favourite station, BUDI95 saved, car costs, the range of prices you paid, a month-by-month chart, and how it compares with last year.
- Appears on Home in December and January (hide it with ×), and any time from **Settings → Data → Year in review**, for any year you've logged.

**Car costs and service reminders**
- Log **service, tyres, repair, insurance, road tax, toll, parking, TNG reloads** and other costs from **+ Car cost** on Home or the **Car costs** tab in History.
- **Service reminders** per vehicle (Settings): every so many km and/or months, whichever comes first. Quick picks for oil change, road tax, insurance, tyre rotation, battery and brake check. The current odometer is estimated from your fill-ups and how much you usually drive.
- Logging a cost can tick off a reminder (e.g. a Service cost marks the oil change done).

**History**
- Two tabs: **Fuel** and **Car costs**.
- Grouped by month with monthly totals.
- Tap a fill-up to edit it, swipe left to delete (with Undo), and tap 🧾 to see the receipt photo.

**Other**
- **Multiple vehicles** (car, motorbike…), each with its own tank size, budget and history. Switch from the top bar.
- **Day / night mode**: follows your phone, or set it yourself with the 🌙/☀️ button. Night mode is modelled on a car's instrument cluster at night.
- **Works offline** and installs to your home screen like a normal app.
- Export a **backup (JSON, includes car costs)** or **CSV** (fill-ups, plus a second file for car costs), and import a backup on another phone. On a phone, Back up opens the share sheet so you can save it straight to Google Drive, Files or WhatsApp.
- **Home-screen shortcuts** (Android): long-press the app icon for **Isi minyak** or **Update range**.

## How consumption is worked out

| Method | Used when | Fuel used between two fill-ups |
|---|---|---|
| **Gauge** | Tank capacity is set and both gauge readings were recorded | (gauge after last fill − gauge before this fill) × tank capacity |
| **Full-to-full** | The fill-up was to a full tank | Litres added since the previous full-tank fill-up |

km/L = distance on the odometer ÷ fuel used. If you skipped logging a fill-up, tick *"I missed logging the fill-up before this one"* so that stretch doesn't skew your average.

The **range and next fill-up** estimates use, in order of preference: the range you entered with **Update**, the dashboard range you logged after the last fill, or the gauge level × tank × your recent km/L. Distance driven since then comes from the odometer you entered, or from how far you usually drive per day. Next fill-up is when you'd reach the range you usually refill at. They are estimates; your car's dashboard is the real reading.

## Made for Malaysia

**BUDI95.** Eligible Malaysians pay **RM 1.99/L for RON95** up to a monthly quota (**300 L** from 1 Sep 2026; e-hailing drivers get 800 L). Above the quota you pay the unsubsidised price, which changes weekly. Set it up under **Settings → BUDI95 subsidy**. The quota is per person, so the app counts fill-ups across all your vehicles. Home warns you when you have about one fill of quota left, and when it's used up. Receipts that mention BUDI or SUBSIDI are tagged automatically when scanned.

**Weekly pump prices.** When you're online, the app checks the official weekly prices on [data.gov.my](https://data.gov.my/data-catalogue/fuelprice) (RON95, RON95 BUDI95, RON97, diesel) and uses them to fill in RM/litre and the unsubsidised RON95 price. You can see them under **Settings → Pump prices**. Only the price list is downloaded; nothing about you is sent.

**Touch 'n Go.** Log TNG reloads as a car cost if that's easier than logging each toll and parking.

**Bahasa Melayu.** Switch the language under **Settings → Display → Language**. Phones set to Malay open in Bahasa Melayu.

## Install on your phone

1. Open https://asyraffff.github.io/fuel-consumption/ on your phone.
2. **Android (Chrome):** menu ⋮ → **Install app** (or *Add to Home screen*).
   **iPhone (Safari):** Share → **Add to Home Screen**.
3. Open it from the new icon. It works offline after the first visit. The receipt reader downloads once, the first time you scan.

## Your data

- Fill-ups and settings are saved in your browser's storage on **this device only**. Receipt photos are kept in the browser's IndexedDB.
- Nothing is uploaded anywhere. Receipt scanning runs on the phone using [Tesseract.js](https://github.com/naptha/tesseract.js). Your location (only if you use **Near me** or allow it) stays on the phone too.
- The app asks the browser to keep its data permanently. **Settings → Data** shows whether it agreed; installed apps usually get it.
- Clearing your browser data or uninstalling the app still deletes your log, so use **Settings → Export backup** now and then. Tick **Include receipt photos in backups** to bring the photos along (the file gets bigger).
- **Importing a backup is safe even if someone else made the file:** only the fields the app knows are kept, numbers must be numbers, and only real photos are accepted. The page also has a security policy that only lets scripts load from the app itself and the receipt reader's CDN, and the receipt reader is checked against a known fingerprint before it runs. CSV exports put a `'` in front of text starting with `=`, `+`, `-` or `@`, so Excel and Sheets don't treat it as a formula.
- The petrol station list is from [OpenStreetMap](https://www.openstreetmap.org/copyright) © OpenStreetMap contributors, available under the ODbL.

## Tests

```bash
node --test
```

Needs Node.js 20 or newer and nothing else (no npm install). The tests cover:
- the consumption maths (gauge and full-to-full);
- the km per day and range estimates;
- BUDI95 quota counting;
- service reminder due dates;
- reading receipts;
- CSV export;
- safe backup import;
- trip cost and Year in review.

They also run the translation check. GitHub runs the tests on every push (`.github/workflows/tests.yml`).

**Translation check.** `node tools/check-i18n.mjs` lists any fixed text in `index.html` and `js/app.js` that has no Malay translation. Text built while the app runs (with numbers, names or dates in it) can only be checked live:
1. Open the app with `?i18n=check` in Malay mode, e.g. http://localhost:8123/?i18n=check.
2. Go through the screens.
3. Run `fuelLogMissing()` in the browser console.

## Running it locally

It's a static site with no build step.

```bash
python -m http.server 8123
```

Then open http://localhost:8123. Use a local server rather than opening `index.html` directly, because offline mode and installing need `http://`.

## Project structure

```
index.html                 Layout: every screen and dialog
css/app.css                Styles, including day and night colours
js/app.js                  The app: screens, logging, charts, reminders, backups, trip cost, year in review
js/core.js                 The calculations, with no screen code (so they can be tested)
js/i18n.js                 Bahasa Melayu: exact phrases and patterns for text with numbers
js/theme.js                Applies day/night before the page paints
stations.json              Petrol stations in Malaysia (from OpenStreetMap)
tools/update-stations.mjs  Downloads the latest stations from OpenStreetMap and rebuilds stations.json
tools/build-stations.mjs   Turns the OpenStreetMap download into stations.json
tools/check-i18n.mjs       Lists text with no Malay translation
tests/                     Tests (node --test)
.github/workflows/         Tests on every push; station list update every month
sw.js                      Service worker: offline support and caching
manifest.webmanifest       App name, colours, icons and home-screen shortcuts
icons/                     App icons
```

**Adding text:** write it in English in `index.html` or `js/app.js`, then add the same text with its Malay translation to `MS` in `js/i18n.js`. Anything missing just shows in English.

**Updating the station list:** this happens by itself. On the 1st of every month a GitHub Action runs `tools/update-stations.mjs` and commits `stations.json` if any stations were added, moved or closed. You can also run it from **GitHub → Actions → Update petrol stations → Run workflow**, or locally with `node tools/update-stations.mjs`. It won't overwrite the list if the download looks incomplete.

## Deploying

The site is served by **GitHub Pages** from the `main` branch (root folder). Pushing to `main` publishes within a minute or two.

When you change the app, bump the version so installed copies drop their old cache and pick up the new version. It's in three places, which must match (`node --test` checks):
- `VERSION` in `sw.js`;
- `<meta name="app-version">` in `index.html`;
- `APP_VERSION` in `js/app.js`.

If a phone's browser still hands out the old page from its cache, the new code notices the mismatch and reloads once to get the new page.

**Security policy:** `index.html` has a Content Security Policy. Don't add inline `<script>` blocks or `onclick=` attributes (they'd be blocked); put code in `js/`. If you upgrade tesseract.js, update its `integrity` hash too, or the receipt reader won't load. Any new outside site the app talks to must be added to the policy's `connect-src`.

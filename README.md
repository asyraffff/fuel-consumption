# ⛽ Fuel Log

A simple, phone-first app for logging every time you **isi minyak**: scan the receipt, note the odometer and fuel gauge, and see your fuel consumption and how much you spend.

**Open the app:** https://asyraffff.github.io/fuel-consumption/

No sign-up, no server, no ads. Everything stays on your phone.

---

## Features

**Logging a fill-up**
- 📷 **Scan the receipt.** Reads the total (RM), litres, price per litre, fuel type and date. You check the values before saving.
- Fill in any two of *total / litres / RM per litre* and the third is worked out.
- **Odometer** with a "+420 km since your last fill-up" hint and a warning for likely typos.
- **Fuel gauge before and after.** The picker shows the same marks as your dashboard's fuel gauge (8 steps from 0 to 1 by default; set the number of steps per vehicle in Settings). Tap the mark the needle points to.
- **BUDI95 toggle** for RON95: fills in the subsidised price (RM 1.99/L) and shows how much of your monthly quota is left. Untick it when you're over the quota and it switches to the unsubsidised price.
- **Range on dashboard (optional)**: the km figure beside your car's fuel gauge, before and after the fill.
- Date, fuel type, station and "I missed logging the previous fill-up" are folded under **More**. The last fuel type and station are remembered.
- After saving you get one line on how that tank did, e.g. *"14.0 km/L, 19% better than your average."*

**Home**
- **Spent this month** with an optional **monthly budget** bar. The bar turns orange when you're on pace to go over and red once you have.
- **Average consumption** (km/L or L/100 km).
- **BUDI95 quota bar**: litres used out of your monthly quota (shared across all your vehicles) and roughly how much the subsidy saved you.
- **Dashboard-style fuel gauge** with an estimate of **km left** and **when your next fill-up is due**. A warning appears under 60 km. Tap **Update** to enter the range (and odometer) your dashboard shows right now, and the estimate follows your car.
- An overview for *Month / 3 months / Year / All*: spent, litres, cost per km, best and worst km/L.
- One chart with tabs: **Spending** per month, **Price per litre** trend, **km/L** per fill-up.

**History**
- Grouped by month with monthly totals.
- Tap a fill-up to edit it, swipe left to delete (with Undo), and tap 🧾 to see the receipt photo.

**Other**
- **Multiple vehicles** (car, motorbike…), each with its own tank size, budget and history. Switch from the top bar.
- **Day / night mode**: follows your phone, or set it yourself with the 🌙/☀️ button. Night mode is modelled on a car's instrument cluster at night.
- **Works offline** and installs to your home screen like a normal app.
- Export a **backup (JSON)** or **CSV**, and import a backup on another phone.

## How consumption is worked out

| Method | Used when | Fuel used between two fill-ups |
|---|---|---|
| **Gauge** | Tank capacity is set and both gauge readings were recorded | (gauge after last fill − gauge before this fill) × tank capacity |
| **Full-to-full** | The fill-up was to a full tank | Litres added since the previous full-tank fill-up |

km/L = distance on the odometer ÷ fuel used. If you skipped logging a fill-up, tick *"I missed logging the fill-up before this one"* so that stretch doesn't skew your average.

The **range and next fill-up** estimates use, in order of preference: the range you entered with **Update**, the dashboard range you logged after the last fill, or the gauge level × tank × your recent km/L. Distance driven since then comes from the odometer you entered, or from how far you usually drive per day. Next fill-up is when you'd reach the range you usually refill at. They are estimates; your car's dashboard is the real reading.

## BUDI95 (Malaysia)

Under BUDI95, eligible Malaysians pay **RM 1.99/L for RON95** up to a monthly quota (**300 L** from 1 Sep 2026; e-hailing drivers get 800 L). Above the quota you pay the unsubsidised price, which changes weekly. Set these under **Settings → BUDI95 subsidy**: whether you get it, your quota, the subsidised price and the current unsubsidised price. The quota is per person, so the app counts fill-ups across all your vehicles. Receipts that mention BUDI or SUBSIDI are tagged automatically when scanned.

## Install on your phone

1. Open https://asyraffff.github.io/fuel-consumption/ on your phone.
2. **Android (Chrome):** menu ⋮ → **Install app** (or *Add to Home screen*).
   **iPhone (Safari):** Share → **Add to Home Screen**.
3. Open it from the new icon. It works offline after the first visit. The receipt reader downloads once, the first time you scan.

## Your data

- Fill-ups and settings are saved in your browser's storage on **this device only**. Receipt photos are kept in the browser's IndexedDB.
- Nothing is uploaded anywhere. Receipt scanning runs on the phone using [Tesseract.js](https://github.com/naptha/tesseract.js).
- Clearing your browser data or uninstalling the app deletes your log, so use **Settings → Export backup** now and then. Backups don't include receipt photos.

## Running it locally

It's a single static page with no build step.

```bash
python -m http.server 8123
```

Then open http://localhost:8123. Use a local server rather than opening `index.html` directly, because offline mode and installing need `http://`.

## Project structure

```
index.html            The whole app: layout, styles and script
sw.js                 Service worker: offline support and caching of the receipt reader
manifest.webmanifest  App name, colours and icons for installing
icons/                App icons
```

## Deploying

The site is served by **GitHub Pages** from the `main` branch (root folder). Pushing to `main` publishes within a minute or two.

When you change the app, bump `VERSION` in `sw.js` so installed copies drop their old cache and pick up the new version.

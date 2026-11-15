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
- **Fuel gauge before and after** (E ¼ ½ ¾ F), tapped from what your dashboard shows.
- Date, fuel type, station and "I missed logging the previous fill-up" are folded under **More**. The last fuel type and station are remembered.
- After saving you get one line on how that tank did, e.g. *"14.0 km/L, 19% better than your average."*

**Home**
- **Spent this month** with an optional **monthly budget** bar. The bar turns orange when you're on pace to go over and red once you have.
- **Average consumption** (km/L or L/100 km).
- **Dashboard-style fuel gauge** with an estimate of **km left** and **when your next fill-up is due**.
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

The **range and next fill-up** estimates use your recent km/L, how far you usually drive per day and the gauge level you usually refill at. They are estimates; the gauge in your car is the real reading.

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

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
- Date, fuel type, station and "I missed logging the previous fill-up" are folded under **More**. The last fuel type and station are remembered.
- After saving you get one line on how that tank did, e.g. *"14.0 km/L, 19% better than your average."*

**Home**
- **Reminders** at the top, one at a time: if it's been much longer than usual since your last fill-up (or the estimate says your tank should be empty), it asks whether you forgot to log one; and once you have 5+ fill-ups it reminds you to back up every 30 days.
- **Spent this month** with an optional **monthly budget** bar. The bar turns orange when you're on pace to go over and red once you have.
- **Average consumption** (km/L or L/100 km).
- **BUDI95 quota bar**: litres used out of your monthly quota (shared across all your vehicles) and roughly how much the subsidy saved you.
- **Dashboard-style fuel gauge** with an estimate of **km left** and **when your next fill-up is due**. A warning appears under 60 km. Tap **Update** to enter the range (and odometer) your dashboard shows right now, and the estimate follows your car.
- **Coming up**: service reminders that are due within 1,000 km or 30 days, with a **Done** button. The card only appears when something is due.
- An overview for *Month / 3 months / Year / All*: fuel spent, litres, fuel cost per km, best and worst km/L, and, once you log car costs, **car costs** and **all-in cost per km**.
- **Share report**: turns the period you picked into an image (fuel, each type of car cost, distance, consumption, cost per km, BUDI95 saved, a per-month chart) to send on WhatsApp or keep.
- One chart with tabs: **Spending** per month, **Price per litre** trend, **km/L** per fill-up.

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

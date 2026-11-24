# TRENCHES 98

A personal nutrition and training app for a football **defensive lineman (DE / DT)**. It looks like a Windows 98 program.
It installs to your phone's home screen like a real app, works offline, and updates itself when new code is pushed.

**Live app:** https://wesfa.github.io/2025-day-1/ (after GitHub Pages is turned on, see below)

## What it does

| Screen | Features |
| --- | --- |
| **Today** | Daily weigh-in box, calories/protein/carbs/fat progress bars, water tracker, one-tap meal logging, "Coach says" food suggestions to close your protein/calorie gap, today's workout |
| **Food** | Breakfast/Lunch/Dinner/Snacks diary, 140+ built-in foods (incl. fast food), online search (Open Food Facts), barcode scanner, Recent, Favorites, saved meals, copy yesterday's meal, quick add, custom foods |
| **Gym** | 4-day DE/DT off-season program (power cleans, squats, bench, get-offs, hand fighting, neck work…), live workout logger (sets × reps × weight), "last time" numbers, progressive-overload suggestions, auto rest timer, PR detection, coaching cues, plate calculator, editable program |
| **Weight** | Daily log, 7-day average, pixel chart, goal progress, weekly trend, projected goal date |
| **Reminders** | Your school/work blocks, reminders that move around them, real push notifications via the free **ntfy** app, or a calendar file |
| **Control Panel** | Profile, auto-calculated macro targets (or enter your own), 5 color schemes, backup export/import |

Macro targets: Mifflin-St Jeor BMR × training-phase activity factor, ±500 kcal per lb/week of goal change; ~1 g protein per lb, 25% fat, the rest carbs.

## Put it on your phone

1. **Turn on GitHub Pages (one time):** repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   pick the branch the app lives on and the `/ (root)` folder, then **Save**. Wait about 1 minute.
2. **iPhone:** open the link in **Safari** → **Share** → **Add to Home Screen** → **Add**.
   **Android:** open it in **Chrome** → **⋮** → **Install app**.
3. Open it from the new icon and run the setup wizard.

> On iPhone the home-screen app keeps its own storage, separate from Safari. Always log from the icon.
> Data stays on the phone. Use **Control Panel → Export backup** now and then.

## Notifications

iPhones don't let websites schedule alarms on their own, so the app gives you two options:

- **Phone alerts (recommended):** install the free **ntfy** app, then go to **Reminders → Set up phone alerts**. Each time you open Trenches, it queues the next ~2 days of reminders on ntfy.sh.
  Only the reminder text ("Log lunch") is sent. Food and weight data never leave the phone.
- **Calendar file:** **Reminders → Download calendar file** adds repeating events with alerts to your calendar.

## Updating

Every push to the deployed branch updates the live site. The installed app checks for updates when it opens and shows
**"Update available → Restart now"**.

**Dev note:** bump `VERSION` in `sw.js` (and `APP_VERSION` in `js/settings.js`) on every change, or phones keep the cached copy.

## Tech

Plain HTML/CSS/JS ES modules with no build step and no dependencies. A service worker makes it work offline, and data is stored in `localStorage`.
Fonts: DotGothic16 and VT323 (SIL Open Font License). Food search: [Open Food Facts](https://world.openfoodfacts.org) (ODbL).
Barcode scanning uses the browser's BarcodeDetector, or loads `html5-qrcode` on demand.

Test locally with `python3 -m http.server` and open http://localhost:8000.

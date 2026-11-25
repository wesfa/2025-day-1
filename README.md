# MACROS 98

A personal food, training and weight app (with a DE / DT lifting program built in). Quiet see-through panels with
amber line icons over an original pixel-art city at dusk (hazy megastructure, glowing glyph signs, water reflections).
Formerly called Trenches.
It installs to your phone's home screen like a real app, works offline, and updates itself when new code is pushed.

**Live app:** https://wesfa.github.io/2025-day-1/ (after GitHub Pages is turned on, see below)

## What it does

| Screen | Features |
| --- | --- |
| **Today** | Daily weigh-in box, calories/protein/carbs/fat progress bars with a smaller fiber/sodium/potassium strip underneath, one-tap meal logging, "Coach says" food suggestions to close your protein/calorie gap, today's workout |
| **AI Food Scanner** | Snap a photo and/or describe a meal; Claude lists each item with estimated calories, protein, carbs and fat. You review and edit before adding. Needs your own Claude API key |
| **Food** | Breakfast/Lunch/Dinner/Snacks diary, 140+ built-in foods (incl. fast food), online search (Open Food Facts), barcode scanner, Recent, Favorites, saved meals, copy yesterday's meal, quick add, custom foods |
| **Gym** | 4-day DE/DT off-season program (power cleans, squats, bench, get-offs, hand fighting, neck work…), live workout logger (sets × reps × weight), "last time" numbers, progressive-overload suggestions, auto rest timer, PR detection, coaching cues, plate calculator, editable program |
| **Weight** | Daily log, 7-day average, pixel chart, goal progress, weekly trend, projected goal date |
| **Reminders** | Weekly school/work blocks plus dated exceptions (no school, early dismissal, out of town), reminders that move around them (after-school fuel, plus a Lift day reminder on your lift days), a 7-day preview, schedule-file import, real push notifications via the free **ntfy** app, or a calendar file |
| **Gridlock** | An original 8x8 block-puzzle game (Start menu or Today): drag three pieces at a time onto the grid, clear full rows and columns, chain clears for combos, and empty the board for a bonus. Saves your game and best score |
| **Control Panel** | Profile, auto-calculated macro targets (or enter your own), 8 color schemes (default **Dusk City**: amber pixel city with light beams, rising embers and shimmering water, minimal panels and amber glyph icons; **Meadow**: pixel hill-and-sky with glossy blue windows; **Island**: pixel beach with twinkling water), backup export/import |

Macro targets: Mifflin-St Jeor BMR × training-phase activity factor, ±500 kcal per lb/week of goal change; ~1 g protein per lb, 25% fat, the rest carbs.
Fiber and potassium are daily goals by age and sex (fiber 38 g, potassium 3,000 mg for teen guys). Sodium is a 2,300 mg max with +1,000 mg on training days for sweat losses.
Built-in foods carry all three values, as do Open Food Facts results when the label lists them and AI estimates. Entries without them are counted and called out.

Training-day / rest-day targets (on by default): the same weekly total, shifted toward lift/practice days. Training and rest days are
15% of the average apart, and the difference is all carbs. Planned lift days come from Control Panel, a finished workout makes that day a
training day, and any day can be switched on Today.

## Put it on your phone

1. **Turn on GitHub Pages (one time):** repo **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   pick the branch the app lives on and the `/ (root)` folder, then **Save**. Wait about 1 minute.
2. **iPhone:** open the link in **Safari** → **Share** → **Add to Home Screen** → **Add**.
   **Android:** open it in **Chrome** → **⋮** → **Install app**.
3. Open it from the new icon and run the setup wizard.

> On iPhone the home-screen app keeps its own storage, separate from Safari. Always log from the icon.
> Data stays on the phone. Use **Control Panel → Export backup** now and then.
> **Removing the app from the home screen deletes its data.** To move to a new icon (for example to pick up a new app icon,
> which iPhones only fetch when you add the app): **Control Panel → Export backup** on the old icon, add the new icon, tap
> **Restore from a backup** on the first setup screen, check everything is there, then remove the old icon.

## Data safety

- Every save goes to `localStorage` and to an IndexedDB mirror (`js/vault.js`). At startup, if the main copy is missing, unreadable or older than the mirror, the app restores from the mirror. Unreadable data is set aside under another key, never overwritten.
- Restore points are taken automatically: before every app update and once a day (the last 14 are kept). **Control Panel → Restore points → Add back** merges one in.
- **Import backup** defaults to **Merge**, which adds what's missing and never deletes what's on the phone. **Replace** is still available and asks twice.

## Notifications

iPhones don't let websites schedule alarms on their own, so the app gives you two options:

- **Phone alerts (recommended):** install the free **ntfy** app, then go to **Reminders → Set up phone alerts**. Each time you open Macros, it queues the next ~2 days of reminders on ntfy.sh.
  Only the reminder text ("Log lunch") is sent. Food and weight data never leave the phone.
- **Calendar file:** **Reminders → Download calendar file** adds repeating events with alerts to your calendar.

## Schedule files

**Reminders → Import schedule file** loads a JSON file (or pasted text) shaped like
`{"type": "macros-schedule", "busy": [{"label", "kind": "school"|"work"|"other", "days": [1..5], "start", "end"}], "dates": [{"label", "kind": "off"|"early"|"away", "from", "to", "end"}]}`.
School blocks in the file replace your school blocks, and dates are added or updated by `id`. Personal schedules are kept out of this public repo,
so they're shared as files instead of committed.

## AI Food Scanner

Tap **Snap a photo - AI logs it** on Today (also in Food, Add Food, and the Start menu). The photo is shrunk to about 1 MP on the phone,
then sent with your description straight to the Claude API (`claude-opus-5-5` by default; Sonnet 5.5 and Haiku 5.5 are selectable in Control Panel).
The answer comes back as structured JSON (`output_config.format`), with server-side refusal fallback enabled on Opus/Sonnet.

Setup: create an API key at **platform.claude.com** (Claude Console) with a little credit, and paste it into the scanner or **Control Panel → AI Food Scanner**.
Cost is roughly 2-3 cents per photo on Opus 5.5, and much less on Haiku. The key is stored in its own `localStorage` entry on the phone and is not part of backups.
Set a monthly spend limit in the Console. The app shows this month's scans and estimated spend.

## Updating

Every push to the deployed branch updates the live site. The installed app checks for updates when it opens and shows
**"Update available → Restart now"**.

**Dev note:** bump `VERSION` in `sw.js` (and `APP_VERSION` in `js/settings.js`) on every change, or phones keep the cached copy.

## Art

All art is original pixel art generated by `python3 tools/make_art.py` (Pillow):

- **Home-screen icon** (`tools/key_icon.py`): a boulder resting between two hazy blue-grey peaks, an homage to the idea of
  Magritte's *The Glass Key*, drawn from scratch rather than copied from the painting.
- **Dusk City wallpaper** (`tools/dusk_art.py`): layered pieces (`art/d-*.png`) shown at 2 CSS px per art pixel. Sky, a
  banded sun and a stepped megastructure sit behind two skyline layers with lit windows and invented-glyph signs; water with
  reflections and a dock sit below. Everything is generated from fixed random seeds. The light beams pulse, embers drift up
  and the reflections shimmer. All three stop with the phone's reduced-motion setting.
- **Meadow and Island** pieces (`art/m-*.png` and the rest) are drawn as text, one character per pixel.

The Dusk icon set lives in `js/icons.js` (`DUSK`) as amber line glyphs; the app switches to it when the Dusk scheme is on.

## Tech

Plain HTML/CSS/JS ES modules with no build step and no dependencies. A service worker makes it work offline, and data is stored in `localStorage`.
Fonts: DotGothic16 and VT323 (SIL Open Font License). Food search: [Open Food Facts](https://world.openfoodfacts.org) (ODbL).
Barcode scanning uses the browser's BarcodeDetector, or the bundled `html5-qrcode` (Apache-2.0).
AI uses the official `@anthropic-ai/sdk` (Apache-2.0), bundled into `js/vendor/anthropic-sdk.js` with esbuild and loaded only when the scanner is used.
No third-party scripts load at runtime.

Test locally with `python3 -m http.server` and open http://localhost:8000.

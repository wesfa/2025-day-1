# MACROS 98

A personal food, training and weight app (with a DE / DT lifting program built in). Quiet see-through panels with
amber line icons over an original pixel-art city on the water, with a giant hazy pyramid, glowing glyph signs and light
beams. The city follows the real sky where you live: sunrise, day, golden hour, sunset and night, with live clouds, rain,
snow, fog and storms. Formerly called Trenches.
It installs to your phone's home screen like a real app, works offline, and updates itself when new code is pushed.

**Live app:** https://wesfa.github.io/2025-day-1/ (after GitHub Pages is turned on, see below)

## What it does

| Screen | Features |
| --- | --- |
| **Today** | Daily weigh-in box, calories/protein/carbs/fat progress bars with a smaller fiber/sodium/potassium strip underneath, one-tap meal logging, "Coach says" food suggestions to close your protein/calorie gap, today's workout |
| **AI Food Scanner** | Snap a photo and/or describe a meal; Claude lists each item with estimated calories, protein, carbs and fat. You review and edit before adding. Needs your own Claude API key |
| **Food** | Breakfast/Lunch/Dinner/Snacks diary, 140+ built-in foods (incl. fast food), online search (Open Food Facts), barcode scanner, Recent, Favorites, saved meals, copy yesterday's meal, quick add, custom foods |
| **Gym** | 4-day DE/DT off-season program (power cleans, squats, bench, get-offs, hand fighting, neck work…) plus a library of ~190 exercises (barbell, dumbbell, cable, machine, bodyweight, cardio, mobility) with muscles, equipment and a muscle filter. The workout logger has SET / PREV / LB / REPS rows: fields start empty, PREV shows that set from last time, ✓ turns the row green, **Add set** copies the last set's numbers (not done), and swiping a row left deletes it. Also progressive-overload tips, auto rest timer, PR detection, coaching cues, plate calculator (⋯ menu) and an editable program |
| **Ranks** | Every lift gets a rank from **Iron** to **Champion**, with divisions III / II / I. Your best set becomes an estimated 1-rep max (bodyweight moves use reps, and added weight counts extra). That's compared with standards for that exercise, so 35 lb lateral raises rank far above 35 lb curls, scaled to your bodyweight, height and age. Shows an overall rank, what weight x reps gets the next division, and a rank / estimated-max graph per lift. Workouts show your rank on each exercise, and finishing one announces rank-ups |
| **Muscles** | Pixel front/back muscle heatmap for the last 7, 14 or 30 days. Main muscles count a full set, helpers half, cardio half and stretching nothing. Also a Back / Chest / Core / Arms / Shoulders / Legs hexagon and sets per muscle |
| **Weight** | Daily log, 7-day average, pixel chart, goal progress, weekly trend, projected goal date |
| **Reminders** | Weekly school/work blocks plus dated exceptions (no school, early dismissal, out of town), reminders that move around them (after-school fuel, plus a Lift day reminder on your lift days), a 7-day preview, schedule-file import, real push notifications via the free **ntfy** app, or a calendar file |
| **Gridlock** | An original 8x8 block-puzzle game (Start menu or Today): drag three pieces at a time onto the grid, clear full rows and columns, chain clears for combos, and empty the board for a bonus. Saves your game and best score |
| **Control Panel** | Split into categories (Profile, Targets, Look & sky, AI scanner, Backup, More) so only one set of settings shows at a time; `#/settings?c=look` opens one directly. Profile, auto-calculated macro targets (or enter your own), 8 color schemes (default **City (live sky)**: the pixel city painted for the time of day and the weather, minimal panels and amber glyph icons; **Meadow**: pixel hill-and-sky with glossy blue windows; **Island**: pixel beach with twinkling water), backup export/import |

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

## Feel

- **Haptics:** important taps give a little tick: main buttons, the taskbar, the Start menu, meal buttons, suggestions,
  tabs, set check-offs and confirmations. Saving food or a weigh-in gives a double tick, and a new PR gives a triple.
  Android uses the Vibration API. iPhone Safari has none, so on iOS 18+ the app flips a hidden native switch, which plays
  the system tick. Turn it off in **Control Panel → Appearance**.
- **Nutrient colours:** protein, carbs and fat (and fiber, sodium, potassium) keep their own colour in bars, labels and
  numbers everywhere. Under the City scheme that's blue, green and pink, so they stand out from the amber UI.

## How ranks work

Standards live in `js/exlib.js`: for each ranked exercise, the Bronze / Silver / Gold / Platinum / Diamond boundaries.
Weight exercises use a 1-rep max per pound of bodyweight for a 180 lb, 18-35 year-old male, per dumbbell where marked.
Bodyweight exercises use reps. `js/strength.js` scales them to you:

- **Bodyweight:** standards grow with (bodyweight / 180)^0.67, so heavier lifters need more total weight but less per pound.
- **Height, age and sex:** taller lifters get slightly lower bars for their longer levers, and so do teens, masters lifters and women.

Iron starts at zero, and Champion is 125% of Diamond. Each set's estimated max uses the Epley formula. Every workout
uses the bodyweight you'd logged by then. The numbers are rough community strength standards, meant for tracking your
own progress.

## Live sky

The City scheme paints the same city five ways (dawn, day, golden hour, dusk, night) and cross-fades between them
through the day (`js/sky.js`). The sun arcs from sunrise to sunset and sets behind the skyline. At night the moon shows
as a thin ring of light that follows the real moon phase. Windows and signs light up as it gets dark.

- **Sunrise and sunset:** **Control Panel → Live sky → Use my location** (or **Find my town**). Without a location they're
  computed from a guess based on the phone's time zone.
- **Weather:** with a location, the current and hourly forecast come from [Open-Meteo](https://open-meteo.com)
  (free, no account) every 30 minutes while the app is open. That gives clouds, an overcast deck, fog, drizzle, rain,
  snow and thunderstorms (soft lightning, off with reduced motion). The forecast keeps working for a few hours offline.
- **Privacy:** the location is rounded to about 10 km and stored only on the phone. That rounded point is all that's sent
  to Open-Meteo. No food, weight or workout data is ever sent.
- **Preview:** Control Panel has *Preview time* and *Preview weather* to try any combination. Previews reset when the app closes.

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

- **Home-screen icon** (`tools/key_icon.py`): a simple 24 x 24 pixel painting of a boulder resting between two hazy
  peaks, an homage to the idea of Magritte's *The Glass Key*, drawn from scratch. Edit the text rows to change it.
- **City wallpaper** (`tools/city_art.py`, `tools/skyline.py`): pieces in `art/city/`, shown at 2 CSS px per art pixel.
  Behind the water are a giant hazy pyramid and far, mid and near skylines. The buildings include setback blocks,
  platforms on stems, tree-like pods, stilted blocks, slanted monoliths, works with tanks, cranes and spires. They're tied
  together by rails, an elevated deck and beaded cables. A tall foreground tower with a neon sign frames the left edge.
  The water carries reflections of the silhouettes and lights, and the dock has a figure with a lantern and a boat.
  Each layer is drawn once as colour *roles* and painted per time of day, so all five versions line up.
  Sun, ring moon, stars, embers, birds, clouds, fog, rain and snow sprites are generated too. Fixed seeds keep re-runs identical.
- **Muscle map** (`tools/body_art.py` → `js/body-grid.js`): front and back bodies on a 36 x 76 grid, one letter per muscle.
- **Meadow and Island** pieces (`art/m-*.png` and the rest) are drawn as text, one character per pixel.

The amber icon set lives in `js/icons.js` (`DUSK`); the app switches to it when the City scheme is on.

## Tech

Plain HTML/CSS/JS ES modules with no build step and no dependencies. A service worker makes it work offline, and data is stored in `localStorage`.
Fonts: DotGothic16 and VT323 (SIL Open Font License). Food search: [Open Food Facts](https://world.openfoodfacts.org) (ODbL).
Barcode scanning uses the browser's BarcodeDetector, or the bundled `html5-qrcode` (Apache-2.0).
AI uses the official `@anthropic-ai/sdk` (Apache-2.0), bundled into `js/vendor/anthropic-sdk.js` with esbuild and loaded only when the scanner is used.
No third-party scripts load at runtime.

Test locally with `python3 -m http.server` and open http://localhost:8000.

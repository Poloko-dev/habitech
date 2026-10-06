# Habitech — Habit Tracker

React habit tracker. Data is stored in `./storage.json` locally, or in MongoDB on Vercel.

## Run

```bash
npm install
npm run dev          # http://localhost:5173 (dev server + storage API)
```

Production: `npm run build && npm start` (http://localhost:4173, override with `PORT`).

## Deploying to Vercel (data in MongoDB)

Vercel serves the built app and runs the two functions in `api/` (`auth.js`, `storage.js`) automatically. There's no server to manage. Vercel can't keep files between requests, so in production the data lives in MongoDB instead of `storage.json`.

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas). Add a database user, then under **Network Access** allow `0.0.0.0/0`, since Vercel's IP addresses change.
2. In Vercel, go to **Project → Settings → Environment Variables** and add:
   - `PASS_TOKEN`: your access token
   - `MONGODB_URI`: the Atlas connection string (`mongodb+srv://…`)
   - `MONGODB_DB` (optional, default `habitech`)
3. Redeploy (push to `master`, or use **Deployments → Redeploy**).

Locally, the app keeps using `storage.json` unless you put `MONGODB_URI` in `.env`.

## Access token

The app is locked until you enter the token set as `PASS_TOKEN` in `.env` (see `.env.example`).

- The token is checked **only on the server** (`server/auth.js`) and is never included in the browser code. Don't rename it to `VITE_PASS_TOKEN`, because Vite would then publish it to the browser.
- A correct token sets a signed, HttpOnly session cookie that lasts 7 days. **Lock app** (sidebar lock icon or **Settings → Lock app**) clears it in that browser. Changing `PASS_TOKEN` signs out every browser.
- `/api/storage` returns 401 without a session, and `/storage.json` can't be downloaded directly.
- After 5 wrong tokens there is a 30-second cool-down.
- After changing `.env`, restart `npm start`. The dev server restarts on its own. On Vercel, redeploy after changing environment variables.

## Storage

The browser can't write files, so a small API (`server/storageApi.js`) reads and writes
`storage.json` via `GET/PUT /api/storage`. Writes are atomic (temp file + rename).

```json
{
  "version": 1,
  "habits": [{ "id": "…", "name": "Drink water", "target": 8, "unit": "glasses",
               "schedule": [0,1,2,3,4,5,6], "createdAt": "2026-10-01", "archivedAt": null, "…": "…" }],
  "logs":  { "2026-10-06": { "<habitId>": 5 } },
  "notes": { "2026-10-06": "Journal text" }
}
```

A habit is complete on a day when its logged value reaches `target`. `schedule` uses
JS weekday numbers (0 = Sunday).

## Habit details

Click any habit on the **Habits** page to open its details: schedule, target, streaks,
30-day completion and check-ins. From there you can:

- **Edit** the habit.
- **Log progress** for today or any earlier day: check it off, or use the −/+ buttons or type an amount.
- **Write what you did** that day. Notes are saved per habit per day under `habitNotes`
  (`{ "YYYY-MM-DD": { "<habitId>": "text" } }`).
- See the **last 14 days** at a glance; a blue dot marks days with a note. Click a day, or one of your recent notes, to jump to it.

## Demo data & clean sheet

- **Load demo data** (empty Today page, or **Settings**) adds 90 days of sample habits, check-ins, notes and focus sessions. Demo items are tagged `demo: true`.
- While demo data is loaded, a banner offers **Start clean sheet**. This removes only the demo items, keeps anything you added yourself, and hides the demo shortcuts.
- **Settings → Your data** has the same options, plus a toggle to show or hide the "Load demo data" button on the empty Today page and **Erase all data**, which deletes everything except timer settings and preferences.

## Focus timer (Pomodoro)

- Focus / short break / long break (default 25 / 5 / 15 min, long break every 4 sessions), all configurable.
- Plays a sound when time is up: the alarms are synthesized with the Web Audio API (`src/lib/sound.js`), so there are no audio files. You can pick separate sounds for the end of a focus session and the end of a break, set the volume, and test them. An optional desktop notification fires when the tab is in the background.
- The timer runs at app level, so it keeps going while you switch pages. A pill in the sidebar or top bar shows the countdown. The timer state is saved to `storage.json`, so it survives a reload.
- Completed focus sessions are logged to `storage.json`. Press Space on the Focus page to start or pause.
- Focus time appears in the daily, weekly and monthly reports.

Stored under `pomodoro` in `storage.json`: `settings`, `active` (the current timer) and
`sessions` (`{ id, date, startedAt, endedAt, minutes, habitId }`).

## Reports

One **Reports** page with Daily / Weekly / Monthly tabs (`#/reports/<tab>/<date>`). Switching
tabs keeps the selected date, and the Reports link reopens the last tab you used.

- **Daily**: completion vs previous day and prior 7-day average, per-habit status and streaks, journal note, 14-day trend. Past days can be back-filled.
- **Weekly** (Mon–Sun): this week vs last week by day, habit × day matrix, perfect days, top habit, insights.
- **Monthly**: calendar heatmap, daily trend, weekday and week-by-week performance, per-habit table with change vs last month, insights.

Today counts as "in progress": it shows on Today and in the daily report, but weekly and monthly totals only include it once the day is over. Future days are never counted.

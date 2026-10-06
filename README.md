# Habitech — Habit Tracker

React habit tracker with MongoDB storage (local MongoDB for development, Atlas when hosted).

## Run locally with MongoDB

1. Start MongoDB on your machine (for example as a Windows service, or with `mongod`).
2. Create a `.env` in the project folder (see `.env.example`):
   ```
   MONGO_DB=mongodb://localhost:27017/habitech
   ```
3. Install and start:
   ```bash
   npm install
   npm run dev          # http://localhost:5173
   ```
4. **First launch:** the app asks you to **create your access token**. From then on, you enter that token to unlock.

All data (habits, check-ins, notes, focus sessions) and the hashed token are stored in the `habitech` database, which is named in the URI. Without `MONGO_DB`, the app falls back to `./storage.json` and `./.habitech-auth.json`.

To run without the dev server: `npm run build && npm start` (http://localhost:4173, override with `PORT`).

## Access token

- **Created in the app:** on first launch you choose the token. It's stored **hashed** with scrypt and a random salt in MongoDB (`habitech.settings`, document `_id: "auth"`), never in plain text and never in the browser code.
- **Changing it:** **Settings → Security → Change token** asks for the current token. Changing it signs out every other browser.
- **Unlock session:** a correct token sets a signed, HttpOnly cookie that lasts 7 days. **Lock app** (sidebar lock icon or **Settings → Lock app**) clears it in that browser.
- **Locked data:** `/api/storage` returns 401 without a session, and `storage.json` can't be downloaded directly.
- **Wrong tokens:** after 5 wrong attempts there's a 30-second cool-down.
- **`PASS_TOKEN` (optional):** if set as an environment variable, it takes priority over the stored token and can't be changed in the app. That's useful for hosted deployments.

### Reset a forgotten token

Delete the stored token, then reload the app. It will ask you to create a new one. Your habit data is not touched.

```bash
mongosh "mongodb://localhost:27017/habitech" --eval 'db.settings.deleteOne({ _id: "auth" })'
```

Without MongoDB, delete `./.habitech-auth.json` instead.

## Deploying to Vercel (later)

Vercel serves the built app and runs the two functions in `api/` (`auth.js`, `storage.js`). Vercel can't keep files, so production needs a hosted MongoDB such as [Atlas](https://www.mongodb.com/atlas). Under Atlas **Network Access**, allow `0.0.0.0/0`.

In Vercel, go to **Project → Settings → Environment Variables** and add `MONGODB_URI` (or `MONGO_DB`) with the Atlas connection string, then redeploy. `PASS_TOKEN` is optional there too. Without it, the first person to open the deployed site creates the token, so open it yourself right after deploying, or set `PASS_TOKEN`.

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

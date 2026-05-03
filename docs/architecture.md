# Trainer V1 — Architecture Overview

Written for Lou. This is the systems-level picture of how the app works — what each piece is, why it exists, and how the pieces talk to each other. Not a line-by-line code walkthrough, but enough to reason about any part of the system.

---

## The Big Picture

The app is a **mobile web app** — it runs in a browser on your phone, not as a native iOS app. You access it at `trainerv1.vercel.app`. It's private (login required) and built specifically for you.

At the highest level, here's what happens when you open the app:

1. Your phone hits Vercel (the hosting platform)
2. Vercel runs the app server and fetches your training data from Google Sheets
3. The page is built on the server with your data already in it, then sent to your phone
4. Your phone renders the UI

Everything is read from Google Sheets (your source of truth) and displayed on screen. Some things write back — editing a workout, entering a sleep score, syncing Strava.

---

## External Services

These are the third-party platforms the app depends on. None of them are optional — remove any one and something breaks.

### Vercel
The **hosting platform**. Vercel runs the app in the cloud. When you push code to GitHub, Vercel automatically picks it up and deploys a new version within about 60 seconds. Vercel also runs the **scheduled jobs** (crons) that sync Strava and generate AI coaching notes on a schedule.

Think of Vercel as the computer the app runs on — except it's in the cloud, scales automatically, and you never touch it directly.

### GitHub
Where the **source code lives**. Every change to the app gets committed (saved) and pushed to GitHub. Vercel watches GitHub and auto-deploys whenever `main` branch changes. GitHub is also the backup — if something goes wrong, the full history of every change is there.

### Clerk
Handles **authentication** — login and identity. When you go to the app and sign in with Google, that's Clerk. Clerk checks who you are and gives the app a session token. The app uses that token to know you're you and let you in.

You're currently the only user. Clerk is set up for the future when there might be multiple athletes or a coach.

### Google Sheets (four spreadsheets)
The **data layer**. All your training data lives in Google Sheets — not in a traditional database. This was a deliberate choice: you can view and edit your data directly in the sheet without going through the app, and it's a format you already know.

Each spreadsheet has a small script attached to it (Google Apps Script) that acts as an API — the app sends requests to the script, and the script reads or writes the sheet and sends data back.

The four spreadsheets:

| Spreadsheet | What's in it |
|---|---|
| **Training Plan** | Your daily plan, phases, and races |
| **Training Data** | Raw Strava activity imports + Apple Health metrics |
| **Training Log** | The actual workout log (built from Strava + manual entry) |
| **Workout Library** | Catalog of workouts (shared with TigerWolves run club) |

### Strava
The **activity source**. The app pulls your Strava activities on a schedule (twice a day on weekdays, twice on weekends). For each new activity it finds, it writes a row to the Training Data sheet and a row to the Training Log. For activities you've already synced, it fetches the full activity detail (including your private notes and perceived exertion) and updates the existing log row.

### Anthropic (Claude API)
The **AI coaching engine**. When the app generates a coaching note or week review, it sends a request to Anthropic's API with your workout details, health metrics, and recent training history. Claude writes the coaching text and sends it back. The app caches the result in Vercel KV so it doesn't call the AI every time you open the app.

### Vercel KV
A **fast key-value store** — think of it as a small cache that lives next to the app on Vercel. It holds AI-generated coaching notes and week reviews. The key is always a date, the value is the coaching note for that date. When the app needs a coaching note, it checks KV first. If it's there, it uses it (fast, no AI call). If it's not, it generates a new one and saves it to KV for next time.

### Apple Health (iOS Shortcut)
Your **health metrics pipeline**. An iOS Shortcut on your phone reads data from the Health app (HRV, resting HR, respiratory rate, sleep score, steps, etc.) and sends it to the app via an API endpoint. The app writes that data to the Apple Health tab in the Training Data sheet. The shortcut runs when you trigger it — it's not fully automatic.

---

## Framework: Next.js

The app is built with **Next.js**, a framework built on top of React. React is the most widely used system for building web UIs. Next.js adds the server layer — it lets you run code on the server (not just in the browser) before sending the page to the user.

The key idea in Next.js is the distinction between **server components** and **client components**.

### Server Components
Run on Vercel's servers, not in your browser. They fetch data, talk to APIs, and build the initial HTML. They have no interactivity — they just produce content.

Every page in this app (Today, Week, Plan, Library) starts as a server component. The server fetches all the data for that page from Google Sheets before anything is sent to your phone. This is why the page loads with your data already populated — you're not watching a spinner while the data loads.

### Client Components
Run in your browser (on your phone). They handle interactivity — taps, inputs, state changes, animations. Anything that needs to react to what you do is a client component.

The `TodayClient`, `WeekClient`, `PlanClient`, and `LibraryClient` files are all client components. They receive their data as props from the server components and handle everything interactive from there.

### Server Actions
A special Next.js feature: functions that run on the server but can be called from client components. When you tap "Regenerate" on a coaching note, or enter a sleep score, or save a workout edit — those calls go to server actions. The server action does the work (calls an API, writes to a sheet, calls Claude) and returns the result to the client.

---

## Folder Structure

```
trainer_v1/
├── app/                     # Pages and API routes (Next.js App Router)
│   ├── page.tsx             # Today screen (server component)
│   ├── week/page.tsx        # Week screen (server component)
│   ├── plan/page.tsx        # Plan screen (server component)
│   ├── library/page.tsx     # Library screen (server component)
│   ├── sign-in/             # Login page (handled by Clerk)
│   ├── layout.tsx           # App shell — wraps every page (nav, auth check)
│   ├── globals.css          # Global styles (Tailwind config lives here)
│   ├── actions.ts           # Server actions — all write operations
│   └── api/                 # API endpoints (not pages)
│       ├── health/          # POST endpoint — receives Apple Health data from Shortcut
│       ├── strava/sync/     # POST endpoint — manual Strava sync trigger
│       └── cron/
│           ├── ai-coaching/ # POST endpoint — called by Vercel cron nightly
│           └── week-review/ # POST endpoint — called by Vercel cron on Mondays
│
├── components/              # Client components (the interactive UI layer)
│   ├── TodayClient.tsx      # Today screen UI — day cycling, coaching, health tiles
│   ├── WeekClient.tsx       # Week screen UI — plan vs actual, week review
│   ├── PlanClient.tsx       # Plan screen UI — weeks, phases, races, day editor
│   ├── LibraryClient.tsx    # Library screen UI — workout catalog
│   ├── ActivityDrawer.tsx   # Slide-up drawer for Strava activity detail
│   └── BottomNav.tsx        # The four-tab navigation bar at the bottom
│
├── lib/                     # Shared logic (no UI, no routes — just functions)
│   ├── data.ts              # TypeScript types — the shape of all data objects
│   ├── sheets.ts            # Reads from Google Sheets, normalizes the data
│   ├── strava.ts            # Strava API — sync activities, fetch detail
│   ├── ai.ts                # Claude API — generate coaching notes and week reviews
│   ├── kv.ts                # Vercel KV — read/write cached AI content
│   └── athlete-context.ts   # Your athlete profile injected into every AI prompt
│
├── sheets/                  # Google Apps Script files (not part of the web app)
│   ├── scripts/
│   │   ├── plan_script.js   # Script attached to Training Plan spreadsheet
│   │   ├── data_script.js   # Script attached to Training Data spreadsheet
│   │   └── log_script.js    # Script attached to Training Log spreadsheet
│   └── *.csv                # Snapshots of sheet data (for reference/testing)
│
├── docs/                    # Documentation
├── proxy.ts                 # Clerk authentication middleware — runs on every request
├── vercel.json              # Vercel config — cron job schedules
├── next.config.ts           # Next.js config
├── package.json             # Project dependencies
└── .env.local               # Secret keys (NOT in git — stays local and on Vercel)
```

---

## Data Types (`lib/data.ts`)

This file defines the **shape** of every data object in the app. Think of these as blueprints — they describe what fields an object has and what type each field is. No logic, just definitions.

| Type | What it represents |
|---|---|
| `PlannedWorkout` | One row from the Plan tab — date, day type, workout, distance, instructions, notes, etc. |
| `Phase` | One training phase — name, start/end dates, goal |
| `Race` | One race entry — name, date, distance, grade (A/B/C) |
| `HealthEntry` | One day of health metrics — HRV, resting HR, respiratory rate, sleep score, steps, etc. |
| `TrainingLogEntry` | One workout in the log — activity type, distance, duration, HR, zones, RPE, notes |
| `StravaActivity` | One Strava activity as stored in the Training Data sheet |
| `LibraryWorkout` | One workout from the library — name, sport, instructions, etc. |
| `CoachingNote` | AI-generated daily coaching note — date, coaching text, workout purpose |
| `WeekReview` | AI-generated week review — week number, summary, PT summary |

---

## How Data Flows

### Reading data (the most common path)

```
You open the app
  → Next.js server component runs on Vercel
  → lib/sheets.ts fetches from Google Sheets Apps Script endpoints
  → Data is normalized into TypeScript types
  → Page is built with your data
  → HTML is sent to your phone
  → Client component (TodayClient etc.) takes over for interactivity
```

Sheet data is cached for 5 minutes. If you edit the sheet directly, the app won't see it for up to 5 minutes. Restarting the dev server clears the cache immediately.

### Writing data (saves, edits)

```
You tap something (save a workout, enter sleep score, etc.)
  → Client component calls a Server Action in app/actions.ts
  → Server Action runs on Vercel
  → Sends a POST request to the relevant Apps Script endpoint
  → Apps Script updates the Google Sheet
  → Server Action tells Next.js to revalidate the cached data
  → Next page load shows the updated data
```

### Strava sync

```
Vercel cron fires (or you tap Sync)
  → /api/strava/sync/route.ts runs
  → lib/strava.ts gets an access token from Strava
  → Fetches last 14 days of activities from Strava list endpoint
  → For each activity:
      - If new: fetches full detail (for private_note + RPE), writes to Training Data sheet and Training Log
      - If already exists: fetches full detail, updates Post-Run Feel and RPE in Training Log
      - If unchanged: skips
```

### AI coaching note generation

```
Vercel cron fires at 4am UTC (midnight ET) every night
  → /api/cron/ai-coaching/route.ts runs
  → Fetches next 7 days of non-Rest workouts from the plan
  → For each workout:
      - Builds context: workout details + phase + next race + last 7 days of log + today's health metrics
      - Sends context to Claude API (lib/ai.ts)
      - Claude returns coaching text
      - Text is saved to Vercel KV with the date as the key
  
When you open Today screen:
  → Server component checks KV for today's coaching note
  → If found: uses it (instant)
  → If missing: generates one on-demand, saves to KV
  → You see the note immediately
  
When you tap Regenerate:
  → Calls server action → regenerates from fresh data → saves to KV → updates UI
```

---

## The Google Sheets / Apps Script Layer

Each spreadsheet has a Google Apps Script attached to it. When the app needs data, it sends an HTTP request to the script's deployed URL. The script reads or writes the sheet and returns JSON.

This is unusual — most apps use a proper database (Postgres, MySQL, etc.). Using Sheets was a deliberate tradeoff: you can see and edit all your data directly, and the setup is simpler. The cost is that it's slower than a real database and has some edge cases (like needing to handle duplicate rows on race days).

**IMPORTANT**: Saving a change to an Apps Script file does NOT update the live app. You must go through Deploy → Manage Deployments → New Version every time you change a script. The deployed URL is what the app calls — the source file and the deployment are separate.

The three scripts:

- **`plan_script.js`** — Handles the Training Plan spreadsheet. Reads plan/phases/races. Writes when you edit a workout in the app, add a phase, or update a race.
- **`data_script.js`** — Handles the Training Data spreadsheet. Receives Apple Health data from your iOS Shortcut. Receives Strava data from the sync job. Also handles partial health updates (like when you enter a sleep score).
- **`log_script.js`** — Handles the Training Log spreadsheet. Writes new workout rows from Strava. Updates existing rows when re-syncing. Reads back the log for the app and for AI context.

---

## AI Coaching — How It Actually Works

The AI is not a chatbot — it's a one-shot text generator. Every time a coaching note is generated, the app assembles a block of context (your workout, health metrics, recent training history) and sends it to Claude with a specific prompt. Claude writes the note and returns it. There's no memory between calls — each note is generated from scratch with the context provided.

The context sent to Claude for a daily coaching note includes:
- Today's planned workout (type, distance, instructions, purpose)
- Current training phase and next race
- Today's health metrics (HRV with 7-day avg, resting HR, respiratory rate, sleep score)
- Last 7 days of Training Log (activity, distance, duration, HR, zones, RPE, post-run notes)

The coaching output is structured into two sections:
- **Readiness** — HRV trend, resting HR, sleep, respiratory rate. Is the body ready?
- **Training Context** — How today's workout fits the last 7 days. Any flags.

The athlete profile (`lib/athlete-context.ts`) is injected into every prompt — your HRV baseline, PT directives (yoga/strength/core targets), cross-training rules, sleep scale, respiratory rate baseline. This is the file to edit when your training philosophy or PT guidance changes.

---

## Scheduled Jobs (Crons)

Vercel runs these on a schedule. They're defined in `vercel.json`.

| Job | Schedule | What it does |
|---|---|---|
| Strava sync | Weekdays: 8am + 5pm ET. Weekends: 11am + 5pm ET | Pulls recent Strava activities |
| AI coaching notes | Daily at midnight ET | Generates notes for next 7 workouts |
| Week review | Every Monday at midnight ET | Generates week-in-review for completed week |

Crons call the API endpoints in `app/api/cron/`. Those endpoints require a `CRON_SECRET` bearer token so they can't be called by anyone else.

---

## Authentication

Clerk handles all of this. The file `proxy.ts` runs on every single request before anything else. It checks whether you're logged in. If you're not, it redirects you to `/sign-in`. If you are, the request continues.

A small number of routes are **whitelisted** (excluded from auth): the Apple Health ingest endpoint and the cron job endpoints. Those are called by automated systems (your phone Shortcut, Vercel) that can't log in with Google.

---

## Environment Variables (`.env.local`)

The file `.env.local` holds all the secret keys. It is never committed to git — it lives only on your machine and in Vercel's settings. If you lose it, you'd need to regenerate each key from its respective service.

| Variable | What it's for |
|---|---|
| `PLAN_SHEETS_URL` | URL of the deployed Training Plan Apps Script |
| `DATA_SHEETS_URL` | URL of the deployed Training Data Apps Script |
| `LOG_SHEETS_URL` | URL of the deployed Training Log Apps Script |
| `LIBRARY_SHEETS_URL` | URL of the Workout Library Apps Script |
| `STRAVA_CLIENT_ID` | Strava API app credentials |
| `STRAVA_CLIENT_SECRET` | Strava API app credentials |
| `STRAVA_REFRESH_TOKEN` | Your Strava refresh token (used to get access tokens) |
| `ANTHROPIC_API_KEY` | Key for calling the Claude API |
| `KV_URL` / `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV credentials (auto-set by Vercel) |
| `CLERK_SECRET_KEY` | Clerk backend key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key (safe to expose) |
| `CRON_SECRET` | Secret token that protects the cron endpoints |

---

## Local Development vs Production

**Local** (`npm run dev`, runs at `localhost:3000`):
- Uses `.env.local` for secrets
- Hot reloads as you change files
- The 5-minute sheet cache can be bypassed by restarting the server
- Talks to the real Google Sheets, real Strava, real Claude API — it's not a sandbox

**Production** (auto-deployed from `main` branch on GitHub):
- Runs on Vercel at `trainerv1.vercel.app`
- Secrets are in Vercel's environment variable settings
- Cron jobs only run in production (not locally)
- Changes go live ~60 seconds after a `git push`

---

## What Each Key File Does — One Line Each

| File | Role |
|---|---|
| `app/page.tsx` | Today screen server component — fetches all data, passes to TodayClient |
| `app/week/page.tsx` | Week screen server component |
| `app/plan/page.tsx` | Plan screen server component |
| `app/library/page.tsx` | Library screen server component |
| `app/layout.tsx` | App shell — Clerk auth wrapper, bottom nav, global fonts |
| `app/actions.ts` | All write operations: save workout, regenerate note, sync Strava, etc. |
| `app/api/health/route.ts` | Receives Apple Health POST from iOS Shortcut |
| `app/api/strava/sync/route.ts` | Triggers a Strava sync on demand |
| `app/api/cron/ai-coaching/route.ts` | Nightly job: generate coaching notes for next 7 workouts |
| `app/api/cron/week-review/route.ts` | Monday job: generate week-in-review |
| `components/TodayClient.tsx` | Today UI: day navigation, workout display, health tiles, Head Coach, Assistant Coach |
| `components/WeekClient.tsx` | Week UI: plan vs actual, zone bars, week review, PT summary |
| `components/PlanClient.tsx` | Plan UI: week grid, day editor, phase/race management |
| `components/LibraryClient.tsx` | Library UI: workout catalog, add workout form |
| `components/BottomNav.tsx` | Four-tab nav bar at the bottom of every screen |
| `lib/data.ts` | TypeScript type definitions — the shape of every data object |
| `lib/sheets.ts` | Fetches and normalizes data from all four Google Sheets |
| `lib/strava.ts` | Strava OAuth, activity list fetch, activity detail fetch, sync logic |
| `lib/ai.ts` | Claude API calls — builds context, sends prompts, returns coaching text |
| `lib/kv.ts` | Read/write coaching notes and week reviews in Vercel KV cache |
| `lib/athlete-context.ts` | Your athlete profile — HRV baseline, PT directives, cross-training rules |
| `proxy.ts` | Auth gate — runs on every request, redirects to login if not authenticated |
| `vercel.json` | Cron job schedules |
| `sheets/scripts/plan_script.js` | Apps Script for Training Plan spreadsheet |
| `sheets/scripts/data_script.js` | Apps Script for Training Data spreadsheet (Strava + Apple Health) |
| `sheets/scripts/log_script.js` | Apps Script for Training Log spreadsheet |

# trainer_v1

Personal marathon training app — 2026 season. Built for Lou Fox.

A mobile-first web app that replaces a complex Google Sheets training tracker. The training plan lives in Google Sheets where it's easy to build and adjust across weeks and phases. The app is the daily interface: check today's workout, get a coaching take on why it matters, log how it went, and review the week.

## What It Does

**Today** — opens to today's planned workout with context: what it is, why it's scheduled now (phase + race proximity), and a coaching assessment based on current HRV and sleep. Strava sync status shows whether yesterday's run was captured.

**Week** — this week's plan vs. what actually happened. AI-generated week-in-review with a separate PT summary you can copy and send to your physio.

**Plan** — the full training plan by week. Swap workouts from the library, view phase structure and upcoming races.

**Library** — the workout library. Add new workouts (easy runs, long runs, quality sessions). Shared with the TigerWolves run club library.

## AI Coaching

Each morning a background job generates coaching notes for the next 7 days using Claude (Anthropic). It reads the planned workout, the current phase goal, the target race, recent training history, and the latest HRV and sleep data — then writes a direct, practical coaching take in the style of Jack Daniels and Brad Hudson. Sunday nights it generates a week-in-review.

The AI talks to the athlete directly. Future version will route this through a coach interface.

## Data Sources

| Source | How |
|--------|-----|
| Training Plan | Google Sheets (built manually, edited in sheet or app) |
| Strava | Vercel cron pulls recent activities nightly |
| Apple Health | iOS Shortcut POSTs HRV, sleep, resting HR |
| Workout Library | Shared Google Sheet (also used by TigerWolves run club) |

## Stack

- **Next.js 16** (App Router) on Vercel
- **Tailwind CSS v4**
- **Clerk** for auth
- **Vercel KV** for AI note caching
- **Google Sheets** via Apps Script as data backend
- **Anthropic Claude API** for coaching notes and week reviews

## Google Sheets Setup

Three spreadsheets, each with an Apps Script JSON endpoint:

1. **Training Plan** — `Plan`, `Phases`, `Races` tabs
2. **Training Data** — `Strava Data`, `Apple Health` tabs (append-only ingest)
3. **Training Log** — `Training Log` tab (actuals, populated from Strava + manual)

CSV templates for all sheets are in `/sheets`. Import each CSV as a new tab, then wire up an Apps Script `doGet()` that returns all tabs as JSON.

## Environment Variables

See `.env.local.example` for required variables. Key ones:

```
PLAN_SHEETS_URL       Apps Script endpoint for Training Plan sheet
DATA_SHEETS_URL       Apps Script endpoint for Training Data sheet
LOG_SHEETS_URL        Apps Script endpoint for Training Log sheet
LIBRARY_SHEETS_URL    Apps Script endpoint for Workout Library sheet
STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET / STRAVA_REFRESH_TOKEN
ANTHROPIC_API_KEY
CLERK_SECRET_KEY / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
KV_URL / KV_REST_API_URL / KV_REST_API_TOKEN
```

## Development

```bash
npm install
cp .env.local.example .env.local   # fill in your keys
npm run dev
```

## Where This Is Going

- Multi-athlete / multi-coach support
- Coach interface: AI drafts → coach edits → sends to athlete
- 15 years of Strava history analysis — fitness trajectory, age-adjusted benchmarking
- AI-assisted plan generation with coaching rules (mileage ramp limits, quality day caps, phase stressor logic)

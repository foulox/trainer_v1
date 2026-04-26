# Claude Code — trainer_v1

## What This Is
A personal marathon training app for Lou Fox (2026 season). Mobile-first web app replacing a complex Google Sheets setup. The app is the daily interface; the sheets remain the source of truth for the training plan.

## Stack
- **Frontend:** Next.js 16 (App Router) + Tailwind CSS v4
- **Hosting:** Vercel (auto-deploys from `main`)
- **Auth:** Clerk (Google login, single user for now)
- **AI:** Anthropic Claude API (coaching notes + week reviews, stored in Vercel KV)
- **Data:** Google Sheets via Apps Script JSON endpoints (read-heavy)
- **Caching:** Vercel KV for AI-generated content; 5-min revalidation on sheet data

## Architecture
- Server components fetch data and pass to client components as props (same pattern as TigerWolves)
- `lib/sheets.ts` — fetches from Apps Script, normalizes data
- `lib/data.ts` — TypeScript types only
- `lib/ai.ts` — Claude API calls for coaching notes and week reviews
- `lib/kv.ts` — Vercel KV helpers for AI content cache
- `app/actions.ts` — server actions (write-backs to sheets, cache invalidation)

## Google Sheets — Three Spreadsheets

**Sheet 1: "2026 Lou Fox Training Plan"** (`PLAN_SHEETS_URL`)
- `Plan` tab — Date, Day, Week#, Phase, Day Type, Run Type, Workout, Distance, Target Pace, HR Zone, Intensity, Energy System, Reason/Purpose, Instructions, Notes
- `Phases` tab — Phase Name, Start Date, End Date, Weeks, Goal/Focus
- `Races` tab — Race Name, Date, Distance, Purpose (Target/Test), Location, Notes

**Sheet 2: "2026 Lou Fox Training Data"** (`DATA_SHEETS_URL`)
- `Strava Data` tab — raw activity ingest from Strava API (append-only)
- `Apple Health` tab — raw health metrics from iOS Shortcut (append-only)

**Sheet 3: "2026 Lou Fox Training Log"** (`LOG_SHEETS_URL`)
- `Training Log` tab — actual workouts (populated from Strava + manual entry)

**Sheet 4: Workout Library** (`LIBRARY_SHEETS_URL`) — shared with TigerWolves
- Same sheet used by the run club. Easy runs, long runs added here.

## Environment Variables
```
PLAN_SHEETS_URL=        # Apps Script doGet for Plan sheet
DATA_SHEETS_URL=        # Apps Script doGet for Data sheet
LOG_SHEETS_URL=         # Apps Script doGet for Training Log sheet
LIBRARY_SHEETS_URL=     # Apps Script doGet for Workout Library

STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REFRESH_TOKEN=

ANTHROPIC_API_KEY=

KV_URL=                 # Vercel KV (auto-set by Vercel integration)
KV_REST_API_URL=
KV_REST_API_TOKEN=

CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
```

## Screens (Bottom Nav — 4 tabs)
1. **Today** (`/`) — Planned workout, AI coaching note (why it matters today), Apple Health snapshot (HRV/sleep), days to next race
2. **Week** (`/week`) — This week's plan vs. actual, AI week-in-review, one-tap PT summary copy
3. **Plan** (`/plan`) — Browse/edit the training plan by week, swap workouts from library
4. **Library** (`/library`) — Workout library; add easy runs, long runs, quality workouts

## AI Coaching — How It Works
- **Nightly cron** (midnight ET): generates coaching notes for next 7 days of workouts, stores in Vercel KV
- **Sunday night cron**: generates week-in-review for the completed week, stores in Vercel KV
- **On-demand tap**: regenerates for current day/week if KV is stale or missing
- **Context fed to AI**: workout details, phase + race context, last 7 days of training log, today's HRV/sleep
- **Model**: `claude-sonnet-4-6`. Voice: Jack Daniels / Brad Hudson — direct, authoritative, personal

## Data Flows
- **Strava → app**: Vercel cron (`/api/cron/strava-sync`) pulls recent activities → writes to Training Data sheet + Training Log sheet
- **Apple Health → app**: iOS Shortcut POSTs to `/api/health` → writes to Training Data sheet
- **AI notes → app**: Vercel cron → Claude API → Vercel KV → pulled by Today/Week pages

## Key Constraints
- Public repo — no credentials, no personal data in source
- Mobile-first: this is used on the phone during/after runs
- Single user for now (Lou), but data model and auth built for multi-user expansion
- Plan building happens in the Google Sheet — the app is read + light write (log a workout, swap a workout)

## Future Direction
- Multi-athlete / multi-coach support (Clerk orgs)
- Coach interface: AI drafts coaching notes → coach edits → sends to athlete
- 15-year Strava history analysis (fitness trajectory, age-adjusted benchmarking)
- AI plan generation with coaching rules (no >2 quality days/week, mileage ramp limits, etc.)
- Strava-like post-run AI analysis drawing on full training history

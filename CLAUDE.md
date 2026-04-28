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
- Server components fetch data and pass to client components as props
- `lib/sheets.ts` — fetches from Apps Script, normalizes data
- `lib/data.ts` — TypeScript types only
- `lib/ai.ts` — Claude API calls for coaching notes and week reviews
- `lib/kv.ts` — Vercel KV helpers for AI content cache
- `app/actions.ts` — server actions (write-backs to sheets, cache invalidation)

## Google Sheets — Four Spreadsheets

**Sheet 1: "2026 Lou Fox Training Plan"** (`PLAN_SHEETS_URL`)
- `Plan` tab — Date, Day, Week#, Phase, Day Type, Run Type, Workout, Distance (mi), Target Pace (min/mi), HR Zone, Intensity, Energy System, Reason/Purpose, Instructions, Notes
- `Phases` tab — Phase Name, Start Date, End Date, Weeks, Goal/Focus
- `Races` tab — Race Name, Date, Distance, Purpose (A/B/C grade), Location, Notes

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
3. **Plan** (`/plan`) — Three sub-tabs: Weeks, Phases, Races
4. **Library** (`/library`) — Workout library; add easy runs, long runs, quality workouts

## Plan Tab — Sub-tabs

### Weeks tab
- Groups plan entries by **calendar week** (Mon–Sun anchor), NOT by the Week# field in the sheet
- The Week# field is unreliable (race days and manually added rows often have Week#=0)
- Calendar-week grouping key = the ISO date of that week's Monday
- Weeks where every entry has an empty Phase are hidden (orphaned race rows after a delete)
- Week pagination: prev/next arrows, defaults to current week on load
- Each day shows day type, workout, distance. Tap a day to open the day editor.

### Day editor
- Saves via `upsertPlanDay` server action
- After saving, shows a banner offering to copy the workout to all same-weekday days in the same phase
- Copy uses `batchUpsertByWeekday` action with the list of matching dates
- Library picker: filters by sport (Run), then by run type (Easy/Long/Tempo/etc.)
  - Run type selection auto-sets the category filter to the matching category if one exists (Easy/Long/Quality match; Race has no library category so shows All)
  - Library workout keys use index to avoid duplicate key errors: `key={\`${w.name}-${i}\`}`

### Phases tab
- Chronological timeline mixing phase cards and A/B race cards
- A and B races appear as their own section cards (like a phase) — not inline
- C races appear inline within their phase card
- Phase cards show: name, dates, week count, goal, list of C races
- Race section cards show: race name, date, distance, grade badge

### Races tab
- List of all races with add/edit/delete
- Race grade: A (Target), B (Test), C (tune-up)
- Adding a race also creates/updates a Race plan day for that date
- Updating a race date resets the old date's plan day to Rest (via upsertPlanDay)
- Deleting a race resets that date's plan day to Rest

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

## Apps Script — plan_script.js

### Actions (doPost)
| Action | What it does |
|--------|-------------|
| `addPhase` | Appends a row to Phases tab |
| `updatePhase` | Finds phase by name (case-insensitive), updates fields |
| `deletePhase` | Finds phase by name, deletes row |
| `createPlanDays` | Deletes all rows in date range, batch-writes fresh Rest rows for every day |
| `upsertPlanDay` | Updates ALL rows matching the date (not just first — handles race+phase day overlap) |
| `deletePlanDays` | Deletes all plan rows in a date range |
| `addRace` | Appends to Races tab, sorts by date |
| `updateRace` | Finds race by name (case-insensitive), updates fields, sorts |
| `deleteRace` | Finds race by name (case-insensitive), deletes row |
| `batchUpsertByWeekday` | Given a set of dates, calls setRowFields on each matching plan row |

### Critical implementation notes
- `deleteRowsInRange`: iterates bottom-to-top to avoid row index shifting — do NOT replace with batch clearContent+setValues, that approach left stray rows alive
- `upsertPlanDay`: must update ALL matching rows for a date (not just first), because a race date can have two rows: one from `createPlanDays` (Rest) and one from `addRace` (Race). If only the first is updated to Rest, the Race row survives.
- `batchUpsertByWeekday`: use `setRowFields` per row — the full-sheet-rewrite approach (clearContent+setValues on the whole sheet) silently failed
- Race match is by name only (case-insensitive) — date matching caused "Race not found" errors

### CRITICAL: Deploying Apps Script changes
Saving the script does NOT update the live web app. You must:
1. Save the script (Cmd+S)
2. Deploy → Manage Deployments → Edit (pencil icon) → Version: "New version" → Deploy
3. Verify the deployment URL in Manage Deployments matches `PLAN_SHEETS_URL` in `.env.local`
   If they don't match, a new deployment was created — copy the new URL into `.env.local`

## Data Layer Notes

### fetchPlanData deduplication
The Plan sheet can have multiple rows for the same date (race day + createPlanDays row). Dedup rule: non-Rest rows win over Rest rows. Both-Rest → keep either. This is intentional to let race days overlay phase rows.

### 5-minute cache
All sheet fetches use `{ next: { revalidate: 300 } }`. Manually editing the sheet won't show in the app for up to 5 minutes. Restarting the dev server clears the cache immediately.

### Library sport normalization
The Workout Library uses "Running" as the sport name; the app normalizes to "Run" via `normalizeSport()` in `lib/sheets.ts`. Without this, the library picker shows no workouts for Run days.

## Deployment Status
- **Live at**: https://trainerv1.vercel.app
- **Vercel project**: fouloxs-projects/trainer_v1 (linked via CLI, auto-deploys from `main`)
- **Auth**: Clerk Development instance, Lou (foulox@gmail.com) is the only user
- **Not yet wired**: Vercel KV (KV_* vars not set), Strava, Apple Health, cron jobs

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

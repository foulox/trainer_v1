# Next Steps — trainer_v1

## Current Status (as of 2026-04-27)

The app is live and being used daily. Lou is actively building out phases and workouts in the Plan tab. The core plan editing loop (phases, races, day editor, copy-to-weekday) is built. The main blockers before the app is fully useful are Vercel KV (for AI notes) and Strava sync.

---

## Immediate — Apps Script (PENDING as of 2026-04-27)

Apps Script v3 is written and committed to the repo. **Two manual steps still needed in the Apps Script editor:**

1. **Run `cleanupPlanDuplicates()`** — select it in the function dropdown and click Run (▶). One-time cleanup of existing duplicate rows. Check Execution Log to confirm.
2. **Deploy v3** — Deploy → Manage Deployments → pencil → Version: "New version" → Deploy. Add "v3 - upsert per date, no more duplicates" to description.

After that, "Set up days" is safe to run repeatedly without creating duplicates.

**Verify deployment**: Top of the script file shows `// VERSION: v3`. Deployment description should say v3. Both should match.

---

## Active Plan Building

Lou is building out phases in the Weeks tab. Current workflow:
1. Add phases in Phases tab
2. "Set up days" on each phase to create blank rows
3. Edit individual days in the day editor
4. Use "copy to all [weekday] days in this phase" to apply a workout to an entire weekday

---

## Infrastructure — Remaining Setup

### Vercel KV (for AI coaching notes)
1. Vercel dashboard → project → Storage → Create Database → KV
2. Name it "trainer-kv" → Connect to project
3. Pull env vars locally: `npx vercel env pull .env.local`
4. Once wired, the Today and Week pages will show AI coaching content

### Strava Sync
1. Get credentials from the old marathon tracker Settings sheet (Client ID, Secret, Refresh Token)
2. Add to `.env.local` AND Vercel env vars: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REFRESH_TOKEN`
3. Deploy — `vercel.json` crons are wired (8am ET M-F, 11am ET Sat/Sun → `/api/strava/sync`)
4. Manual sync button is live on the Today page (small "Sync Strava" link at the bottom)

### Apple Health (iOS Shortcut)
Set up after Strava is working. The POST endpoint `/api/health` needs to be built.

### AI Coaching Cron Jobs
Needs Vercel KV + Anthropic key first (Anthropic key is already set in Vercel). Then:
- Nightly cron: generate coaching notes for next 7 days
- Sunday night cron: generate week-in-review

---

## Quick Reference — What's Done

- [x] Next.js app scaffolded and deployed to Vercel
- [x] All four screens built (Today, Week, Plan, Library)
- [x] Plan tab: Weeks / Phases / Races sub-tabs
- [x] Week view: calendar-week grouping (Mon–Sun), day editor, pagination
- [x] Day editor: workout fields, library picker, copy-to-weekday feature
- [x] Phases tab: chronological timeline, A/B races as section cards, C races inline
- [x] Races tab: add / edit / delete with grade (A/B/C)
- [x] Google Sheets Apps Scripts written and deployed (Plan, Data, Log sheets)
- [x] Data layer: lib/sheets.ts reads and normalizes all sheets
- [x] AI layer: lib/ai.ts — coaching notes + week review via Claude
- [x] KV helpers: lib/kv.ts — caching AI content (wiring pending)
- [x] Clerk auth: Lou signed in, works locally and on Vercel
- [x] Anthropic API key: set in Vercel env vars
- [x] Library sheet wired: LIBRARY_SHEETS_URL set, library picker works in day editor
- [ ] Vercel KV provisioned and wired
- [x] Strava sync code + cron config (vercel.json) — needs credentials to activate
- [ ] Apple Health iOS Shortcut + POST endpoint
- [ ] AI coaching cron jobs (needs KV)
- [ ] Today page: AI coaching note, HRV/sleep display (needs KV + Apple Health)
- [ ] Week page: AI week-in-review (needs KV)

# Next Steps — Getting trainer_v1 Live

Work through these in order. Each section depends on the previous one.

---

## 1. Clerk (Auth)

1. Go to [clerk.com](https://clerk.com) → Sign up → Create application
2. Name it "2026 Training"
3. Enable Google as a sign-in method (Settings → Social connections → Google)
4. Go to API Keys → copy both keys
5. Add to `.env.local`:
   ```
   CLERK_SECRET_KEY=sk_...
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   ```
6. Test locally: `npm run dev` → should redirect to sign-in at http://localhost:3000

---

## 2. Vercel — Link Project

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub → `foulox/trainer_v1`
2. Framework: Next.js (auto-detected)
3. Do NOT deploy yet — add env vars first (step 3)

---

## 3. Vercel — Environment Variables

In the Vercel project Settings → Environment Variables, add all of these:

| Name | Value |
|------|-------|
| `PLAN_SHEETS_URL` | *(from .env.local)* |
| `DATA_SHEETS_URL` | *(from .env.local)* |
| `LOG_SHEETS_URL` | *(from .env.local)* |
| `LIBRARY_SHEETS_URL` | *(leave blank for now)* |
| `CLERK_SECRET_KEY` | *(from Clerk)* |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | *(from Clerk)* |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `/` |
| `ANTHROPIC_API_KEY` | *(from Anthropic console — next step)* |

---

## 4. Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key
2. Copy it → add to Vercel env vars as `ANTHROPIC_API_KEY`
3. Also add to `.env.local` for local development

---

## 5. Vercel KV (for AI coaching note cache)

1. In Vercel dashboard → your project → Storage tab → Create Database → KV
2. Name it "trainer-kv"
3. Connect it to the project → Vercel auto-adds all `KV_*` env vars
4. Also pull them locally: `npx vercel env pull .env.local` (run from the trainer_v1 directory)

---

## 6. Deploy

1. In Vercel dashboard → Deployments → Deploy (or just push a commit to main)
2. Visit the live URL → should redirect to Clerk sign-in → sign in with Google
3. You should see the Today, Week, Plan, and Library tabs

---

## 7. Workout Library Sheet

The Library tab is a placeholder until this is wired up.

1. The Workout Library sheet already exists (shared with TigerWolves)
2. Get its Apps Script URL from the TigerWolves project (it's in tigerwolves/.env.local as `SHEETS_URL`)
3. Add it to Vercel env vars as `LIBRARY_SHEETS_URL`
4. Tell Claude — the Library screen can then be built out

---

## 8. Strava Setup

The app will sync Strava activities automatically once this is configured.

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api) → your existing app
2. You need three values from the existing marathon tracker Settings sheet:
   - Client ID
   - Client Secret
   - Refresh Token (the long one in B21)
3. Add to Vercel env vars:
   ```
   STRAVA_CLIENT_ID=
   STRAVA_CLIENT_SECRET=
   STRAVA_REFRESH_TOKEN=
   ```
4. Tell Claude — the Strava sync cron job is ready to be wired up

---

## 9. Apple Health (iOS Shortcut)

This sends HRV, sleep, and resting HR from your phone to the app automatically.

Set this up after the app is live and Strava is working. Tell Claude and we'll build the
iOS Shortcut configuration together.

---

## 10. AI Coaching Cron Jobs

These run automatically once deployed to Vercel.

- Nightly (midnight ET): generates coaching notes for the next 7 days
- Sunday night: generates week-in-review

Tell Claude when the app is live and Strava/Anthropic are wired up — we'll add the
cron jobs as the final step.

---

## Quick reference — what's already done

- [x] Next.js app scaffolded and pushed to GitHub
- [x] All four screens built (Today, Week, Plan, Library placeholder)
- [x] Google Sheets Apps Scripts written and deployed (all 3 sheets)
- [x] Sheet URLs saved in .env.local
- [x] Data layer (lib/sheets.ts, lib/data.ts) — reads all three sheets
- [x] AI layer (lib/ai.ts) — coaching notes + week review via Claude
- [x] KV helpers (lib/kv.ts) — caching AI content
- [ ] Clerk keys
- [ ] Vercel project linked
- [ ] Vercel KV provisioned
- [ ] Anthropic API key
- [ ] Strava credentials
- [ ] Apple Health shortcut
- [ ] Cron jobs
- [ ] Library screen (needs sheet URL)

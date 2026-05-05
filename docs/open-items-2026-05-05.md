# Open Items — 2026-05-05

## Done today (deployed)

- **`/api/health` fix**: route now writes `Sleep Quality` to the sheet when `sleepScore` or `sleep` is included in the Shortcut payload. Previously this column was never written by the Shortcut.
- **trainer_v1**: pre/post coaching cards, check-in chat, day drawer, PT summary date range, HRV integers, phase/race context in coaching.
- **TigerWolves**: workout variation/progression grouping in both Library and My Week views.

---

## Still to do

### 1. Sleep widget — Today page visibility

The sleep tile on the Today page doesn't always show, even though the user needs it to appear so the SleepWatch score can be entered manually.

**Suspected cause**: the widget is probably only rendered when `healthEntry.sleepScore` is non-null. It should always show when a health row exists for the day (or always show for today), so there's a visible placeholder to tap/fill.

**What to fix**: In `TodayClient.tsx`, find the sleep tile render condition and make it show unconditionally on today's date, even when `sleepScore` is null.

---

### 2. Apple Health Shortcut updates

Step-by-step guide already written: `docs/apple-health-shortcut-update-guide.md`

Fields not yet flowing from Shortcut to sheet:
- `wristTemp` → `Wrist Temp (°F)` — Apple Sleeping Wrist Temperature
- `cardioRecovery` → `Cardio Recovery` — Heart Rate Recovery One Minute
- `vo2max` → `VO2 Max` — Cardio Fitness

Sleep clarification: the Shortcut sends `sleepHours` (hours of actual sleep). The server route now also accepts `sleepScore` / `sleep` → writes to `Sleep Quality`. If the Shortcut is sending `sleepHours`, the route needs a `'Sleep Hours': body.sleepHours ?? ''` entry too — or rename the Shortcut key to `sleepScore`. Decide when working on the Shortcut.

---

### 3. Workout Library Google Sheet — add two columns

Both apps (trainer_v1 and TigerWolves) already read these columns by name. Just need to add them to the shared sheet:

| Column name   | Content                                                       | Example                           |
| ------------- | ------------------------------------------------------------- | --------------------------------- |
| `Variation`   | Specific variation description (blank for standalone)         | `2x(5-4-3-2-1 min) 1min easy rec` |
| `Progression` | Difficulty order number within the family (blank=standalone)  | `1`                               |

Column order in the sheet doesn't matter — apps read by header name.

For a workout family: multiple rows share the same `Workout Name`, each with a different `Variation` + `Progression` number.
Standalone workouts: leave `Variation` and `Progression` blank.

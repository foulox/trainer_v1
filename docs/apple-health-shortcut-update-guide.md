# Health Sync Shortcut — Update Guide for Claude

## Context for Claude

I'm updating an existing iOS Shortcut called **Health Sync** that sends Apple Health data
to my marathon training app. The shortcut is already built and partially working — I need
your help making specific changes to it.

Please guide me step by step, asking me to send a screenshot after each change so you
can confirm it looks right before moving on.

---

## What the shortcut does

It runs every morning, reads health metrics from Apple Health and Apple Watch, packages
them into a dictionary, and POSTs them to `https://trainerv1.vercel.app/api/health`
with a bearer token for auth.

---

## Current state (what I already have)

My shortcut currently has these variables set up and these dictionary entries:

**Variables already built:**
- `dateStr` — today's date formatted as yyyy-MM-dd
- `hrv` — Heart Rate Variability
- `restingHr` — Resting Heart Rate
- `sleepHours` — from Sleep Analysis (currently not working correctly)
- `activeCalories` — Active Energy Burned
- `water` — Dietary Water
- `weight` — Body Mass
- `vo2max` — VO2 Max / Cardio Fitness

**Dictionary currently has:**
- `date` → dateStr
- `hrv` → hrv (or Hrv)
- `restingHr` → restingHr
- `sleepHours` → sleepHours
- `activeCalories` → activeCalories
- `water` → water (or Water)
- `weight` → weight (or Weight)
- `vo2max` → vo2max

---

## Target state (what we're trying to get to)

The final dictionary should have exactly these entries:
- `date` → dateStr
- `hrv` → hrv
- `restingHr` → restingHr
- `respiratoryRate` → respiratoryRate   ← NEW
- `sleepHours` → sleepHours             ← FIX (currently broken)
- `wristTemp` → wristTemp               ← NEW
- `activeCalories` → activeCalories
- `cardioRecovery` → cardioRecovery     ← NEW
- `vo2max` → vo2max
- `weight` → weight
- `water` → water

---

## What needs to change

### 1. Fix the sleep hours action (currently not capturing data)

The existing sleep action needs a filter added so it only counts actual sleep time,
not the "In Bed" wrapper period. Find the Sleep Analysis action in the shortcut and
add a second filter:

- **Existing filter**: Start Date → is after → Yesterday at 8:00 PM  (keep this)
- **Add filter**: Category Value → is → **Asleep**

This tells it to only sum the samples where sleep was actually happening, not the
whole time-in-bed window.

### 2. Four new actions to add (before the dictionary step)

Each follows the same pattern as the existing HRV and Resting HR actions:
Find Health Samples → Get Numbers from Health Samples → Save to variable.

**New action: Respiratory Rate**
- Find Health Samples → Type: **Respiratory Rate**
- Sort by: Start Date → Latest First
- Limit: ON, set to 1
- Get Numbers from Health Samples
- Save to variable: `respiratoryRate`

**New action: Wrist Temperature**
- Find Health Samples → Type: **Apple Sleeping Wrist Temperature**
  (search for "wrist temperature")
- Sort by: Start Date → Latest First
- Limit: ON, set to 1
- Get Numbers from Health Samples
- Save to variable: `wristTemp`
- *Note: this records while sleeping, so it reflects last night's value*

**New action: Cardio Recovery**
- Find Health Samples → Type: **Heart Rate Recovery One Minute**
  (search for "heart rate recovery" or "cardio recovery")
- Sort by: Start Date → Latest First
- Limit: ON, set to 1
- Get Numbers from Health Samples
- Save to variable: `cardioRecovery`
- *Note: only recorded on workout days, will be blank on rest days*

### 3. Dictionary updates

Add these four new entries to the dictionary:
- Key: `respiratoryRate`  Value: the `respiratoryRate` variable
- Key: `wristTemp`        Value: the `wristTemp` variable
- Key: `cardioRecovery`   Value: the `cardioRecovery` variable

---

## Notes on blank fields

Some fields will often be blank — that's fine, the app handles them gracefully:
- **Respiratory Rate**: only recorded if Apple Watch was worn overnight
- **Sleep Score**: requires Apple Watch sleep tracking to be enabled
- **Wrist Temperature**: only recorded if Apple Watch was worn overnight
- **Cardio Recovery**: only recorded on workout days
- **VO2 Max**: updates every few days during outdoor runs, not daily
- **Weight**: only if the scale synced to Apple Health today
- **Water**: only if water was logged in the Health app today

---

## Google Sheet column order (for reference)

The app writes to these columns in this order:
`Date | Resting HR | HRV (ms) | Respiratory Rate | Sleep Score | Sleep Hours | Wrist Temp (°C) | Active Calories | Cardio Recovery | VO2 Max | Weight (lbs) | Water`

---

## How to guide me

1. Start by asking me to send a screenshot of the full shortcut (scroll through the whole
   thing) so you can see where things stand.
2. Tackle one change at a time — fix sleep first, then add the new actions one by one.
3. After each change, ask me to send a screenshot so you can confirm it looks right.
4. If something looks different from what you expect, help me figure out why before moving on.

The Shortcuts app can be fiddly — if I'm having trouble finding a specific health type,
suggest alternate search terms and ask me to send a screenshot of the search results.

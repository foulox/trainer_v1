# Apple Health → Trainer App: iOS Shortcut Setup

This guide creates a shareable iOS Shortcut that reads health data from Apple Health
and sends it to the trainer app once a day. The first time it runs, it asks for your
personal token — after that it runs silently. Takes about 20 minutes to set up.

## Metrics collected

| Metric | Source | Notes |
|---|---|---|
| HRV | Apple Watch | Best signal for recovery status |
| Resting HR | Apple Watch | Elevated = fatigue/illness |
| Respiratory Rate | Apple Watch (during sleep) | Elevated = overtraining signal |
| Sleep Hours | Apple Watch | Total sleep time |
| Active Calories | Apple Watch | Daily burn; high load + low HRV = real stress |
| Cardio Recovery | Apple Watch (post-workout) | HR drop in 1st minute after exercise |
| VO2 Max | Apple Watch | Updates every few days, not daily |
| Weight | Connected scale | Via Apple Health |
| Water | Manual log | Via Health app or any water-tracking app |

---

## What is a Shortcut?

A Shortcut is a mini-program you build by chaining together actions in Apple's Shortcuts
app. It runs top to bottom, like a recipe. You build it once, then automate it to run
every morning.

---

## Step 1 — Open Shortcuts

Open the **Shortcuts** app on your iPhone (it's built-in — search for it if you can't find it).

Tap the **+** button in the top-right corner to create a new shortcut.

Tap the name at the top (it says "New Shortcut") and rename it: **Health Sync**

---

## Step 2 — Add the actions

Tap **Add Action** (or the search bar at the bottom). For each action below, search for
the term shown and tap it to add it. Then configure it as described.

Work through these in order — each one becomes a step in your shortcut.

---

### Action 1: Load your saved token (runs silently after the first time)

This block checks whether you've already entered your token. If yes, it loads it silently.
If no, it asks you once and saves it for every future run.

**Action 1a — Try to load a saved token**

Search for: **Get File**

Settings:
- Location: **iCloud Drive**
- File path: type `Shortcuts/trainer_token.txt`
- Toggle OFF: **Show Document Picker**
- Toggle OFF: **Error if Not Found**

Tap the result bubble → **Add to Variable** → name it `savedToken`

---

**Action 1b — Check if the token exists**

Search for: **If**

Settings:
- Input: Variable → `savedToken`
- Condition: **has no value**

You'll see an "If" block with two sections: **If** (top) and **Otherwise** (bottom).

---

**Inside the "If" section** (this only runs the very first time):

Search for: **Ask for Input**

Settings:
- Prompt: `Enter your personal Trainer token`
- Input Type: **Text**

Tap the result bubble → **Add to Variable** → name it `token`

---

Search for: **Save File**

Settings:
- Content: Variable → `token`
- Tap the location area → choose **iCloud Drive** → navigate to the **Shortcuts** folder
- Filename: `trainer_token.txt`
- Toggle OFF: **Ask Where to Save**

---

**Tap "Otherwise"** (this runs on every run after the first):

Search for: **Text**

Content: tap the field and insert Variable → `savedToken`

Tap the result bubble → **Add to Variable** → name it `token`

---

**Tap "End If"** to close the block.

---

### Action 2: Get today's date

Search for: **Format Date**

Settings:
- Date: **Current Date**
- Format: tap "Short" and change to **Custom**
- Custom format: type `yyyy-MM-dd`

Tap the result bubble → **Add to Variable** → name it `dateStr`

---

### Action 3: Get HRV

Search for: **Find Health Samples**

Settings:
- Type: **Heart Rate Variability (SDNN)**
- Sort by: **Start Date** → **Latest First**
- Limit: turn ON, set to **1**

Add **Get Numbers from Health Samples** → input the result above

Tap result → **Add to Variable** → name it `hrv`

---

### Action 4: Get Resting Heart Rate

Search for: **Find Health Samples**

Settings:
- Type: **Resting Heart Rate**
- Sort by: **Start Date** → **Latest First**
- Limit: turn ON, set to **1**

Add **Get Numbers from Health Samples** → input the result above

Tap result → **Add to Variable** → name it `restingHr`

---

### Action 5: Get Respiratory Rate

Search for: **Find Health Samples**

Settings:
- Type: **Respiratory Rate**
- Sort by: **Start Date** → **Latest First**
- Limit: turn ON, set to **1**

Add **Get Numbers from Health Samples** → input the result above

Tap result → **Add to Variable** → name it `respiratoryRate`

> This is recorded by Apple Watch during sleep. Will be blank on days without overnight Watch wear.

---

### Action 6: Get last night's sleep

Search for: **Find Health Samples**

Settings:
- Type: **Sleep Analysis**
- Filter: tap **Add Filter**
  - Start Date → **is after** → **Yesterday at 8:00 PM**
- Sort by: **Start Date** → **Latest First**

Search for: **Get Details of Health Sample**
- Detail: **Duration**

Search for: **Calculate Statistics**
- Statistic: **Sum**
- Input: the durations from above

Search for: **Convert Measurement**
- Convert the result **to Hours** (it comes in seconds by default)

Tap result → **Add to Variable** → name it `sleepHours`

---

### Action 7: Get Active Calories

Search for: **Find Health Samples**

Settings:
- Type: **Active Energy Burned**
- Filter: tap **Add Filter**
  - Start Date → **is after** → **Today at 12:00 AM**
- Sort by: **Start Date** → **Latest First**

Add **Get Numbers from Health Samples** → **Calculate Statistics** → **Sum**

Tap result → **Add to Variable** → name it `activeCalories`

---

### Action 8: Get Cardio Recovery (heart rate recovery)

Search for: **Find Health Samples**

Settings:
- Type: **Heart Rate Recovery One Minute** (search "cardio recovery" or "heart rate recovery")
- Sort by: **Start Date** → **Latest First**
- Limit: turn ON, set to **1**

Add **Get Numbers from Health Samples** → input the result above

Tap result → **Add to Variable** → name it `cardioRecovery`

> This is recorded by Apple Watch after workouts. Will be blank on rest days.

---

### Action 9: Get VO2 Max

Search for: **Find Health Samples**

Settings:
- Type: **VO2 Max** (search "cardio fitness")
- Sort by: **Start Date** → **Latest First**
- Limit: turn ON, set to **1**

Add **Get Numbers from Health Samples** → input the result above

Tap result → **Add to Variable** → name it `vo2max`

> Apple Watch updates this every few days during outdoor runs, not daily.

---

### Action 10: Get Weight

Search for: **Find Health Samples**

Settings:
- Type: **Body Mass**
- Sort by: **Start Date** → **Latest First**
- Limit: turn ON, set to **1**

Add **Get Numbers from Health Samples** → input the result above

Tap result → **Add to Variable** → name it `weight`

---

### Action 11: Get Water

Search for: **Find Health Samples**

Settings:
- Type: **Dietary Water**
- Filter: tap **Add Filter**
  - Start Date → **is after** → **Today at 12:00 AM**
- Sort by: **Start Date** → **Latest First**

Add **Get Numbers from Health Samples** → **Calculate Statistics** → **Sum**

Search for: **Convert Measurement**
- Convert the result **to fl oz** (it comes in liters by default)

Tap result → **Add to Variable** → name it `water`

---

### Action 12: Build the data package

Search for: **Dictionary**

Add these key/value pairs (tap **+** for each one):
- Key: `date`              Value: Variable → `dateStr`
- Key: `hrv`               Value: Variable → `hrv`
- Key: `restingHr`         Value: Variable → `restingHr`
- Key: `respiratoryRate`   Value: Variable → `respiratoryRate`
- Key: `sleepHours`        Value: Variable → `sleepHours`
- Key: `activeCalories`    Value: Variable → `activeCalories`
- Key: `cardioRecovery`    Value: Variable → `cardioRecovery`
- Key: `vo2max`            Value: Variable → `vo2max`
- Key: `weight`            Value: Variable → `weight`
- Key: `water`             Value: Variable → `water`

---

### Action 13: Send it to the app

Search for: **Get Contents of URL**

Settings:
- URL: `https://trainerv1.vercel.app/api/health`
- Method: **POST**
- Headers: tap **Add new header**
  - Key: `Authorization`
  - Value: tap the field → insert `Bearer ` (with a space after it) → then insert Variable → `token`
- Request Body: **JSON**
- Body content: select the Dictionary variable from Action 11 directly as the body

---

## Step 3 — Test it manually

Tap the **Play** button (▶) at the bottom of the shortcut.

The first time, it will pause and ask: **"Enter your personal Trainer token"**

Enter your token, then tap Done.

> **Your token:** `82803152c8cd16b50185fd170294601c03a0936d159e256e9ddc8606358a7ff4`

It will save the token and continue. On every run after this, it won't ask again.

Then check your Training Data Google Sheet → Apple Health tab — you should see a
new row for today.

---

## Step 4 — Automate it

Go back to the main Shortcuts screen. Tap the **Automation** tab at the bottom.

Tap **+** → **Personal Automation** → **Time of Day**

- Time: **8:00 AM**
- Repeat: **Daily**
- Run After Shortcut: **Health Sync** (the one you just built)

Tap **Done**. Disable "Ask Before Running" if prompted, so it runs silently.

> Note: iOS requires the device to be unlocked for the shortcut to run. If your phone
> is locked at 8am, it will run automatically the next time you unlock it. For a
> training app this is fine — it'll run by the time you check your phone.

---

## Step 5 — Share it (optional)

Once you've confirmed it works, you can share it with others:

1. Tap and hold the **Health Sync** shortcut → **Share**
2. Tap **Copy iCloud Link**
3. Send that link to anyone who should use the app

When they tap the link, the shortcut installs automatically. The first time they run it,
they'll be prompted for their own personal token. Their token will be different from yours.

---

## Troubleshooting

**No data appears in the sheet:**
- Check that the token you entered matches `HEALTH_SYNC_SECRET` exactly (no extra spaces)
- To re-enter your token: open Files app → iCloud Drive → Shortcuts → delete `trainer_token.txt`, then run the shortcut again

**HRV, Resting HR, Respiratory Rate are empty:**
- These require Apple Watch. If you don't wear it overnight, Respiratory Rate won't record.

**Cardio Recovery is empty:**
- Only recorded on workout days. Expected blank on rest days.

**VO2 Max is empty:**
- Only updates every few days during outdoor runs. Expected to be blank most days.

**Sleep shows 0:**
- The filter assumes you go to bed after 8pm. Adjust the "Yesterday at 8:00 PM"
  cutoff if you go to bed earlier.

**Water shows 0:**
- Only populates if water was logged in the Health app today before the shortcut ran.

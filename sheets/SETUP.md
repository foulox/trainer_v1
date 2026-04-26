# Google Sheets Setup

Create three new Google Sheets with these exact names and tabs.
Import the corresponding CSV from this folder as each tab.

---

## Sheet 1: "2026 Lou Fox Training Plan"
| Tab Name | CSV File |
|----------|----------|
| Plan | plan_plan.csv |
| Phases | plan_phases.csv |
| Races | plan_races.csv |

---

## Sheet 2: "2026 Lou Fox Training Data"
| Tab Name | CSV File |
|----------|----------|
| Strava Data | data_strava.csv |
| Apple Health | data_apple_health.csv |

---

## Sheet 3: "2026 Lou Fox Training Log"
| Tab Name | CSV File |
|----------|----------|
| Training Log | log_training.csv |

---

## Sheet 4: Workout Library (existing — no changes needed)
Already live. Shared with TigerWolves.

---

## How to import a CSV as a tab
1. Open the Google Sheet
2. Click the + button to add a new tab
3. In the new tab: File → Import → Upload the CSV → select "Insert into current sheet"
4. Rename the tab to match the Tab Name column above

---

## After setup
Each sheet needs an Apps Script with a doGet() endpoint.
Once all three sheets are created, share the Sheet IDs and I'll write the Apps Script for each.
The Sheet ID is the long string in the URL: docs.google.com/spreadsheets/d/THIS_PART/edit

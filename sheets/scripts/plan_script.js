// ============================================================
// 2026 Lou Fox Training Plan — Apps Script
// Tabs: Plan, Phases, Races
// ============================================================

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const result = {
    plan:   sheetToObjects(ss.getSheetByName('Plan')),
    phases: sheetToObjects(ss.getSheetByName('Phases')),
    races:  sheetToObjects(ss.getSheetByName('Races')),
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents)

    // Update the Workout field for a specific date in the Plan tab
    if (payload.action === 'setWorkout') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Plan')
      const data = sheet.getDataRange().getValues()
      const headers = data[0]
      const dateCol = headers.indexOf('Date')
      const workoutCol = headers.indexOf('Workout')
      for (let i = 1; i < data.length; i++) {
        const rowDate = formatDate(data[i][dateCol])
        if (rowDate === payload.date) {
          sheet.getRange(i + 1, workoutCol + 1).setValue(payload.workout)
          return ok()
        }
      }
      return err('Date not found in Plan')
    }

    return err('Unknown action: ' + payload.action)
  } catch (e) {
    return err(e.message)
  }
}

// ── Helpers ──────────────────────────────────────────────────

function sheetToObjects(sheet) {
  if (!sheet) return []
  const [headers, ...rows] = sheet.getDataRange().getValues()
  return rows
    .filter(r => r.some(c => c !== ''))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, formatCell(h, r[i])])))
}

function formatCell(header, value) {
  if (value && typeof value === 'object' && typeof value.getTime === 'function') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd')
  }
  return value
}

function formatDate(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd')
  }
  return String(value).slice(0, 10)
}

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, ...data }))
    .setMimeType(ContentService.MimeType.JSON)
}

function err(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON)
}

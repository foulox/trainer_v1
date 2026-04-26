// ============================================================
// 2026 Lou Fox Training Log — Apps Script
// Tab: Training Log
// ============================================================

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const result = {
    log: sheetToObjects(ss.getSheetByName('Training Log')),
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents)

    // Append a new training log entry (from Strava sync or manual log)
    if (payload.action === 'appendLog') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Training Log')
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]

      // Deduplicate by Strava ID if present
      if (payload.data['Strava ID']) {
        const existingIds = sheet.getLastRow() > 1
          ? sheet.getRange(2, 16, sheet.getLastRow() - 1, 1).getValues().flat().map(String)
          : []
        if (existingIds.includes(String(payload.data['Strava ID']))) {
          return ok({ skipped: true, reason: 'Strava activity already logged' })
        }
      }

      const row = headers.map(h => payload.data[h] ?? '')
      sheet.appendRow(row)
      return ok()
    }

    // Update an existing log entry by date (for manual edits from the app)
    if (payload.action === 'updateLog') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Training Log')
      const data = sheet.getDataRange().getValues()
      const headers = data[0]
      const dateCol = headers.indexOf('Date')
      const stravaCol = headers.indexOf('Strava ID')

      // Match by Strava ID if provided, otherwise by date
      for (let i = 1; i < data.length; i++) {
        const matchById = payload.data['Strava ID'] && String(data[i][stravaCol]) === String(payload.data['Strava ID'])
        const matchByDate = !payload.data['Strava ID'] && formatDate(data[i][dateCol]) === payload.data['Date']
        if (matchById || matchByDate) {
          headers.forEach((h, col) => {
            if (payload.data[h] !== undefined) {
              sheet.getRange(i + 1, col + 1).setValue(payload.data[h])
            }
          })
          return ok()
        }
      }
      return err('Entry not found')
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

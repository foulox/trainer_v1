// ============================================================
// 2026 Lou Fox Training Data — Apps Script
// Tabs: Strava Data, Apple Health
// ============================================================

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const result = {
    strava: sheetToObjects(ss.getSheetByName('Strava Data')),
    health: sheetToObjects(ss.getSheetByName('Apple Health')),
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents)

    // Append a Strava activity (called by the Vercel cron sync)
    if (payload.action === 'appendStrava') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Strava Data')
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]

      // Deduplicate by Activity ID
      const existingIds = sheet.getLastRow() > 1
        ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat().map(String)
        : []
      if (existingIds.includes(String(payload.data['Activity ID']))) {
        return ok({ skipped: true, reason: 'Activity already exists' })
      }

      const row = headers.map(h => payload.data[h] ?? '')
      sheet.appendRow(row)
      return ok()
    }

    // Append an Apple Health entry (called by iOS Shortcut)
    if (payload.action === 'appendHealth') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Apple Health')
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]

      // Overwrite today's row if it already exists, otherwise append
      const today = payload.data['Date']
      if (sheet.getLastRow() > 1) {
        const dates = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat()
        for (let i = 0; i < dates.length; i++) {
          if (formatDate(dates[i]) === today) {
            const row = headers.map(h => payload.data[h] ?? '')
            sheet.getRange(i + 2, 1, 1, row.length).setValues([row])
            return ok({ updated: true })
          }
        }
      }
      const row = headers.map(h => payload.data[h] ?? '')
      sheet.appendRow(row)
      return ok()
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
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return y + '-' + m + '-' + d
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

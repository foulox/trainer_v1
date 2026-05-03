// ============================================================
// 2026 Lou Fox Training Data — Apps Script
// Tabs: Strava Data, Apple Health
// Version: 5
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

    // Append or update a Strava activity (called by the Vercel cron sync)
    if (payload.action === 'appendStrava') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Strava Data')
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      const now = new Date().toISOString()

      const existingIds = sheet.getLastRow() > 1
        ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat().map(String)
        : []
      const existingIndex = existingIds.indexOf(String(payload.data['Activity ID']))

      if (existingIndex !== -1) {
        // Update existing row so description/RPE changes in Strava are reflected
        const row = headers.map(h => h === 'Last Updated' ? now : (payload.data[h] ?? ''))
        sheet.getRange(existingIndex + 2, 1, 1, row.length).setValues([row])
        return ok({ updated: true })
      }

      const row = headers.map(h => h === 'Last Updated' ? now : (payload.data[h] ?? ''))
      sheet.appendRow(row)
      return ok()
    }

    // Partially update an Apple Health row by date (only updates fields present in payload)
    if (payload.action === 'patchHealth') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Apple Health')
      const data = sheet.getDataRange().getValues()
      const headers = data[0]
      const today = String(payload.data['Date']).trim()

      for (let i = 1; i < data.length; i++) {
        if (formatDate(data[i][0]) === today) {
          const now = new Date().toISOString()
          headers.forEach((h, col) => {
            if (h === 'Last Updated') {
              sheet.getRange(i + 1, col + 1).setValue(now)
            } else if (payload.data[h] !== undefined) {
              sheet.getRange(i + 1, col + 1).setValue(payload.data[h])
            }
          })
          return ok({ updated: true })
        }
      }
      // No row for this date yet — append a minimal row
      const now = new Date().toISOString()
      const row = headers.map(h => h === 'Last Updated' ? now : (payload.data[h] ?? ''))
      sheet.appendRow(row)
      return ok({ appended: true })
    }

    // Append an Apple Health entry (called by iOS Shortcut)
    if (payload.action === 'appendHealth') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Apple Health')
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]

      // Overwrite today's row if it already exists, otherwise append
      const today = String(payload.data['Date']).trim()
      Logger.log('appendHealth: today=' + JSON.stringify(today))
      if (sheet.getLastRow() > 1) {
        const dates = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat()
        Logger.log('appendHealth: ' + dates.length + ' rows to check')
        for (let i = 0; i < dates.length; i++) {
          const formatted = formatDate(dates[i])
          Logger.log('row ' + (i + 2) + ': raw=' + JSON.stringify(String(dates[i])) + ' formatted=' + JSON.stringify(formatted) + ' match=' + (formatted === today))
          if (formatted === today) {
            const now = new Date().toISOString()
            const row = headers.map(h => h === 'Last Updated' ? now : (payload.data[h] ?? ''))
            sheet.getRange(i + 2, 1, 1, row.length).setValues([row])
            return ok({ updated: true })
          }
        }
        Logger.log('appendHealth: no match found, appending')
      }
      const now = new Date().toISOString()
      const row = headers.map(h => h === 'Last Updated' ? now : (payload.data[h] ?? ''))
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

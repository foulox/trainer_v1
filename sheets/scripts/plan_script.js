// ============================================================
// 2026 Lou Fox Training Plan — Apps Script
// Tabs: Plan, Phases, Races
//
// VERSION: v3
// CHANGES: createPlanDays now upserts per-date (Date = unique key) instead of
//          delete-all-then-insert, eliminating duplicate rows at the root.
//          Added cleanupPlanDuplicates() standalone function for one-time cleanup.
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
    const ss = SpreadsheetApp.getActiveSpreadsheet()

    // ── Phase actions ──────────────────────────────────────────

    if (payload.action === 'addPhase') {
      const sheet = ss.getSheetByName('Phases')
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      const row = headersToRow(headers, {
        'Phase Name': payload.name,
        'Start Date': payload.startDate,
        'End Date':   payload.endDate,
        'Weeks':      payload.weeks,
        'Goal / Focus': payload.goal,
      })
      sheet.appendRow(row)
      return ok()
    }

    if (payload.action === 'updatePhase') {
      const sheet = ss.getSheetByName('Phases')
      const data = sheet.getDataRange().getValues()
      const headers = data[0]
      const nameCol = headers.indexOf('Phase Name')
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][nameCol]).trim().toLowerCase() === String(payload.originalName).trim().toLowerCase()) {
          setRowFields(sheet, i + 1, headers, {
            'Phase Name': payload.name,
            'Start Date': payload.startDate,
            'End Date':   payload.endDate,
            'Weeks':      payload.weeks,
            'Goal / Focus': payload.goal,
          })
          return ok()
        }
      }
      return err('Phase not found: ' + payload.originalName)
    }

    if (payload.action === 'deletePhase') {
      const sheet = ss.getSheetByName('Phases')
      const data = sheet.getDataRange().getValues()
      const headers = data[0]
      const nameCol = headers.indexOf('Phase Name')
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][nameCol]).trim().toLowerCase() === String(payload.name).trim().toLowerCase()) {
          sheet.deleteRow(i + 1)
          return ok()
        }
      }
      return err('Phase not found: ' + payload.name)
    }

    // ── Plan row actions ───────────────────────────────────────

    if (payload.action === 'createPlanDays') {
      // Upsert-per-date: Date is the unique key for the Plan sheet.
      // For each date in range:
      //   - If one row exists → reset it to Rest in-place
      //   - If multiple rows exist → keep one, delete the rest, reset the kept one
      //   - If no row exists → append a new Rest row
      // This is idempotent: running it twice leaves the same clean result.
      const sheet = ss.getSheetByName('Plan')
      const data = sheet.getDataRange().getValues()
      const headers = data[0]
      const dateCol = headers.indexOf('Date')
      const weekOffset = payload.weekOffset ?? 1
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

      // Build target date map: isoDate -> { dayName, weekNum }
      const dateTarget = new Map()
      {
        let current = new Date(payload.startDate + 'T00:00:00')
        const end = new Date(payload.endDate + 'T00:00:00')
        let dayIndex = 0
        while (current <= end) {
          const isoDate = Utilities.formatDate(current, Session.getScriptTimeZone(), 'yyyy-MM-dd')
          dateTarget.set(isoDate, {
            dayName: dayNames[current.getDay()],
            weekNum: weekOffset + Math.floor(dayIndex / 7),
          })
          current.setDate(current.getDate() + 1)
          dayIndex++
        }
      }

      const resetFields = {
        'Day Type': 'Rest', 'Run Type': '', 'Workout': '', 'Distance (mi)': '',
        'Target Pace (min/mi)': '', 'HR Zone': '', 'Intensity': '',
        'Energy System': '', 'Reason / Purpose': '', 'Instructions': '', 'Notes': '',
      }
      const resetEntries = Object.entries(resetFields)

      // Scan existing rows: first row per date gets reset in-memory, extras go to toDelete.
      const seen = new Set()     // dates we've already claimed a row for
      const toDelete = []        // 1-indexed sheet rows to delete (duplicates)
      let minChanged = Infinity
      let maxChanged = -Infinity

      for (let i = 1; i < data.length; i++) {
        const d = formatDate(data[i][dateCol])
        if (!dateTarget.has(d)) continue
        if (seen.has(d)) {
          toDelete.push(i + 1)
        } else {
          seen.add(d)
          const info = dateTarget.get(d)
          data[i][headers.indexOf('Phase')] = payload.phaseName
          data[i][headers.indexOf('Day')]   = info.dayName
          data[i][headers.indexOf('Week#')] = info.weekNum
          for (const [key, val] of resetEntries) {
            const col = headers.indexOf(key)
            if (col !== -1) data[i][col] = val
          }
          if (i < minChanged) minChanged = i
          if (i > maxChanged) maxChanged = i
        }
      }

      // Write back all updated rows in one call.
      if (minChanged !== Infinity) {
        sheet.getRange(minChanged + 1, 1, maxChanged - minChanged + 1, headers.length)
          .setValues(data.slice(minChanged, maxChanged + 1))
      }

      // Delete duplicate rows bottom-to-top in contiguous batches.
      if (toDelete.length > 0) {
        toDelete.sort((a, b) => b - a)
        let k = 0
        while (k < toDelete.length) {
          const topRow = toDelete[k]
          let count = 1
          while (k + count < toDelete.length && toDelete[k + count] === topRow - count) count++
          sheet.deleteRows(topRow - count + 1, count)
          k += count
        }
      }

      // Append rows for any dates that had no existing row at all.
      const newRows = []
      for (const [isoDate, info] of dateTarget.entries()) {
        if (!seen.has(isoDate)) {
          newRows.push(headersToRow(headers, {
            'Date': isoDate, 'Day': info.dayName, 'Week#': info.weekNum,
            'Phase': payload.phaseName, 'Day Type': 'Rest',
          }))
        }
      }
      if (newRows.length > 0) {
        const lastRow = sheet.getLastRow()
        sheet.getRange(lastRow + 1, 1, newRows.length, headers.length).setValues(newRows)
      }

      sortSheetByDate(sheet, headers)
      return ok({ rowsReset: seen.size, rowsDeleted: toDelete.length, rowsAdded: newRows.length })
    }

    if (payload.action === 'upsertPlanDay') {
      // Add or update a single plan row for a specific date.
      const sheet = ss.getSheetByName('Plan')
      const data = sheet.getDataRange().getValues()
      const headers = data[0]
      const dateCol = headers.indexOf('Date')

      const fields = {
        'Day Type':              payload.dayType ?? 'Run',
        'Run Type':              payload.runType ?? '',
        'Workout':               payload.workout ?? '',
        'Distance (mi)':         payload.distance ?? '',
        'Target Pace (min/mi)':  payload.targetPace ?? '',
        'HR Zone':               payload.hrZone ?? '',
        'Intensity':             payload.intensity ?? '',
        'Energy System':         payload.energySystem ?? '',
        'Reason / Purpose':      payload.reason ?? '',
        'Instructions':          payload.instructions ?? '',
        'Notes':                 payload.notes ?? '',
      }
      const fieldEntries = Object.entries(fields)

      // Update all matching rows in-memory, then write back in one batch call.
      let firstMatch = -1
      let lastMatch = -1
      for (let i = 1; i < data.length; i++) {
        const rowDate = formatDate(data[i][dateCol])
        if (rowDate === payload.date) {
          for (const [key, value] of fieldEntries) {
            const col = headers.indexOf(key)
            if (col !== -1) data[i][col] = value
          }
          if (firstMatch === -1) firstMatch = i
          lastMatch = i
        }
      }
      if (firstMatch !== -1) {
        // Rows are date-sorted so matching rows are contiguous — single write covers all.
        const numRows = lastMatch - firstMatch + 1
        sheet.getRange(firstMatch + 1, 1, numRows, headers.length)
          .setValues(data.slice(firstMatch, lastMatch + 1))
        return ok()
      }

      // Row doesn't exist — append it (shouldn't happen if createPlanDays ran first)
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const d = new Date(payload.date + 'T00:00:00')
      const newRow = headersToRow(headers, {
        'Date':  payload.date,
        'Day':   dayNames[d.getDay()],
        'Week#': payload.week ?? '',
        'Phase': payload.phase ?? '',
        ...fields,
      })
      sheet.appendRow(newRow)
      sortSheetByDate(sheet, headers)
      return ok()
    }

    if (payload.action === 'deletePlanDays') {
      // Delete all plan rows in a date range.
      const sheet = ss.getSheetByName('Plan')
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      deleteRowsInRange(sheet, headers, payload.startDate, payload.endDate)
      return ok()
    }

    // ── Race actions ───────────────────────────────────────────

    if (payload.action === 'addRace') {
      const sheet = ss.getSheetByName('Races')
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      const row = headersToRow(headers, {
        'Race Name': payload.name,
        'Date':      payload.date,
        'Distance':  payload.distance,
        'Purpose':   payload.purpose,
        'Location':  payload.location ?? '',
        'Notes':     payload.notes ?? '',
      })
      sheet.appendRow(row)
      sortSheetByDate(sheet, headers)
      return ok()
    }

    if (payload.action === 'updateRace') {
      const sheet = ss.getSheetByName('Races')
      const data = sheet.getDataRange().getValues()
      const headers = data[0]
      const nameCol = headers.indexOf('Race Name')
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][nameCol]).trim().toLowerCase() === String(payload.originalName).trim().toLowerCase()) {
          setRowFields(sheet, i + 1, headers, {
            'Race Name': payload.name,
            'Date':      payload.date,
            'Distance':  payload.distance,
            'Purpose':   payload.grade,
            'Location':  payload.location ?? '',
            'Notes':     payload.notes ?? '',
          })
          sortSheetByDate(sheet, headers)
          return ok()
        }
      }
      return err('Race not found: ' + payload.originalName)
    }

    if (payload.action === 'deleteRace') {
      const sheet = ss.getSheetByName('Races')
      const data = sheet.getDataRange().getValues()
      const headers = data[0]
      const nameCol = headers.indexOf('Race Name')
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][nameCol]).trim().toLowerCase() === String(payload.name).trim().toLowerCase()) {
          sheet.deleteRow(i + 1)
          return ok()
        }
      }
      return err('Race not found: ' + payload.name)
    }

    // ── Batch weekday apply ────────────────────────────────────

    if (payload.action === 'batchUpsertByWeekday') {
      // Apply workout fields to a set of specific dates.
      // Read-once, update in-memory, write the entire data range back in one call.
      const sheet = ss.getSheetByName('Plan')
      const data = sheet.getDataRange().getValues()
      const headers = data[0]
      const dateCol = headers.indexOf('Date')
      const dateSet = new Set(payload.dates)
      const fields = {
        'Day Type':             payload.dayType ?? 'Run',
        'Run Type':             payload.runType ?? '',
        'Workout':              payload.workout ?? '',
        'Distance (mi)':        payload.distance ?? '',
        'Target Pace (min/mi)': payload.targetPace ?? '',
        'HR Zone':              payload.hrZone ?? '',
        'Intensity':            payload.intensity ?? '',
        'Energy System':        payload.energySystem ?? '',
        'Reason / Purpose':     payload.reason ?? '',
        'Instructions':         payload.instructions ?? '',
        'Notes':                payload.notes ?? '',
      }
      const fieldEntries = Object.entries(fields)
      let changed = false
      for (let i = 1; i < data.length; i++) {
        if (dateSet.has(formatDate(data[i][dateCol]))) {
          for (const [key, value] of fieldEntries) {
            const col = headers.indexOf(key)
            if (col !== -1) data[i][col] = value
          }
          changed = true
        }
      }
      if (changed && data.length > 1) {
        sheet.getRange(2, 1, data.length - 1, headers.length).setValues(data.slice(1))
      }
      return ok()
    }

    // Legacy action kept for backwards compatibility
    if (payload.action === 'setWorkout') {
      const sheet = ss.getSheetByName('Plan')
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
  } catch (ex) {
    return err(ex.message)
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

function headersToRow(headers, fields) {
  return headers.map(h => (h in fields ? fields[h] : ''))
}

function setRowFields(sheet, rowNum, headers, fields) {
  // Read the full row, update fields in-memory, write back in one call.
  const range = sheet.getRange(rowNum, 1, 1, headers.length)
  const values = range.getValues()[0]
  for (const [key, value] of Object.entries(fields)) {
    const col = headers.indexOf(key)
    if (col !== -1) values[col] = value
  }
  range.setValues([values])
}

function deleteRowsInRange(sheet, headers, startDate, endDate) {
  const data = sheet.getDataRange().getValues()
  const dateCol = headers.indexOf('Date')
  // Collect 1-indexed sheet rows to delete, descending order (bottom-to-top).
  const rowsToDelete = []
  for (let i = data.length - 1; i >= 1; i--) {
    const d = formatDate(data[i][dateCol])
    if (d >= startDate && d <= endDate) rowsToDelete.push(i + 1)
  }
  // Batch-delete contiguous row groups — far fewer API calls than one-at-a-time.
  let i = 0
  while (i < rowsToDelete.length) {
    const topRow = rowsToDelete[i]
    let count = 1
    while (i + count < rowsToDelete.length && rowsToDelete[i + count] === topRow - count) {
      count++
    }
    // deleteRows(firstRowInGroup, count); delete high-numbered rows first so lower indices stay valid.
    sheet.deleteRows(topRow - count + 1, count)
    i += count
  }
}

function sortSheetByDate(sheet, headers) {
  const dateCol = headers.indexOf('Date')
  if (dateCol === -1) return
  const lastRow = sheet.getLastRow()
  if (lastRow <= 2) return
  sheet.getRange(2, 1, lastRow - 1, headers.length).sort({ column: dateCol + 1, ascending: true })
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

// ── Standalone cleanup — run directly from Apps Script editor ────
// Select this function in the editor and click Run to deduplicate
// the Plan sheet. Safe to run any time; keeps the best row per date
// (non-Rest beats Rest; if tied keeps the first one found).
function cleanupPlanDuplicates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const sheet = ss.getSheetByName('Plan')
  const data = sheet.getDataRange().getValues()
  const headers = data[0]
  const dateCol = headers.indexOf('Date')
  const dayTypeCol = headers.indexOf('Day Type')

  const seen = new Map()  // date -> { rowIdx, isRest }
  const toDelete = []

  for (let i = 1; i < data.length; i++) {
    const d = formatDate(data[i][dateCol])
    if (!d || d.length < 10) continue
    const isRest = !data[i][dayTypeCol] || String(data[i][dayTypeCol]).trim() === 'Rest' || String(data[i][dayTypeCol]).trim() === ''

    if (!seen.has(d)) {
      seen.set(d, { rowIdx: i, isRest })
    } else {
      const prev = seen.get(d)
      if (!isRest && prev.isRest) {
        // Current is non-Rest (better) — delete the previous Rest row, keep this one
        toDelete.push(prev.rowIdx + 1)
        seen.set(d, { rowIdx: i, isRest: false })
      } else {
        // Current is same or worse — delete it
        toDelete.push(i + 1)
      }
    }
  }

  if (toDelete.length === 0) {
    Logger.log('Plan sheet is clean — no duplicates found.')
    return
  }

  Logger.log('Deleting ' + toDelete.length + ' duplicate rows...')
  toDelete.sort((a, b) => b - a)
  let k = 0
  while (k < toDelete.length) {
    const topRow = toDelete[k]
    let count = 1
    while (k + count < toDelete.length && toDelete[k + count] === topRow - count) count++
    sheet.deleteRows(topRow - count + 1, count)
    k += count
  }
  Logger.log('Done. ' + toDelete.length + ' duplicate rows removed. ' + seen.size + ' unique dates remain.')
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

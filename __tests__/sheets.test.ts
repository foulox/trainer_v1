import { paceSafe, normalizeSport, mapStrava, mapLog, mapPlan, deduplicatePlanRows } from '../lib/sheets'

// ─── paceSafe ────────────────────────────────────────────────────────────────

describe('paceSafe', () => {
  it('returns null for empty string', () => {
    expect(paceSafe('')).toBeNull()
  })

  it('returns null for null', () => {
    expect(paceSafe(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(paceSafe(undefined)).toBeNull()
  })

  it('returns null for Google Sheets date-serial artifact — the production bug', () => {
    expect(paceSafe('1899-12-30 08:43:27')).toBeNull()
  })

  it('returns null for any date-pattern string', () => {
    expect(paceSafe('2024-05-01 00:00:00')).toBeNull()
    expect(paceSafe('2026-01-15')).toBeNull()
  })

  it('passes through a valid pace string', () => {
    expect(paceSafe('8:30')).toBe('8:30')
  })

  it('passes through a pace with /mi suffix', () => {
    expect(paceSafe('10:15/mi')).toBe('10:15/mi')
  })

  it('trims surrounding whitespace', () => {
    expect(paceSafe('  9:00  ')).toBe('9:00')
  })
})

// ─── normalizeSport ──────────────────────────────────────────────────────────

describe('normalizeSport', () => {
  it('normalizes "Running" (the actual sheet value) to "Run"', () => {
    expect(normalizeSport('Running')).toBe('Run')
  })

  it('normalizes lowercase "running" to "Run"', () => {
    expect(normalizeSport('running')).toBe('Run')
  })

  it('normalizes "cycling" to "Bike"', () => {
    expect(normalizeSport('cycling')).toBe('Bike')
  })

  it('normalizes "biking" to "Bike"', () => {
    expect(normalizeSport('biking')).toBe('Bike')
  })

  it('passes through unknown sports unchanged', () => {
    expect(normalizeSport('Strength')).toBe('Strength')
    expect(normalizeSport('Yoga')).toBe('Yoga')
  })

  it('trims whitespace from unknown sports', () => {
    expect(normalizeSport('  Swim  ')).toBe('Swim')
  })
})

// ─── mapStrava ───────────────────────────────────────────────────────────────

describe('mapStrava', () => {
  const baseRow = {
    'Activity ID': 'abc123',
    'Date': '2026-05-23',
    'Name': 'Morning Run',
    'Type': 'Run',
    'Distance (mi)': '6.02',
    'Moving Time (min)': '52.5',
    'Avg Pace (min/mi)': '8:43',
    'Avg HR': '134.9',
    'Max HR': '150',
    'Calories': '520',
    'Elevation (ft)': '210',
    'Description': 'Good run',
    'Strava URL': 'https://strava.com/activities/abc123',
  }

  it('maps basic fields correctly', () => {
    const result = mapStrava(baseRow)
    expect(result.activityId).toBe('abc123')
    expect(result.date).toBe('2026-05-23')
    expect(result.name).toBe('Morning Run')
    expect(result.distance).toBe(6.02)
    expect(result.movingTime).toBe(52.5)
    expect(result.avgHr).toBe(134.9)
  })

  it('passes a valid pace string through', () => {
    expect(mapStrava(baseRow).pace).toBe('8:43')
  })

  it('rejects Google Sheets date-serial in the pace field — regression', () => {
    const row = { ...baseRow, 'Avg Pace (min/mi)': '1899-12-30 08:43:27' }
    expect(mapStrava(row).pace).toBeNull()
  })

  it('returns null pace for empty pace field', () => {
    const row = { ...baseRow, 'Avg Pace (min/mi)': '' }
    expect(mapStrava(row).pace).toBeNull()
  })

  it('defaults distance to 0 when missing', () => {
    const row = { ...baseRow, 'Distance (mi)': '' }
    expect(mapStrava(row).distance).toBe(0)
  })

  it('truncates date to 10 chars when sheet returns a timestamp', () => {
    const row = { ...baseRow, 'Date': '2026-05-23T00:00:00.000Z' }
    expect(mapStrava(row).date).toBe('2026-05-23')
  })

  it('returns null for missing optional fields', () => {
    const row = { ...baseRow, 'Description': '', 'Strava URL': '' }
    const result = mapStrava(row)
    expect(result.description).toBeNull()
    expect(result.stravaUrl).toBeNull()
  })
})

// ─── mapLog ──────────────────────────────────────────────────────────────────

describe('mapLog', () => {
  const baseRow = {
    'Date': '2026-05-23',
    'Day': 'Saturday',
    'Week#': '5',
    'Phase': 'Base Building 1',
    'Activity Type': 'Run',
    'Source': 'Strava',
    'Distance (mi)': '6.02',
    'Duration (min)': '52.5',
    'Pace (min/mi)': '8:43',
    'Avg HR': '134.9',
    'Max HR': '150',
    'Elevation (ft)': '210',
    'RPE': '6',
    'Zone1 (min)': '8',
    'Zone2 (min)': '45',
    'Zone3 (min)': '0',
    'Zone4 (min)': '0',
    'Zone5 (min)': '0',
  }

  it('maps basic fields correctly', () => {
    const result = mapLog(baseRow)
    expect(result.date).toBe('2026-05-23')
    expect(result.activityType).toBe('Run')
    expect(result.distance).toBe(6.02)
    expect(result.zone1).toBe(8)
    expect(result.zone2).toBe(45)
  })

  it('rejects Google Sheets date-serial in the pace field — regression', () => {
    const row = { ...baseRow, 'Pace (min/mi)': '1899-12-30 08:43:27' }
    expect(mapLog(row).pace).toBeNull()
  })

  it('passes a valid pace through', () => {
    expect(mapLog(baseRow).pace).toBe('8:43')
  })

  it('parses all five zone fields', () => {
    const row = { ...baseRow, 'Zone1 (min)': '5', 'Zone2 (min)': '30', 'Zone3 (min)': '10', 'Zone4 (min)': '3', 'Zone5 (min)': '2' }
    const result = mapLog(row)
    expect(result.zone1).toBe(5)
    expect(result.zone2).toBe(30)
    expect(result.zone3).toBe(10)
    expect(result.zone4).toBe(3)
    expect(result.zone5).toBe(2)
  })

  it('returns null for missing optional string fields', () => {
    const row = { ...baseRow, 'Effort Feel': '', 'Post-Run Feel': '', 'Notes': '' }
    const result = mapLog(row)
    expect(result.effortFeel).toBeNull()
    expect(result.postRunFeel).toBeNull()
    expect(result.notes).toBeNull()
  })
})

// ─── mapPlan ─────────────────────────────────────────────────────────────────

describe('mapPlan', () => {
  const baseRow = {
    'Date': '2026-05-25',
    'Day': 'Monday',
    'Week#': '6',
    'Phase': 'Base Building 1',
    'Day Type': 'Run',
    'Run Type': 'Easy',
    'Workout': 'Easy Run',
    'Distance (mi)': '5',
    'Target Pace (min/mi)': '9:30',
    'HR Zone': '2',
    'Intensity': 'Low',
    'Energy System': 'Aerobic',
    'Reason / Purpose': 'Active recovery',
    'Instructions': 'Keep HR under 140',
    'Notes': '',
  }

  it('maps basic fields correctly', () => {
    const result = mapPlan(baseRow)
    expect(result.date).toBe('2026-05-25')
    expect(result.dayType).toBe('Run')
    expect(result.runType).toBe('Easy')
    expect(result.distance).toBe(5)
  })

  it('truncates date to 10 chars when sheet returns a timestamp', () => {
    const row = { ...baseRow, 'Date': '2026-05-25T00:00:00.000Z' }
    expect(mapPlan(row).date).toBe('2026-05-25')
  })

  it('returns null for empty optional string fields', () => {
    const row = { ...baseRow, 'Run Type': '', 'Workout': '', 'Notes': '' }
    const result = mapPlan(row)
    expect(result.runType).toBeNull()
    expect(result.workout).toBeNull()
    expect(result.notes).toBeNull()
  })
})

// ─── deduplicatePlanRows ─────────────────────────────────────────────────────

function planRow(date: string, dayType: string): ReturnType<typeof mapPlan> {
  return {
    date, dayType: dayType as ReturnType<typeof mapPlan>['dayType'],
    day: '', week: 1, phase: '', runType: null, workout: null,
    distance: null, targetPace: null, hrZone: null, intensity: null,
    energySystem: null, reason: null, instructions: null, notes: null,
  }
}

describe('deduplicatePlanRows', () => {
  it('keeps a single row unchanged', () => {
    const rows = [planRow('2026-05-25', 'Run')]
    expect(deduplicatePlanRows(rows)).toHaveLength(1)
  })

  it('non-Rest beats Rest for the same date — race day overlay', () => {
    const rows = [
      planRow('2026-05-25', 'Rest'),  // written by createPlanDays
      planRow('2026-05-25', 'Race'),  // written by addRace
    ]
    const result = deduplicatePlanRows(rows)
    expect(result).toHaveLength(1)
    expect(result[0].dayType).toBe('Race')
  })

  it('non-Rest beats Rest regardless of row order', () => {
    const rows = [
      planRow('2026-05-25', 'Race'),
      planRow('2026-05-25', 'Rest'),
    ]
    const result = deduplicatePlanRows(rows)
    expect(result).toHaveLength(1)
    expect(result[0].dayType).toBe('Race')
  })

  it('keeps a single Rest row when there is no non-Rest row', () => {
    const rows = [planRow('2026-05-25', 'Rest')]
    expect(deduplicatePlanRows(rows)).toHaveLength(1)
    expect(deduplicatePlanRows(rows)[0].dayType).toBe('Rest')
  })

  it('keeps distinct dates separate', () => {
    const rows = [
      planRow('2026-05-25', 'Run'),
      planRow('2026-05-26', 'Rest'),
    ]
    expect(deduplicatePlanRows(rows)).toHaveLength(2)
  })

  it('returns rows sorted by date', () => {
    const rows = [
      planRow('2026-05-27', 'Run'),
      planRow('2026-05-25', 'Run'),
      planRow('2026-05-26', 'Rest'),
    ]
    const result = deduplicatePlanRows(rows)
    expect(result.map(r => r.date)).toEqual(['2026-05-25', '2026-05-26', '2026-05-27'])
  })
})

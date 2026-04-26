import type {
  PlannedWorkout, Phase, Race,
  StravaActivity, HealthEntry, TrainingLogEntry,
} from './data'

type Row = Record<string, unknown>

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function num(v: unknown): number | null {
  const n = parseFloat(str(v))
  return isNaN(n) ? null : n
}

function date(v: unknown): string {
  const s = str(v)
  return s.length >= 10 ? s.slice(0, 10) : s
}

function mapPlan(row: Row): PlannedWorkout {
  return {
    date:         date(row['Date']),
    day:          str(row['Day']),
    week:         num(row['Week#']) ?? 0,
    phase:        str(row['Phase']),
    dayType:      str(row['Day Type']) as PlannedWorkout['dayType'],
    runType:      str(row['Run Type']) || null,
    workout:      str(row['Workout']) || null,
    distance:     num(row['Distance (mi)']),
    targetPace:   str(row['Target Pace (min/mi)']) || null,
    hrZone:       num(row['HR Zone']),
    intensity:    str(row['Intensity']) || null,
    energySystem: str(row['Energy System']) || null,
    reason:       str(row['Reason / Purpose']) || null,
    instructions: str(row['Instructions']) || null,
    notes:        str(row['Notes']) || null,
  }
}

function mapPhase(row: Row): Phase {
  return {
    name:      str(row['Phase Name']),
    startDate: date(row['Start Date']),
    endDate:   date(row['End Date']),
    weeks:     num(row['Weeks']) ?? 0,
    goal:      str(row['Goal / Focus']),
  }
}

function mapRace(row: Row): Race {
  return {
    name:     str(row['Race Name']),
    date:     date(row['Date']),
    distance: str(row['Distance']),
    purpose:  str(row['Purpose']) as Race['purpose'],
    location: str(row['Location']),
    notes:    str(row['Notes']) || null,
  }
}

function mapStrava(row: Row): StravaActivity {
  return {
    activityId: str(row['Activity ID']),
    date:       date(row['Date']),
    name:       str(row['Name']),
    type:       str(row['Type']),
    distance:   num(row['Distance (mi)']) ?? 0,
    movingTime: num(row['Moving Time (min)']) ?? 0,
    pace:       str(row['Avg Pace (min/mi)']) || null,
    avgHr:      num(row['Avg HR']),
    maxHr:      num(row['Max HR']),
    calories:   num(row['Calories']),
    elevation:  num(row['Elevation (ft)']),
    description: str(row['Description']) || null,
    stravaUrl:  str(row['Strava URL']) || null,
  }
}

function mapHealth(row: Row): HealthEntry {
  return {
    date:           date(row['Date']),
    restingHr:      num(row['Resting HR']),
    hrv:            num(row['HRV (ms)']),
    sleepHours:     num(row['Sleep Hours']),
    sleepQuality:   str(row['Sleep Quality']) || null,
    steps:          num(row['Steps']),
    activeCalories: num(row['Active Calories']),
    vo2max:         num(row['VO2 Max']),
    weight:         num(row['Weight (lbs)']),
    notes:          str(row['Notes']) || null,
  }
}

function mapLog(row: Row): TrainingLogEntry {
  return {
    date:         date(row['Date']),
    day:          str(row['Day']),
    week:         num(row['Week#']) ?? 0,
    phase:        str(row['Phase']),
    activityType: str(row['Activity Type']),
    source:       str(row['Source']) as TrainingLogEntry['source'],
    distance:     num(row['Distance (mi)']),
    duration:     num(row['Duration (min)']),
    pace:         str(row['Pace (min/mi)']) || null,
    avgHr:        num(row['Avg HR']),
    maxHr:        num(row['Max HR']),
    elevation:    num(row['Elevation (ft)']),
    rpe:          num(row['RPE']),
    effortFeel:   str(row['Effort Feel']) || null,
    postRunFeel:  str(row['Post-Run Feel']) || null,
    stravaId:     str(row['Strava ID']) || null,
    injuryNotes:  str(row['Injury / Body Notes']) || null,
    notes:        str(row['Notes']) || null,
  }
}

async function fetchSheet<T>(url: string, mapper: (row: Row) => T): Promise<T[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    const json = await res.json() as { rows: Row[] }
    return json.rows.map(mapper).filter(Boolean)
  } catch {
    return []
  }
}

export async function fetchPlanData() {
  const url = process.env.PLAN_SHEETS_URL!
  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    const json = await res.json() as { plan: Row[], phases: Row[], races: Row[] }
    return {
      plan:   json.plan.map(mapPlan).filter(e => e.date),
      phases: json.phases.map(mapPhase).filter(e => e.name),
      races:  json.races.map(mapRace).filter(e => e.name),
    }
  } catch {
    return { plan: [], phases: [], races: [] }
  }
}

export async function fetchTrainingData() {
  const url = process.env.DATA_SHEETS_URL!
  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    const json = await res.json() as { strava: Row[], health: Row[] }
    return {
      strava: json.strava.map(mapStrava).filter(e => e.activityId),
      health: json.health.map(mapHealth).filter(e => e.date),
    }
  } catch {
    return { strava: [], health: [] }
  }
}

export async function fetchTrainingLog() {
  const url = process.env.LOG_SHEETS_URL!
  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    const json = await res.json() as { log: Row[] }
    return json.log.map(mapLog).filter(e => e.date)
  } catch {
    return []
  }
}

'use server'

import { revalidatePath } from 'next/cache'

type PlanDayPayload = {
  date: string
  week?: number
  phase?: string
  dayType: string
  runType?: string
  workout?: string
  distance?: number | null
  targetPace?: string
  hrZone?: number | null
  intensity?: string
  energySystem?: string
  reason?: string
  instructions?: string
  notes?: string
}

async function postToPlan(payload: object): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.PLAN_SHEETS_URL!
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json() as Promise<{ ok: boolean; error?: string }>
}

async function postToPlanOrThrow(payload: object) {
  const json = await postToPlan(payload)
  if (!json.ok) throw new Error(json.error ?? 'Plan write failed')
}

export async function createPhase(data: {
  name: string
  startDate: string
  endDate: string
  goal: string
}) {
  const start = new Date(data.startDate + 'T00:00:00')
  const end = new Date(data.endDate + 'T00:00:00')
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const weeks = Math.ceil(days / 7)

  await postToPlanOrThrow({ action: 'addPhase', ...data, weeks })

  revalidatePath('/plan')
  revalidatePath('/')
}

export async function setupPhaseDays(phaseName: string, startDate: string, endDate: string, weekOffset: number) {
  await postToPlanOrThrow({ action: 'createPlanDays', startDate, endDate, phaseName, weekOffset })
  revalidatePath('/plan')
  revalidatePath('/')
}

export async function updatePhase(originalName: string, data: {
  name: string
  startDate: string
  endDate: string
  goal: string
}) {
  const start = new Date(data.startDate + 'T00:00:00')
  const end = new Date(data.endDate + 'T00:00:00')
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const weeks = Math.ceil(days / 7)

  await postToPlanOrThrow({ action: 'updatePhase', originalName, ...data, weeks })
  revalidatePath('/plan')
  revalidatePath('/')
}

export async function deletePhase(name: string, startDate: string, endDate: string) {
  // Best-effort — if the phase row isn't in the sheet, still clean up plan days
  await postToPlan({ action: 'deletePhase', name })
  await postToPlan({ action: 'deletePlanDays', startDate, endDate })
  revalidatePath('/plan')
  revalidatePath('/')
}

export async function savePlanDay(payload: PlanDayPayload) {
  await postToPlanOrThrow({ action: 'upsertPlanDay', ...payload })
  revalidatePath('/plan')
  revalidatePath('/')
}

export async function addRace(data: {
  name: string
  date: string
  distance: string
  grade: 'A' | 'B' | 'C'
  location?: string
  notes?: string
}) {
  await postToPlanOrThrow({ action: 'addRace', ...data, purpose: data.grade })
  // Auto-create the race day in the plan
  await postToPlan({
    action: 'upsertPlanDay',
    date: data.date,
    dayType: 'Race',
    workout: data.name,
    distance: null,
    reason: `${data.grade}-race · ${data.distance}${data.location ? ` · ${data.location}` : ''}`,
  })
  revalidatePath('/plan')
  revalidatePath('/')
}

export async function updateRace(original: { name: string; date: string }, data: {
  name: string
  date: string
  distance: string
  grade: 'A' | 'B' | 'C'
  location?: string
  notes?: string
}) {
  await postToPlanOrThrow({
    action: 'updateRace',
    originalName: original.name,
    originalDate: original.date,
    ...data,
    grade: data.grade,
  })
  if (original.date !== data.date) {
    await postToPlan({ action: 'upsertPlanDay', date: original.date, dayType: 'Rest', workout: '', reason: '' })
  }
  await postToPlan({
    action: 'upsertPlanDay',
    date: data.date,
    dayType: 'Race',
    workout: data.name,
    distance: null,
    reason: `${data.grade}-race · ${data.distance}${data.location ? ` · ${data.location}` : ''}`,
  })
  revalidatePath('/plan')
  revalidatePath('/')
}

export async function deleteRace(name: string, date: string) {
  await postToPlanOrThrow({ action: 'deleteRace', name, date })
  await postToPlan({ action: 'upsertPlanDay', date, dayType: 'Rest', workout: '', reason: '' })
  revalidatePath('/plan')
  revalidatePath('/')
}

export async function applyWorkoutToWeekday(payload: {
  dates: string[]
  dayType: string
  runType?: string
  workout?: string
  distance?: number | null
  hrZone?: number | null
  energySystem?: string
  reason?: string
  instructions?: string
  notes?: string
}) {
  await postToPlanOrThrow({ action: 'batchUpsertByWeekday', ...payload })
  revalidatePath('/plan')
  revalidatePath('/')
}

export async function addLibraryWorkout(data: {
  name: string
  sport: string
  category: string
  type: string
  reason: string
  instructions: string
  distTime: string
}) {
  const url = process.env.LIBRARY_SHEETS_URL
  if (!url) throw new Error('LIBRARY_SHEETS_URL not set')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      'Workout Name': data.name,
      'Sport': data.sport,
      'Category': data.category,
      'Type': data.type,
      'Reason / Purpose': data.reason,
      'Instructions': data.instructions,
      'Dist/Time': data.distTime,
      'Lap Structure': '',
      'Energy System': '',
      'HR Zone': '',
      'RPE': '',
      'Last Ran': '',
      'Coaching Notes': '',
      'Map Link': '',
    }),
  })
  const json = await res.json() as { ok: boolean; error?: string }
  if (!json.ok) throw new Error(json.error ?? 'Save failed')
  revalidatePath('/library')
}

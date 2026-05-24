'use server'

import { revalidatePath } from 'next/cache'
import { fetchPlanData, fetchTrainingData, fetchTrainingLog } from '@/lib/sheets'
import { generateCoachingNote, generateRestDayNote, generatePostWorkoutNote, generatePTSummaryForRange, generateWeekReview, sendCheckInMessage } from '@/lib/ai'
import { getCoachingNote, setCoachingNote, getPostCoachingNote, setPostCoachingNote, getCheckIn, setCheckIn, getWeekReview, setWeekReview, setCoachProfile } from '@/lib/kv'
import type { CoachingNote, WeekReview, CheckInMessage, CoachProfile } from '@/lib/data'

export async function fetchCoachingNoteForDate(date: string): Promise<CoachingNote | null> {
  try {
    const cached = await getCoachingNote(date).catch(() => null)
    if (cached) return cached

    const [{ plan, phases, races }, { health }, log] = await Promise.all([
      fetchPlanData(),
      fetchTrainingData(),
      fetchTrainingLog(),
    ])
    const workout = plan.find(e => e.date === date)
    if (!workout) return null

    const phase = phases.find(p => p.startDate <= date && p.endDate >= date)
    const nextRace = races.filter(r => r.date >= date).sort((a, b) => a.date.localeCompare(b.date))[0]
    const recentLog = log.filter(e => e.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
    const dayHealth = health.find(e => e.date === date)
    const recentHealth = health.filter(e => e.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)

    let note: CoachingNote
    if (workout.dayType === 'Rest') {
      note = await generateRestDayNote(workout, phase, nextRace, recentLog, dayHealth, recentHealth)
    } else {
      const checkIn = await getCheckIn(date).catch(() => null)
      note = await generateCoachingNote(workout, phase, nextRace, recentLog, dayHealth, recentHealth, checkIn)
    }
    setCoachingNote(note).catch(() => {})
    return note
  } catch {
    return null
  }
}

export async function regenerateCoachingNote(date: string): Promise<CoachingNote | null> {
  try {
    const [{ plan, phases, races }, { health }, log] = await Promise.all([
      fetchPlanData({ fresh: true }),
      fetchTrainingData({ fresh: true }),
      fetchTrainingLog({ fresh: true }),
    ])

    const workout = plan.find(e => e.date === date)
    if (!workout) return null

    const phase = phases.find(p => p.startDate <= date && p.endDate >= date)
    const nextRace = races.filter(r => r.date >= date).sort((a, b) => a.date.localeCompare(b.date))[0]
    const recentLog = log.filter(e => e.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
    const dayHealth = health.find(e => e.date === date)
    const recentHealth = health.filter(e => e.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)

    let note: CoachingNote
    if (workout.dayType === 'Rest') {
      note = await generateRestDayNote(workout, phase, nextRace, recentLog, dayHealth, recentHealth)
    } else {
      const checkIn = await getCheckIn(date).catch(() => null)
      note = await generateCoachingNote(workout, phase, nextRace, recentLog, dayHealth, recentHealth, checkIn)
    }
    setCoachingNote(note).catch(() => {})
    return note
  } catch {
    return null
  }
}

export async function fetchPostWorkoutNoteForDate(date: string): Promise<CoachingNote | null> {
  try {
    const cached = await getPostCoachingNote(date).catch(() => null)
    if (cached) return cached

    const [{ plan, phases, races }, { health }, log] = await Promise.all([
      fetchPlanData({ fresh: true }),
      fetchTrainingData({ fresh: true }),
      fetchTrainingLog({ fresh: true }),
    ])

    const workout = plan.find(e => e.date === date)
    if (!workout) return null

    const todayLogs = log.filter(e => e.date === date)
    if (todayLogs.length === 0) return null

    // Only generate for runs or qualifying bike rides
    const hasRun = todayLogs.some(e => /run/i.test(e.activityType))
    const checkIn = await getCheckIn(date).catch(() => null)
    const runReplacementFlagged = checkIn?.coachingNote?.toLowerCase().includes('replacement') ||
      checkIn?.coachingNote?.toLowerCase().includes('bike') ||
      checkIn?.coachingNote?.toLowerCase().includes('substitute')
    const hasBike = todayLogs.some(e => /ride|bike|cycling/i.test(e.activityType))
    const bikeQualifies = hasBike && (runReplacementFlagged ||
      todayLogs.some(e => /ride|bike|cycling/i.test(e.activityType) && (e.duration ?? 0) >= 45))

    if (!hasRun && !bikeQualifies) return null

    const phase = phases.find(p => p.startDate <= date && p.endDate >= date)
    const nextRace = races.filter(r => r.date >= date).sort((a, b) => a.date.localeCompare(b.date))[0]
    const recentLog = log.filter(e => e.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
    const dayHealth = health.find(e => e.date === date)
    const recentHealth = health.filter(e => e.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
    const tomorrowDate = new Date(date + 'T00:00:00')
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrowWorkout = plan.find(e => e.date === tomorrowDate.toISOString().slice(0, 10))

    const note = await generatePostWorkoutNote(workout, phase, nextRace, todayLogs, dayHealth, recentLog, recentHealth, checkIn, tomorrowWorkout)
    await setPostCoachingNote(note)
    return note
  } catch {
    return null
  }
}

export async function generatePTSummaryAction(startDate: string, endDate: string): Promise<string | null> {
  try {
    const [{ plan, phases }, { health }, log] = await Promise.all([
      fetchPlanData({ fresh: true }),
      fetchTrainingData({ fresh: true }),
      fetchTrainingLog({ fresh: true }),
    ])
    void plan
    return await generatePTSummaryForRange(startDate, endDate, log, health, phases)
  } catch {
    return null
  }
}

export async function sendCheckInAction(
  date: string,
  messages: CheckInMessage[],
  workoutContext: string,
): Promise<{ reply: string; coachingNote: string | null } | null> {
  try {
    const result = await sendCheckInMessage(messages, workoutContext)

    // Save check-in to KV if there's a coaching note worth keeping
    const existing = await getCheckIn(date).catch(() => null)
    const allMessages: CheckInMessage[] = [...(existing?.messages ?? []), ...messages.slice(existing?.messages?.length ?? 0)]
    const assistantMessage: CheckInMessage = { role: 'assistant', content: result.reply }
    const coachingNote = result.coachingNote ?? existing?.coachingNote ?? null

    await setCheckIn({
      date,
      messages: [...allMessages, assistantMessage],
      coachingNote,
    })

    return result
  } catch {
    return null
  }
}

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

export async function fetchWeekReviewForWeek(weekStart: string): Promise<WeekReview | null> {
  try {
    const weekEnd = new Date(new Date(weekStart + 'T00:00:00').getTime() + 6 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10)
    const [{ plan }, , log] = await Promise.all([
      fetchPlanData(),
      fetchTrainingData(),
      fetchTrainingLog(),
    ])
    const weekNum = plan.filter(e => e.date >= weekStart && e.date <= weekEnd)[0]?.week ?? 0
    return await getWeekReview(weekNum).catch(() => null)
  } catch {
    return null
  }
}

export async function regenerateWeekReview(weekStart: string): Promise<WeekReview | null> {
  try {
    const weekEnd = new Date(new Date(weekStart + 'T00:00:00').getTime() + 6 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10)

    const [{ plan, phases }, { health }, log] = await Promise.all([
      fetchPlanData({ fresh: true }),
      fetchTrainingData({ fresh: true }),
      fetchTrainingLog({ fresh: true }),
    ])

    const weekPlan = plan.filter(e => e.date >= weekStart && e.date <= weekEnd)
    const weekLog = log.filter(e => e.date >= weekStart && e.date <= weekEnd)
    const weekHealth = health.filter(e => e.date >= weekStart && e.date <= weekEnd)
    const weekNum = weekPlan[0]?.week ?? 0
    const phase =
      phases.find(p => p.startDate <= weekStart && p.endDate >= weekStart) ??
      phases.find(p => p.startDate <= weekEnd && p.endDate >= weekEnd)

    const review = await generateWeekReview(weekNum, weekStart, weekEnd, weekPlan, weekLog, weekHealth, phase)
    await setWeekReview(review)
    return review
  } catch {
    return null
  }
}

export async function saveSleepScore(date: string, score: number): Promise<void> {
  await fetch(process.env.DATA_SHEETS_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'patchHealth', data: { 'Date': date, 'Sleep Quality': score } }),
    cache: 'no-store',
  })
  revalidatePath('/')
  // Sleep score is the last piece of morning health data — regenerate coaching note with full context
  regenerateCoachingNote(date).catch(() => {})
}

export async function logSupplementalActivity(date: string, activityType: string): Promise<void> {
  await fetch(process.env.LOG_SHEETS_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'appendLog',
      data: {
        'Date': date,
        'Activity Type': activityType,
        'Source': 'Manual',
        'Day': '', 'Week#': '', 'Phase': '',
        'Distance (mi)': '', 'Duration (min)': '', 'Pace (min/mi)': '',
        'Avg HR': '', 'Max HR': '', 'Elevation (ft)': '', 'RPE': '',
        'Effort Feel': '', 'Post-Run Feel': '', 'Strava ID': '',
        'Injury / Body Notes': '', 'Notes': '',
        'Zone1 (min)': '', 'Zone2 (min)': '', 'Zone3 (min)': '',
        'Zone4 (min)': '', 'Zone5 (min)': '',
      },
    }),
    cache: 'no-store',
  })
  revalidatePath('/')
}

export async function refreshHealthData(): Promise<void> {
  revalidatePath('/')
}

export async function regeneratePostCoachingNote(date: string): Promise<CoachingNote | null> {
  try {
    const [{ plan, phases, races }, { health }, log] = await Promise.all([
      fetchPlanData({ fresh: true }),
      fetchTrainingData({ fresh: true }),
      fetchTrainingLog({ fresh: true }),
    ])

    const workout = plan.find(e => e.date === date)
    if (!workout) return null

    const todayLogs = log.filter(e => e.date === date)
    if (todayLogs.length === 0) return null

    const hasRun = todayLogs.some(e => /run/i.test(e.activityType))
    const checkIn = await getCheckIn(date).catch(() => null)
    const runReplacementFlagged = checkIn?.coachingNote?.toLowerCase().includes('replacement') ||
      checkIn?.coachingNote?.toLowerCase().includes('bike') ||
      checkIn?.coachingNote?.toLowerCase().includes('substitute')
    const hasBike = todayLogs.some(e => /ride|bike|cycling/i.test(e.activityType))
    const bikeQualifies = hasBike && (runReplacementFlagged ||
      todayLogs.some(e => /ride|bike|cycling/i.test(e.activityType) && (e.duration ?? 0) >= 45))

    if (!hasRun && !bikeQualifies) return null

    const phase = phases.find(p => p.startDate <= date && p.endDate >= date)
    const nextRace = races.filter(r => r.date >= date).sort((a, b) => a.date.localeCompare(b.date))[0]
    const recentLog = log.filter(e => e.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
    const dayHealth = health.find(e => e.date === date)
    const recentHealth = health.filter(e => e.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
    const tomorrowDate = new Date(date + 'T00:00:00')
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrowWorkout = plan.find(e => e.date === tomorrowDate.toISOString().slice(0, 10))

    const note = await generatePostWorkoutNote(workout, phase, nextRace, todayLogs, dayHealth, recentLog, recentHealth, checkIn, tomorrowWorkout)
    await setPostCoachingNote(note)
    return note
  } catch {
    return null
  }
}

export async function syncStrava(): Promise<{ added: number; skipped: number; errors: number }> {
  const { syncStravaActivities } = await import('@/lib/strava')
  const result = await syncStravaActivities()
  revalidatePath('/')
  revalidatePath('/week')

  if (result.added > 0) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    regeneratePostCoachingNote(today).catch(() => {})
  }

  return result
}

type LibraryWorkoutInput = {
  name: string
  sport: string
  category: string
  type: string
  reason: string
  instructions: string
  distTime: string
  lapStructure: string
  energySystem: string
  hrZone: string
  rpe: string
  coachingNotes: string
  mapLink: string
  author: string
  raceTypes: string[]
  trainingPhases: string[]
}

function buildLibraryPayload(data: LibraryWorkoutInput, variation = '', progression = '') {
  return {
    'Workout Name': data.name,
    'Sport': data.sport,
    'Category': data.category,
    'Type': data.type,
    'Reason / Purpose': data.reason,
    'Instructions': data.instructions,
    'Dist/Time': data.distTime,
    'Lap Structure': data.lapStructure,
    'Energy System': data.energySystem,
    'HR Zone': data.hrZone,
    'RPE': data.rpe,
    'Last Ran': '',
    'Coaching Notes': data.coachingNotes,
    'Map Link': data.mapLink,
    'Author': data.author,
    'Race Type': data.raceTypes.join(', '),
    'Training Phase': data.trainingPhases.join(', '),
    'Variation': variation,
    'Progression': progression,
  }
}

async function postToLibrary(payload: Record<string, string>) {
  const url = process.env.LIBRARY_SHEETS_URL
  if (!url) throw new Error('LIBRARY_SHEETS_URL not set')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json() as { ok: boolean; error?: string }
  if (!json.ok) throw new Error(json.error ?? 'Save failed')
}

export async function addLibraryWorkout(data: LibraryWorkoutInput) {
  await postToLibrary(buildLibraryPayload(data))
  revalidatePath('/library')
}

export async function addLibraryWorkoutFamily(data: LibraryWorkoutInput, variations: string[]) {
  for (let i = 0; i < variations.length; i++) {
    await postToLibrary(buildLibraryPayload(data, variations[i], String(i + 1)))
  }
  revalidatePath('/library')
}

export async function createFeedbackIssue(data: {
  type: 'bug' | 'feature'
  description: string
  screenshotBase64?: string
}): Promise<{ url: string } | { error: string }> {
  const token = process.env.GITHUB_TOKEN
  if (!token) return { error: 'GitHub token not configured' }

  let body = data.description

  if (data.screenshotBase64) {
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const client = new Anthropic()
      const visionReply = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/png', data: data.screenshotBase64 },
            },
            {
              type: 'text',
              text: 'Describe what you see in this screenshot from a marathon training app in 2-3 sentences. Focus on what UI element or state is shown, and any visible problem if this is a bug report.',
            },
          ],
        }],
      })
      const screenshotDesc = visionReply.content[0].type === 'text' ? visionReply.content[0].text : ''
      body = `${data.description}\n\n**Screenshot:** ${screenshotDesc}`
    } catch {
      // Vision analysis failed — attach description without screenshot context
    }
  }

  const label = data.type === 'bug' ? 'bug' : 'enhancement'
  const title = `${data.type === 'bug' ? 'Bug' : 'Feature'}: ${data.description}`

  const res = await fetch('https://api.github.com/repos/foulox/trainer_v1/issues', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, body, labels: [label] }),
  })

  if (!res.ok) return { error: `GitHub API error: ${res.status}` }

  const issue = await res.json() as { html_url: string }
  return { url: issue.html_url }
}

export async function saveCoachProfile(profile: CoachProfile): Promise<{ success: boolean; error?: string }> {
  try {
    await setCoachProfile({ ...profile, updatedAt: new Date().toISOString() })
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Failed to save profile' }
  }
}

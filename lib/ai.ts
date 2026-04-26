import Anthropic from '@anthropic-ai/sdk'
import type { PlannedWorkout, Phase, Race, TrainingLogEntry, HealthEntry, CoachingNote, WeekReview } from './data'

const client = new Anthropic()

const SYSTEM_PROMPT = `You are an elite running coach drawing on the philosophies of Jack Daniels and Brad Hudson.
You speak directly, with authority and warmth. You know this athlete well — their history, their goals, their body.
Keep responses concise and practical. No fluff. Every sentence should mean something to a serious runner.`

export async function generateCoachingNote(
  workout: PlannedWorkout,
  phase: Phase | undefined,
  nextRace: Race | undefined,
  recentLog: TrainingLogEntry[],
  todayHealth: HealthEntry | undefined,
): Promise<CoachingNote> {
  const context = buildWorkoutContext(workout, phase, nextRace, recentLog, todayHealth)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Generate a coaching note for today's workout.

${context}

Write two short paragraphs:
1. WHY this workout matters right now — in the context of this phase and the target race
2. HOW to approach it today given the athlete's current state (HRV, sleep, recent load)

Be specific to this workout, not generic.`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  return {
    date: workout.date,
    generatedAt: new Date().toISOString(),
    workoutPurpose: workout.reason ?? '',
    coachingTake: text,
  }
}

export async function generateWeekReview(
  weekNumber: number,
  startDate: string,
  endDate: string,
  plannedWorkouts: PlannedWorkout[],
  actualWorkouts: TrainingLogEntry[],
  healthEntries: HealthEntry[],
  phase: Phase | undefined,
): Promise<WeekReview> {
  const context = buildWeekContext(plannedWorkouts, actualWorkouts, healthEntries, phase)

  const [summaryMsg, ptMsg] = await Promise.all([
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Write a week-in-review coaching assessment for week ${weekNumber} (${startDate} to ${endDate}).

${context}

Cover: what went well, what didn't, what it means for next week. Be honest. Be specific.`,
      }],
    }),
    client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Write a weekly training summary for this athlete's physical therapist for week ${weekNumber}.

${context}

Cover: training load, any body complaints or injury notes, how the body responded to the week.
Clinical but readable. The PT needs to know what to watch.`,
      }],
    }),
  ])

  const summary = summaryMsg.content[0].type === 'text' ? summaryMsg.content[0].text : ''
  const ptSummary = ptMsg.content[0].type === 'text' ? ptMsg.content[0].text : ''

  return {
    weekNumber,
    startDate,
    endDate,
    generatedAt: new Date().toISOString(),
    summary,
    ptSummary,
  }
}

function buildWorkoutContext(
  workout: PlannedWorkout,
  phase: Phase | undefined,
  nextRace: Race | undefined,
  recentLog: TrainingLogEntry[],
  health: HealthEntry | undefined,
): string {
  const lines = [
    `TODAY'S WORKOUT: ${workout.dayType} — ${workout.runType ?? ''} — ${workout.workout ?? 'Unplanned'}`,
    `Distance: ${workout.distance ?? '—'} mi | HR Zone: ${workout.hrZone ?? '—'} | Intensity: ${workout.intensity ?? '—'}`,
    `Purpose (from plan): ${workout.reason ?? 'None specified'}`,
    `Instructions: ${workout.instructions ?? 'None'}`,
    '',
    `CURRENT PHASE: ${phase?.name ?? '—'} — ${phase?.goal ?? ''}`,
    nextRace ? `TARGET RACE: ${nextRace.name} (${nextRace.distance}) on ${nextRace.date} — ${nextRace.purpose}` : '',
    '',
    `TODAY'S HEALTH: HRV ${health?.hrv ?? '—'} ms | Resting HR ${health?.restingHr ?? '—'} bpm | Sleep ${health?.sleepHours ?? '—'} hrs`,
    '',
    'RECENT TRAINING (last 7 days):',
    ...recentLog.slice(0, 7).map(e =>
      `  ${e.date}: ${e.activityType} ${e.distance ?? '—'} mi in ${e.duration ?? '—'} min | HR ${e.avgHr ?? '—'} | RPE ${e.rpe ?? '—'} | Feel: ${e.postRunFeel ?? '—'}`
    ),
  ]
  return lines.filter(Boolean).join('\n')
}

function buildWeekContext(
  planned: PlannedWorkout[],
  actual: TrainingLogEntry[],
  health: HealthEntry[],
  phase: Phase | undefined,
): string {
  const totalPlanned = planned.reduce((s, w) => s + (w.distance ?? 0), 0)
  const totalActual = actual.reduce((s, w) => s + (w.distance ?? 0), 0)
  const avgHrv = health.length
    ? (health.reduce((s, h) => s + (h.hrv ?? 0), 0) / health.length).toFixed(1)
    : '—'
  const avgSleep = health.length
    ? (health.reduce((s, h) => s + (h.sleepHours ?? 0), 0) / health.length).toFixed(1)
    : '—'
  const injuryNotes = actual.filter(e => e.injuryNotes).map(e => `  ${e.date}: ${e.injuryNotes}`).join('\n')

  const lines = [
    `PHASE: ${phase?.name ?? '—'} — ${phase?.goal ?? ''}`,
    '',
    `VOLUME: Planned ${totalPlanned.toFixed(1)} mi vs Actual ${totalActual.toFixed(1)} mi`,
    '',
    'PLANNED WORKOUTS:',
    ...planned.map(w => `  ${w.date} (${w.dayType}): ${w.workout ?? 'Rest'} — ${w.distance ?? 0} mi`),
    '',
    'ACTUAL WORKOUTS:',
    ...actual.map(e => `  ${e.date}: ${e.activityType} ${e.distance ?? 0} mi | ${e.duration ?? '—'} min | HR ${e.avgHr ?? '—'} | RPE ${e.rpe ?? '—'} | Feel: ${e.postRunFeel ?? '—'}`),
    '',
    `BODY: Avg HRV ${avgHrv} ms | Avg Sleep ${avgSleep} hrs`,
    injuryNotes ? `INJURY/BODY NOTES:\n${injuryNotes}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}

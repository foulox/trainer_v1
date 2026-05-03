import Anthropic from '@anthropic-ai/sdk'
import type { PlannedWorkout, Phase, Race, TrainingLogEntry, HealthEntry, CoachingNote, WeekReview } from './data'

const client = new Anthropic()

const ASSISTANT_COACH_PROMPT = `You are a data-driven assistant coach analyzing an athlete's training metrics.
Your role is analytical — report what the numbers say. Reference actual values: HRV, zone minutes, pace, volume, RPE.
Identify patterns, flag concerns, quantify fatigue and readiness. No motivational language, no fluff.
Format your response in clean markdown. Use **bold** for key numbers and findings.`

const SYSTEM_PROMPT = ASSISTANT_COACH_PROMPT

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
      content: `Analyze this athlete's readiness and training context for today's workout.

${context}

Write two short paragraphs:
1. **Readiness**: HRV trend, resting HR, recent load (volume, zone distribution, intensity over the last 7 days). Is the body ready for this workout?
2. **Training context**: How does this workout fit the pattern of the last 7 days? Flag anything — too much intensity, inadequate recovery, missed workouts, RPE outliers.

Reference specific numbers. Be direct.`,
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
    nextRace ? `TARGET RACE: ${nextRace.name} (${nextRace.distance}) on ${nextRace.date} — ${nextRace.grade}-race` : '',
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

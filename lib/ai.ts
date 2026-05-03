import Anthropic from '@anthropic-ai/sdk'
import type { PlannedWorkout, Phase, Race, TrainingLogEntry, HealthEntry, CoachingNote, WeekReview } from './data'
import { ATHLETE_CONTEXT } from './athlete-context'

const client = new Anthropic()

const ASSISTANT_COACH_PROMPT = `You are a data-driven assistant coach analyzing an athlete's training metrics.
Your role is analytical — report what the numbers say. Reference actual values: HRV, zone minutes, pace, volume, RPE.
Identify patterns, flag concerns, quantify fatigue and readiness. No motivational language, no fluff.
Format your response in clean markdown. Use **bold** for key numbers and findings.

${ATHLETE_CONTEXT}`

const SYSTEM_PROMPT = ASSISTANT_COACH_PROMPT

export async function generateCoachingNote(
  workout: PlannedWorkout,
  phase: Phase | undefined,
  nextRace: Race | undefined,
  recentLog: TrainingLogEntry[],
  todayHealth: HealthEntry | undefined,
  recentHealth?: HealthEntry[],
): Promise<CoachingNote> {
  const context = buildWorkoutContext(workout, phase, nextRace, recentLog, todayHealth, recentHealth)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Analyze this athlete's readiness and training context for today's workout.

${context}

Format your response with two sections using these exact headers. Use bullet points, not tables. Be concise.

## Readiness
3–4 bullets covering: HRV (today vs 7-day avg), resting HR, sleep score, overall verdict (ready / cautious / back off).

## Training Context
3–4 bullets covering: recent load pattern (volume, zone distribution, intensity), how today's workout fits, any flags (too much intensity, inadequate recovery, missed workouts, RPE outliers).

Reference specific numbers. No tables. No filler.`,
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

Use bullet points, not tables. Two sections:

## What Happened
Bullets: volume vs plan, key workouts, PT directives (yoga/strength/core compliance), cross-training.

## Takeaways
Bullets: what went well, what didn't, what it means for next week. Be direct and specific.`,
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

Use bullet points, not tables. Two sections:

## Training Load
Bullets: total volume, key sessions, cross-training, PT directive compliance (yoga/strength/core).

## Body & Recovery
Bullets: injury or body notes, HRV trend, sleep, how the body responded. Clinical but readable. The PT needs to know what to watch.`,
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
  recentHealth?: HealthEntry[],
): string {
  const hrvValues = (recentHealth ?? []).filter(h => h.hrv).map(h => h.hrv!)
  const hrvAvg7 = hrvValues.length
    ? (hrvValues.reduce((s, v) => s + v, 0) / hrvValues.length).toFixed(1)
    : null

  const lines = [
    `TODAY'S WORKOUT: ${workout.dayType} — ${workout.runType ?? ''} — ${workout.workout ?? 'Unplanned'}`,
    `Distance: ${workout.distance ?? '—'} mi | HR Zone: ${workout.hrZone ?? '—'} | Intensity: ${workout.intensity ?? '—'}`,
    `Purpose (from plan): ${workout.reason ?? 'None specified'}`,
    `Instructions: ${workout.instructions ?? 'None'}`,
    '',
    `CURRENT PHASE: ${phase?.name ?? '—'} — ${phase?.goal ?? ''}`,
    nextRace ? `TARGET RACE: ${nextRace.name} (${nextRace.distance}) on ${nextRace.date} — ${nextRace.grade}-race` : '',
    '',
    `TODAY'S HEALTH: HRV ${health?.hrv ?? '—'} ms${hrvAvg7 ? ` (7-day avg: ${hrvAvg7} ms)` : ''} | Resting HR ${health?.restingHr ?? '—'} bpm | Respiratory Rate ${health?.respiratoryRate ?? '—'} br/min | Sleep Score ${health?.sleepScore ?? '—'}/1000`,
    '',
    'RECENT TRAINING (last 7 days):',
    ...recentLog.slice(0, 7).map(e => {
      const zones = [e.zone1, e.zone2, e.zone3, e.zone4, e.zone5]
        .map((z, i) => z ? `Z${i+1}:${z}m` : '').filter(Boolean).join(' ')
      return `  ${e.date}: ${e.activityType} ${e.distance ?? '—'} mi in ${e.duration ?? '—'} min | HR ${e.avgHr ?? '—'} | RPE ${e.rpe ?? '—'} | ${zones || 'no zones'} | Notes: ${e.postRunFeel ?? '—'}`
    }),
  ]
  return lines.filter(Boolean).join('\n')
}

function buildWeekContext(
  planned: PlannedWorkout[],
  actual: TrainingLogEntry[],
  health: HealthEntry[],
  phase: Phase | undefined,
): string {
  const runs = actual.filter(e => /run/i.test(e.activityType))
  const bikes = actual.filter(e => /ride|bike|cycling/i.test(e.activityType))
  const yoga = actual.filter(e => /yoga/i.test(e.activityType))
  const gym = actual.filter(e => /weight|strength|gym|lift/i.test(e.activityType))
  const climb = actual.filter(e => /climb/i.test(e.activityType))
  const other = actual.filter(e =>
    !/run|ride|bike|cycling|yoga|weight|strength|gym|lift|climb/i.test(e.activityType)
  )

  const totalPlanned = planned.reduce((s, w) => s + (w.distance ?? 0), 0)
  const totalRunMi = runs.reduce((s, e) => s + (e.distance ?? 0), 0)
  const avgHrv = health.length
    ? (health.reduce((s, h) => s + (h.hrv ?? 0), 0) / health.length).toFixed(1)
    : '—'
  const avgSleep = health.filter(h => h.sleepScore).length
    ? (health.filter(h => h.sleepScore).reduce((s, h) => s + (h.sleepScore ?? 0), 0) /
       health.filter(h => h.sleepScore).length).toFixed(0)
    : '—'
  const injuryNotes = actual.filter(e => e.injuryNotes).map(e => `  ${e.date}: ${e.injuryNotes}`).join('\n')

  const lines = [
    `PHASE: ${phase?.name ?? '—'} — ${phase?.goal ?? ''}`,
    '',
    `RUNNING VOLUME: Planned ${totalPlanned.toFixed(1)} mi vs Actual ${totalRunMi.toFixed(1)} mi`,
    '',
    'PLANNED WORKOUTS:',
    ...planned.map(w => `  ${w.date} (${w.dayType}): ${w.workout ?? 'Rest'} — ${w.distance ?? 0} mi`),
    '',
    'ACTUAL ACTIVITIES:',
    ...actual.map(e => {
      const zones = [e.zone1, e.zone2, e.zone3, e.zone4, e.zone5]
        .map((z, i) => z ? `Z${i+1}:${z}m` : '').filter(Boolean).join(' ')
      return `  ${e.date}: ${e.activityType} ${e.distance ?? 0} mi | ${e.duration ?? '—'} min | HR ${e.avgHr ?? '—'} | RPE ${e.rpe ?? '—'} | ${zones || 'no zones'} | Notes: ${e.postRunFeel ?? '—'}`
    }),
    '',
    'CROSS-TRAINING SUMMARY:',
    `  Runs: ${runs.length} | Bike rides: ${bikes.length} | Yoga: ${yoga.length}x | Gym/strength: ${gym.length}x | Climbing: ${climb.length}x`,
    bikes.length > 0
      ? `  Bike details: ${bikes.map(b => `${b.date} ${b.duration ?? '—'}min avg HR ${b.avgHr ?? '—'}`).join('; ')}`
      : '',
    '',
    `BODY: Avg HRV ${avgHrv} ms | Avg Sleep Score ${avgSleep}/1000`,
    injuryNotes ? `INJURY/BODY NOTES:\n${injuryNotes}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}

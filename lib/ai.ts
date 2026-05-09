import Anthropic from '@anthropic-ai/sdk'
import type { PlannedWorkout, Phase, Race, TrainingLogEntry, HealthEntry, CoachingNote, WeekReview, CheckInMessage, CheckIn } from './data'
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
  checkIn?: CheckIn | null,
): Promise<CoachingNote> {
  const context = buildWorkoutContext(workout, phase, nextRace, recentLog, todayHealth, recentHealth, checkIn)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Analyze this athlete's readiness and training context for today's pre-workout briefing.

${context}

Format your response EXACTLY as follows:

VERDICT: [One sentence. State the specific data point driving the call (e.g. "HRV down 12ms", "sleep 580/1000") then give a clear, opinionated recommendation: go hard / take it easy / swap to the bike / check in with assistant coach first. Be direct. No hedging.]

READINESS_SCORE: [integer 1-10, where 1=depleted/injured and 10=peak/race-ready]
EFFORT_MODE: [one of exactly: rest|easy|moderate|hard|race]
EFFORT_LABEL: [≤5 words: clear action phrase e.g. "Execute the plan" / "Keep it conversational" / "Recovery jog only" / "Race pace today"]
EFFORT_REASON: [≤8 words: key data point driving the call e.g. "HRV down 8ms, quality day tomorrow"]

## Readiness
SUMMARY: [One line — the key readiness signal and bottom-line status]
- HRV today vs 7-day avg with trend direction
- Resting HR observation
- Sleep score observation
- Overall status: ready / cautious / back off

## Today's Workout in Context
SUMMARY: [One line — what this session is and why it matters right now]
- What this workout is building physiologically
- Why it matters in this phase and week
- How it connects to the race goal
- Recent load pattern and any flags

Reference specific numbers. No tables. No filler.`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = parseCoachingResponse(text)

  return {
    date: workout.date,
    generatedAt: new Date().toISOString(),
    workoutPurpose: workout.reason ?? '',
    coachingTake: parsed.body,
    verdict: parsed.verdict,
    readinessSummary: parsed.readinessSummary,
    workoutSummary: parsed.workoutSummary,
    readinessScore: parsed.readinessScore,
    effortMode: parsed.effortMode,
    effortLabel: parsed.effortLabel,
    effortReason: parsed.effortReason,
    type: 'pre',
  }
}

export async function generatePostWorkoutNote(
  workout: PlannedWorkout,
  phase: Phase | undefined,
  nextRace: Race | undefined,
  todayLogs: TrainingLogEntry[],
  todayHealth: HealthEntry | undefined,
  recentLog: TrainingLogEntry[],
  recentHealth?: HealthEntry[],
  checkIn?: CheckIn | null,
): Promise<CoachingNote> {
  const context = buildPostWorkoutContext(workout, phase, nextRace, todayLogs, todayHealth, recentLog, recentHealth, checkIn)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Write a post-workout assessment for this athlete's completed training day.

${context}

Format your response EXACTLY as follows:

VERDICT: [One sentence. State a specific data point (effort level, zones, RPE, load) then give a clear takeaway: nailed it / solid effort / watch recovery / flag something. Be direct.]

## What Happened
SUMMARY: [One line — planned vs actual bottom line]
- Compare planned vs actual (type, distance, duration, zones)
- If substituted — assess whether it was a smart call
- Reference actual numbers

## Recovery Outlook
SUMMARY: [One line — load characterization and tomorrow's need]
- Characterize today's load (easy/moderate/hard) based on zones, duration, RPE
- What recovery does tomorrow need?
- Flag anything — cumulative load, upcoming quality day, injury signals

Reference specific numbers. No filler.`,
    }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = parseCoachingResponse(text)
  const date = todayLogs[0]?.date ?? workout.date

  return {
    date,
    generatedAt: new Date().toISOString(),
    workoutPurpose: workout.reason ?? '',
    coachingTake: parsed.body,
    verdict: parsed.verdict,
    readinessSummary: parsed.readinessSummary,
    workoutSummary: parsed.workoutSummary,
    type: 'post',
  }
}

export async function generatePTSummaryForRange(
  startDate: string,
  endDate: string,
  log: TrainingLogEntry[],
  health: HealthEntry[],
  phases: Phase[],
): Promise<string> {
  const rangeLog = log.filter(e => e.date >= startDate && e.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date))
  const rangeHealth = health.filter(e => e.date >= startDate && e.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date))

  const runs = rangeLog.filter(e => /run/i.test(e.activityType))
  const bikes = rangeLog.filter(e => /ride|bike|cycling/i.test(e.activityType))
  const yoga = rangeLog.filter(e => /yoga/i.test(e.activityType))
  const gym = rangeLog.filter(e => /weight|strength|gym|lift/i.test(e.activityType))
  const totalRunMi = runs.reduce((s, e) => s + (e.distance ?? 0), 0)
  const injuryNotes = rangeLog.filter(e => e.injuryNotes).map(e => `  ${e.date}: ${e.injuryNotes}`)
  const phase = phases.find(p => p.startDate <= endDate && p.endDate >= startDate)
  const avgHrv = rangeHealth.filter(h => h.hrv).length
    ? (rangeHealth.filter(h => h.hrv).reduce((s, h) => s + (h.hrv ?? 0), 0) /
       rangeHealth.filter(h => h.hrv).length).toFixed(1)
    : '—'
  const avgSleep = rangeHealth.filter(h => h.sleepScore).length
    ? (rangeHealth.filter(h => h.sleepScore).reduce((s, h) => s + (h.sleepScore ?? 0), 0) /
       rangeHealth.filter(h => h.sleepScore).length).toFixed(0)
    : '—'

  const context = [
    `DATE RANGE: ${startDate} to ${endDate}`,
    phase ? `TRAINING PHASE: ${phase.name} — ${phase.goal}` : '',
    '',
    `RUNNING VOLUME: ${totalRunMi.toFixed(1)} mi over ${runs.length} runs`,
    `CROSS-TRAINING: ${bikes.length} bike rides, ${yoga.length} yoga sessions, ${gym.length} gym/strength sessions`,
    '',
    'TRAINING LOG:',
    ...rangeLog.map(e => {
      const zones = [e.zone1, e.zone2, e.zone3, e.zone4, e.zone5]
        .map((z, i) => z ? `Z${i+1}:${z}m` : '').filter(Boolean).join(' ')
      return `  ${e.date}: ${e.activityType} ${e.distance ?? '—'} mi | ${e.duration ?? '—'} min | HR ${e.avgHr ?? '—'} | RPE ${e.rpe ?? '—'} | ${zones || 'no zones'} | Notes: ${e.postRunFeel ?? '—'}`
    }),
    '',
    `HEALTH METRICS: Avg HRV ${avgHrv} ms | Avg Sleep Score ${avgSleep}/1000`,
    injuryNotes.length ? `\nINJURY / BODY NOTES:\n${injuryNotes.join('\n')}` : '',
  ].filter(Boolean).join('\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Write a training summary for this athlete's physical therapist covering ${startDate} to ${endDate}.

${context}

Use bullet points. Two sections:

## Training Load
Bullets: total mileage, key sessions, cross-training, PT directive compliance (yoga/strength/core frequency).

## Body & Recovery
Bullets: any injury or body notes, HRV trend, sleep quality, how the body responded to load. Clinical but readable — the PT needs to know what to watch and what questions to ask.`,
    }],
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}

export async function sendCheckInMessage(
  messages: CheckInMessage[],
  workoutContext: string,
): Promise<{ reply: string; coachingNote: string | null }> {
  const systemPrompt = `You are an assistant coach for a competitive masters runner checking in before their workout.

RULES:
- Answer questions directly and briefly (2–4 sentences max per response).
- Do NOT ask follow-up questions unless the answer is genuinely ambiguous.
- Do NOT initiate new topics or try to extend the conversation.
- Be practical and data-grounded. Reference today's health data when relevant.
- If the runner mentions something affecting training interpretation (planned substitution,
  injury, bad sleep reason, unusual stress) — note it internally for coaching context.

After your reply, output a JSON block on its own line:
{"coachingNote": "one sentence for coaching context or null"}

TODAY'S CONTEXT:
${workoutContext}`

  const apiMessages = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system: systemPrompt,
    messages: apiMessages,
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''

  // Split reply from coaching note JSON
  const jsonMatch = raw.match(/\{"coachingNote":\s*(.+?)\}/)
  let coachingNote: string | null = null
  let reply = raw

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { coachingNote: string | null }
      coachingNote = parsed.coachingNote === 'null' ? null : (parsed.coachingNote || null)
      reply = raw.slice(0, raw.lastIndexOf(jsonMatch[0])).trim()
    } catch {
      // If parsing fails, use the full raw response as reply
    }
  }

  return { reply, coachingNote }
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

function weekInPhase(date: string, phase: Phase): number {
  const dayMs = new Date(date + 'T00:00:00').getTime() - new Date(phase.startDate + 'T00:00:00').getTime()
  return Math.max(1, Math.ceil(dayMs / (7 * 24 * 60 * 60 * 1000)) + 1)
}

function buildWorkoutContext(
  workout: PlannedWorkout,
  phase: Phase | undefined,
  nextRace: Race | undefined,
  recentLog: TrainingLogEntry[],
  health: HealthEntry | undefined,
  recentHealth?: HealthEntry[],
  checkIn?: CheckIn | null,
): string {
  const hrvValues = (recentHealth ?? []).filter(h => h.hrv).map(h => h.hrv!)
  const hrvAvg7 = hrvValues.length
    ? (hrvValues.reduce((s, v) => s + v, 0) / hrvValues.length).toFixed(1)
    : null

  const wip = phase ? weekInPhase(workout.date, phase) : null

  const lines = [
    `TODAY'S WORKOUT: ${workout.dayType} — ${workout.runType ?? ''} — ${workout.workout ?? 'Unplanned'}`,
    `Distance: ${workout.distance ?? '—'} mi | HR Zone: ${workout.hrZone ?? '—'} | Intensity: ${workout.intensity ?? '—'}`,
    `Purpose (from plan): ${workout.reason ?? 'None specified'}`,
    `Instructions: ${workout.instructions ?? 'None'}`,
    '',
    phase ? `CURRENT PHASE: ${phase.name} (Week ${wip} of ${phase.weeks}) — ${phase.goal}` : 'CURRENT PHASE: —',
    phase ? `Phase dates: ${phase.startDate} to ${phase.endDate}` : '',
    nextRace ? `TARGET RACE: ${nextRace.name} (${nextRace.distance}) on ${nextRace.date} — Grade ${nextRace.grade}` : '',
    nextRace?.notes ? `Race notes: ${nextRace.notes}` : '',
    '',
    `TODAY'S HEALTH: HRV ${health?.hrv != null ? Math.round(health.hrv) : '—'} ms${hrvAvg7 ? ` (7-day avg: ${hrvAvg7} ms)` : ''} | Resting HR ${health?.restingHr ?? '—'} bpm | Respiratory Rate ${health?.respiratoryRate ?? '—'} br/min | Sleep Score ${health?.sleepScore ?? '—'}/1000`,
    '',
    checkIn?.coachingNote ? `RUNNER CHECK-IN NOTE: ${checkIn.coachingNote}` : '',
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

function buildPostWorkoutContext(
  workout: PlannedWorkout,
  phase: Phase | undefined,
  nextRace: Race | undefined,
  todayLogs: TrainingLogEntry[],
  health: HealthEntry | undefined,
  recentLog: TrainingLogEntry[],
  recentHealth?: HealthEntry[],
  checkIn?: CheckIn | null,
): string {
  const wip = phase ? weekInPhase(workout.date, phase) : null
  const hrvValues = (recentHealth ?? []).filter(h => h.hrv).map(h => h.hrv!)
  const hrvAvg7 = hrvValues.length
    ? (hrvValues.reduce((s, v) => s + v, 0) / hrvValues.length).toFixed(1)
    : null

  const lines = [
    `PLANNED WORKOUT: ${workout.dayType} — ${workout.runType ?? ''} — ${workout.workout ?? 'Unplanned'}`,
    `Planned distance: ${workout.distance ?? '—'} mi | HR Zone: ${workout.hrZone ?? '—'} | Intensity: ${workout.intensity ?? '—'}`,
    `Purpose: ${workout.reason ?? 'None specified'}`,
    '',
    phase ? `CURRENT PHASE: ${phase.name} (Week ${wip} of ${phase.weeks}) — ${phase.goal}` : '',
    nextRace ? `TARGET RACE: ${nextRace.name} on ${nextRace.date} — Grade ${nextRace.grade}` : '',
    '',
    'ACTUAL ACTIVITIES TODAY:',
    ...todayLogs.map(e => {
      const zones = [e.zone1, e.zone2, e.zone3, e.zone4, e.zone5]
        .map((z, i) => z ? `Z${i+1}:${z}m` : '').filter(Boolean).join(' ')
      return `  ${e.activityType}: ${e.distance ?? '—'} mi | ${e.duration ?? '—'} min | Avg HR ${e.avgHr ?? '—'} | Max HR ${e.maxHr ?? '—'} | RPE ${e.rpe ?? '—'} | ${zones || 'no zones'} | Notes: ${e.postRunFeel ?? '—'} | Injury notes: ${e.injuryNotes ?? 'none'}`
    }),
    '',
    `TODAY'S HEALTH: HRV ${health?.hrv != null ? Math.round(health.hrv) : '—'} ms${hrvAvg7 ? ` (7-day avg: ${hrvAvg7} ms)` : ''} | Resting HR ${health?.restingHr ?? '—'} bpm | Sleep Score ${health?.sleepScore ?? '—'}/1000`,
    '',
    checkIn?.coachingNote ? `RUNNER CHECK-IN NOTE: ${checkIn.coachingNote}` : '',
    '',
    'RECENT TRAINING (last 7 days, excluding today):',
    ...recentLog.slice(0, 7).map(e => {
      const zones = [e.zone1, e.zone2, e.zone3, e.zone4, e.zone5]
        .map((z, i) => z ? `Z${i+1}:${z}m` : '').filter(Boolean).join(' ')
      return `  ${e.date}: ${e.activityType} ${e.distance ?? '—'} mi | ${e.duration ?? '—'} min | HR ${e.avgHr ?? '—'} | RPE ${e.rpe ?? '—'} | ${zones || 'no zones'}`
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

function parseCoachingResponse(text: string): {
  verdict: string
  readinessSummary: string
  workoutSummary: string
  body: string
  readinessScore: number | undefined
  effortMode: 'rest' | 'easy' | 'moderate' | 'hard' | 'race' | undefined
  effortLabel: string | undefined
  effortReason: string | undefined
} {
  const verdictMatch = text.match(/^VERDICT:\s*(.+)/m)
  const verdict = verdictMatch ? verdictMatch[1].trim() : ''

  const readinessSummaryMatch = text.match(/## Readiness\nSUMMARY:\s*(.+)/m)
  const readinessSummary = readinessSummaryMatch ? readinessSummaryMatch[1].trim() : ''

  const workoutSummaryMatch = text.match(/## Today's Workout in Context\nSUMMARY:\s*(.+)/m)
  const workoutSummary = workoutSummaryMatch ? workoutSummaryMatch[1].trim() : ''

  const scoreMatch = text.match(/^READINESS_SCORE:\s*(\d+)/m)
  const readinessScore = scoreMatch ? Math.min(10, Math.max(1, parseInt(scoreMatch[1]))) : undefined

  const modeMatch = text.match(/^EFFORT_MODE:\s*(\w+)/m)
  const rawMode = modeMatch ? modeMatch[1].toLowerCase() : ''
  const effortMode = (['rest', 'easy', 'moderate', 'hard', 'race'] as const).includes(rawMode as never)
    ? rawMode as 'rest' | 'easy' | 'moderate' | 'hard' | 'race'
    : undefined

  const effortLabelMatch = text.match(/^EFFORT_LABEL:\s*(.+)/m)
  const effortLabel = effortLabelMatch ? effortLabelMatch[1].trim() : undefined

  const effortReasonMatch = text.match(/^EFFORT_REASON:\s*(.+)/m)
  const effortReason = effortReasonMatch ? effortReasonMatch[1].trim() : undefined

  const afterVerdict = text.replace(/^VERDICT:.+\n?/m, '').trim()
  const body = afterVerdict
    .replace(/^SUMMARY:.+\n?/gm, '')
    .replace(/^READINESS_SCORE:.+\n?/gm, '')
    .replace(/^EFFORT_MODE:.+\n?/gm, '')
    .replace(/^EFFORT_LABEL:.+\n?/gm, '')
    .replace(/^EFFORT_REASON:.+\n?/gm, '')
    .trim()

  return { verdict, readinessSummary, workoutSummary, body, readinessScore, effortMode, effortLabel, effortReason }
}

import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { syncStravaActivities } from '@/lib/strava'
import { fetchPlanData, fetchTrainingData, fetchTrainingLog } from '@/lib/sheets'
import { generatePostWorkoutNote } from '@/lib/ai'
import { setPostCoachingNote, getCheckIn } from '@/lib/kv'

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await syncStravaActivities()
    revalidatePath('/')
    revalidatePath('/week')

    if (result.added > 0) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
      regeneratePostNote(today).catch(() => {})
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('Strava sync error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

async function regeneratePostNote(date: string) {
  const [{ plan, phases, races }, { health }, log] = await Promise.all([
    fetchPlanData({ fresh: true }),
    fetchTrainingData({ fresh: true }),
    fetchTrainingLog({ fresh: true }),
  ])

  const workout = plan.find(e => e.date === date)
  if (!workout) return

  const todayLogs = log.filter(e => e.date === date)
  if (todayLogs.length === 0) return

  const hasRun = todayLogs.some(e => /run/i.test(e.activityType))
  const checkIn = await getCheckIn(date).catch(() => null)
  const runReplacementFlagged = checkIn?.coachingNote?.toLowerCase().includes('replacement') ||
    checkIn?.coachingNote?.toLowerCase().includes('bike') ||
    checkIn?.coachingNote?.toLowerCase().includes('substitute')
  const hasBike = todayLogs.some(e => /ride|bike|cycling/i.test(e.activityType))
  const bikeQualifies = hasBike && (runReplacementFlagged ||
    todayLogs.some(e => /ride|bike|cycling/i.test(e.activityType) && (e.duration ?? 0) >= 45))

  if (!hasRun && !bikeQualifies) return

  const phase = phases.find(p => p.startDate <= date && p.endDate >= date)
  const nextRace = races.filter(r => r.date >= date).sort((a, b) => a.date.localeCompare(b.date))[0]
  const recentLog = log.filter(e => e.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
  const dayHealth = health.find(e => e.date === date)
  const recentHealth = health.filter(e => e.date < date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)

  const note = await generatePostWorkoutNote(workout, phase, nextRace, todayLogs, dayHealth, recentLog, recentHealth, checkIn)
  await setPostCoachingNote(note)
}

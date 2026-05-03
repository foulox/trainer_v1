import { NextResponse } from 'next/server'
import { fetchPlanData, fetchTrainingData, fetchTrainingLog } from '@/lib/sheets'
import { generateCoachingNote } from '@/lib/ai'
import { setCoachingNote } from '@/lib/kv'

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const [{ plan, phases, races }, { health }, log] = await Promise.all([
      fetchPlanData({ fresh: true }),
      fetchTrainingData({ fresh: true }),
      fetchTrainingLog({ fresh: true }),
    ])

    const upcomingWorkouts = plan.filter(
      e => e.date >= today && e.date <= nextWeek && e.dayType !== 'Rest'
    )

    let generated = 0
    for (const workout of upcomingWorkouts) {
      const phase = phases.find(p => p.startDate <= workout.date && p.endDate >= workout.date)
      const nextRace = races
        .filter(r => r.date >= workout.date)
        .sort((a, b) => a.date.localeCompare(b.date))[0]
      const recentLog = log
        .filter(e => e.date < workout.date)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7)
      const dayHealth = health.find(e => e.date === workout.date)

      const note = await generateCoachingNote(workout, phase, nextRace, recentLog, dayHealth)
      await setCoachingNote(note)
      generated++
    }

    return NextResponse.json({ ok: true, generated })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('AI coaching cron error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

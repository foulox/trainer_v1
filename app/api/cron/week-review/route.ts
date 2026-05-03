import { NextResponse } from 'next/server'
import { fetchPlanData, fetchTrainingData, fetchTrainingLog } from '@/lib/sheets'
import { generateWeekReview } from '@/lib/ai'
import { setWeekReview } from '@/lib/kv'

function getWeekBounds(date: string) {
  const d = new Date(date + 'T00:00:00')
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  }
}

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // Runs Monday 4am UTC — review the just-completed Sun–Sat week
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { start, end } = getWeekBounds(yesterday)

    const [{ plan, phases }, { health }, log] = await Promise.all([
      fetchPlanData(),
      fetchTrainingData(),
      fetchTrainingLog(),
    ])

    const weekPlan = plan.filter(e => e.date >= start && e.date <= end)
    const weekLog = log.filter(e => e.date >= start && e.date <= end)
    const weekHealth = health.filter(e => e.date >= start && e.date <= end)
    const weekNum = weekPlan[0]?.week ?? 0
    const phase =
      phases.find(p => p.startDate <= start && p.endDate >= start) ??
      phases.find(p => p.startDate <= end && p.endDate >= end)

    const review = await generateWeekReview(weekNum, start, end, weekPlan, weekLog, weekHealth, phase)
    await setWeekReview(review)

    return NextResponse.json({ ok: true, weekNum, start, end })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('Week review cron error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

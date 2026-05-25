import { fetchPlanData, fetchTrainingData, fetchTrainingLog } from '@/lib/sheets'
import { getWeekReview, setWeekReview, getWeekNotes } from '@/lib/kv'
import { generateWeekReview } from '@/lib/ai'
import WeekClient from '@/components/WeekClient'

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

export default async function WeekPage() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const { start, end } = getWeekBounds(today)

  const [{ plan, phases, races }, { health, strava }, log, weekNotes] = await Promise.all([
    fetchPlanData(),
    fetchTrainingData(),
    fetchTrainingLog(),
    getWeekNotes(),
  ])

  const weekPlan = plan.filter(e => e.date >= start && e.date <= end)
  const weekLog = log.filter(e => e.date >= start && e.date <= end)
  const weekHealth = health.filter(e => e.date >= start && e.date <= end)
  const weekStrava = strava.filter(a => a.date >= start && a.date <= end)

  const weekNum = weekPlan[0]?.week ?? 1
  let weekReview = await getWeekReview(weekNum).catch(() => null)
  if (!weekReview && weekLog.length > 0) {
    const phase =
      phases.find(p => p.startDate <= start && p.endDate >= start) ??
      phases.find(p => p.startDate <= end && p.endDate >= end)
    weekReview = await generateWeekReview(weekNum, start, end, weekPlan, weekLog, weekHealth, phase).catch(() => null)
    if (weekReview) await setWeekReview(weekReview).catch(() => {})
  }

  return (
    <WeekClient
      today={today}
      initialWeekStart={start}
      plan={plan}
      log={log}
      health={health}
      phases={phases}
      strava={strava}
      initialWeekReview={weekReview}
      weekNotes={weekNotes}
    />
  )
}

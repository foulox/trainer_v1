import { fetchPlanData, fetchTrainingData, fetchTrainingLog } from '@/lib/sheets'
import { getWeekReview } from '@/lib/kv'
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
  const today = new Date().toISOString().slice(0, 10)
  const { start, end } = getWeekBounds(today)

  const [{ plan, phases, races }, { health, strava }, log] = await Promise.all([
    fetchPlanData(),
    fetchTrainingData(),
    fetchTrainingLog(),
  ])

  const weekPlan = plan.filter(e => e.date >= start && e.date <= end)
  const weekLog = log.filter(e => e.date >= start && e.date <= end)
  const weekHealth = health.filter(e => e.date >= start && e.date <= end)
  const weekStrava = strava.filter(a => a.date >= start && a.date <= end)

  const weekNum = weekPlan[0]?.week ?? 1
  const weekReview = await getWeekReview(weekNum).catch(() => null)

  const currentPhase = phases.find(p => p.startDate <= today && p.endDate >= today) ?? phases[0] ?? null
  const nextRace = races.filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null

  return (
    <WeekClient
      today={today}
      weekStart={start}
      weekEnd={end}
      weekNum={weekNum}
      weekPlan={weekPlan}
      weekLog={weekLog}
      weekHealth={weekHealth}
      weekReview={weekReview}
      currentPhase={currentPhase}
      nextRace={nextRace}
      stravaActivities={weekStrava}
    />
  )
}

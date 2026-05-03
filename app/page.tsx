import { fetchPlanData, fetchTrainingData, fetchTrainingLog } from '@/lib/sheets'
import { getCoachingNote, setCoachingNote } from '@/lib/kv'
import { generateCoachingNote } from '@/lib/ai'
import TodayClient from '@/components/TodayClient'

export default async function TodayPage() {
  const today = new Date().toISOString().slice(0, 10)

  const [{ plan, phases, races }, { health, strava }, log] = await Promise.all([
    fetchPlanData(),
    fetchTrainingData(),
    fetchTrainingLog(),
  ])

  const todayEntry = plan.find(e => e.date === today) ?? null
  const nextWorkout = plan.find(e => e.date >= today && e.dayType !== 'Rest') ?? null
  const todayHealth = health.find(e => e.date === today) ?? null
  const todayLogs = log.filter(e => e.date === today)

  const currentPhase = phases.find(p => p.startDate <= today && p.endDate >= today) ?? phases[0] ?? null
  const nextRace = races.filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null

  let coachingNote = todayEntry ? await getCoachingNote(today).catch(() => null) : null
  if (!coachingNote && todayEntry && todayEntry.dayType !== 'Rest') {
    const recentLog = log
      .filter(e => e.date < today)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7)
    coachingNote = await generateCoachingNote(
      todayEntry, currentPhase ?? undefined, nextRace ?? undefined, recentLog, todayHealth ?? undefined
    ).catch(() => null)
    if (coachingNote) await setCoachingNote(coachingNote).catch(() => {})
  }

  return (
    <TodayClient
      today={today}
      todayEntry={todayEntry}
      nextWorkout={nextWorkout}
      todayHealth={todayHealth}
      todayLogs={todayLogs}
      stravaActivities={strava}
      currentPhase={currentPhase}
      nextRace={nextRace}
      coachingNote={coachingNote}
    />
  )
}

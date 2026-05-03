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

  // Pre-fetch today's coaching note so first load is instant
  const todayEntry = plan.find(e => e.date === today)
  let initialCoachingNote = todayEntry ? await getCoachingNote(today).catch(() => null) : null
  if (!initialCoachingNote && todayEntry && todayEntry.dayType !== 'Rest') {
    const recentLog = log.filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
    const recentHealth = health.filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
    const currentPhase = phases.find(p => p.startDate <= today && p.endDate >= today) ?? phases[0]
    const nextRace = races.filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
    initialCoachingNote = await generateCoachingNote(
      todayEntry, currentPhase, nextRace, recentLog, health.find(e => e.date === today), recentHealth
    ).catch(() => null)
    if (initialCoachingNote) await setCoachingNote(initialCoachingNote).catch(() => {})
  }

  return (
    <TodayClient
      today={today}
      plan={plan}
      phases={phases}
      races={races}
      health={health}
      log={log}
      strava={strava}
      initialCoachingNote={initialCoachingNote}
    />
  )
}

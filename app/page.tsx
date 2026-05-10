import { fetchPlanData, fetchTrainingData, fetchTrainingLog, fetchLibrary } from '@/lib/sheets'
import { getCoachingNote, setCoachingNote, getPostCoachingNote, getCheckIn } from '@/lib/kv'
import { generateCoachingNote, generateRestDayNote } from '@/lib/ai'
import TodayClient from '@/components/TodayClient'

export default async function TodayPage() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  const [{ plan, phases, races }, { health, strava }, log, library] = await Promise.all([
    fetchPlanData(),
    fetchTrainingData(),
    fetchTrainingLog(),
    fetchLibrary(),
  ])

  const todayEntry = plan.find(e => e.date === today)
  const checkIn = await getCheckIn(today).catch(() => null)

  let initialCoachingNote = todayEntry ? await getCoachingNote(today).catch(() => null) : null
  if (!initialCoachingNote && todayEntry) {
    const recentLog = log.filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
    const recentHealth = health.filter(e => e.date < today).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
    const currentPhase = phases.find(p => p.startDate <= today && p.endDate >= today) ?? phases[0]
    const nextRace = races.filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]
    if (todayEntry.dayType === 'Rest') {
      initialCoachingNote = await generateRestDayNote(
        todayEntry, currentPhase, nextRace, recentLog, health.find(e => e.date === today), recentHealth
      ).catch(() => null)
    } else {
      initialCoachingNote = await generateCoachingNote(
        todayEntry, currentPhase, nextRace, recentLog, health.find(e => e.date === today), recentHealth, checkIn
      ).catch(() => null)
    }
    if (initialCoachingNote) await setCoachingNote(initialCoachingNote).catch(() => {})
  }

  const initialPostNote = await getPostCoachingNote(today).catch(() => null)

  return (
    <TodayClient
      today={today}
      plan={plan}
      phases={phases}
      races={races}
      health={health}
      log={log}
      strava={strava}
      library={library}
      initialCoachingNote={initialCoachingNote}
      initialPostNote={initialPostNote}
      initialCheckIn={checkIn}
    />
  )
}

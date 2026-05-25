import { fetchPlanData, fetchLibrary, fetchTrainingLog } from '@/lib/sheets'
import { getWeekNotes } from '@/lib/kv'
import PlanClient from '@/components/PlanClient'

export default async function PlanPage() {
  const [{ plan, phases, races }, library, log, weekNotes] = await Promise.all([
    fetchPlanData(),
    fetchLibrary(),
    fetchTrainingLog(),
    getWeekNotes(),
  ])
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  return <PlanClient plan={plan} phases={phases} races={races} library={library} log={log} weekNotes={weekNotes} today={today} />
}

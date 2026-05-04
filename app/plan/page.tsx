import { fetchPlanData, fetchLibrary } from '@/lib/sheets'
import PlanClient from '@/components/PlanClient'

export default async function PlanPage() {
  const [{ plan, phases, races }, library] = await Promise.all([
    fetchPlanData(),
    fetchLibrary(),
  ])
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  return <PlanClient plan={plan} phases={phases} races={races} library={library} today={today} />
}

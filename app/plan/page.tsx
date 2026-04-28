import { fetchPlanData, fetchLibrary } from '@/lib/sheets'
import PlanClient from '@/components/PlanClient'

export default async function PlanPage() {
  const [{ plan, phases, races }, library] = await Promise.all([
    fetchPlanData(),
    fetchLibrary(),
  ])
  const today = new Date().toISOString().slice(0, 10)
  return <PlanClient plan={plan} phases={phases} races={races} library={library} today={today} />
}

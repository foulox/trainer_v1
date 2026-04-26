import { fetchPlanData } from '@/lib/sheets'
import PlanClient from '@/components/PlanClient'

export default async function PlanPage() {
  const { plan, phases, races } = await fetchPlanData()
  const today = new Date().toISOString().slice(0, 10)
  return <PlanClient plan={plan} phases={phases} races={races} today={today} />
}

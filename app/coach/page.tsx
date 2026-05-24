import { getCoachProfile } from '@/lib/kv'
import CoachClient from '@/components/CoachClient'

export default async function CoachPage() {
  const profile = await getCoachProfile()
  return <CoachClient initialProfile={profile} />
}

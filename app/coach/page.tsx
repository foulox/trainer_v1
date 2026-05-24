import { getCoachProfile, getPlaybookQuotes } from '@/lib/kv'
import CoachClient from '@/components/CoachClient'

export default async function CoachPage() {
  const [profile, quotes] = await Promise.all([getCoachProfile(), getPlaybookQuotes()])
  return <CoachClient initialProfile={profile} initialQuotes={quotes} />
}

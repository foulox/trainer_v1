import { kv } from '@vercel/kv'
import type { CoachingNote, WeekReview, CheckIn, CoachProfile, PlaybookQuote } from './data'

export async function getCoachingNote(date: string): Promise<CoachingNote | null> {
  return kv.get<CoachingNote>(`coaching:${date}`)
}

export async function setCoachingNote(note: CoachingNote): Promise<void> {
  await kv.set(`coaching:${note.date}`, note, { ex: 60 * 60 * 24 * 7 })
}

export async function getPostCoachingNote(date: string): Promise<CoachingNote | null> {
  return kv.get<CoachingNote>(`coaching:post:${date}`)
}

export async function setPostCoachingNote(note: CoachingNote): Promise<void> {
  await kv.set(`coaching:post:${note.date}`, note, { ex: 60 * 60 * 24 * 7 })
}

export async function getCheckIn(date: string): Promise<CheckIn | null> {
  return kv.get<CheckIn>(`checkin:${date}`)
}

export async function setCheckIn(checkIn: CheckIn): Promise<void> {
  await kv.set(`checkin:${checkIn.date}`, checkIn, { ex: 60 * 60 * 24 * 14 })
}

export async function getWeekReview(weekNumber: number): Promise<WeekReview | null> {
  return kv.get<WeekReview>(`week-review:${weekNumber}`)
}

export async function setWeekReview(review: WeekReview): Promise<void> {
  await kv.set(`week-review:${review.weekNumber}`, review, { ex: 60 * 60 * 24 * 14 })
}

export async function getCoachProfile(): Promise<CoachProfile | null> {
  try {
    return await kv.get<CoachProfile>('coach:profile')
  } catch {
    return null
  }
}

export async function setCoachProfile(profile: CoachProfile): Promise<void> {
  await kv.set('coach:profile', profile)
}

export async function getPlaybookQuotes(): Promise<PlaybookQuote[]> {
  try {
    return await kv.get<PlaybookQuote[]>('coach:playbook:quotes') ?? []
  } catch {
    return []
  }
}

export async function savePlaybookQuotes(quotes: PlaybookQuote[]): Promise<void> {
  await kv.set('coach:playbook:quotes', quotes)
}

export async function getWeekNotes(): Promise<Record<string, string>> {
  try {
    return await kv.get<Record<string, string>>('week:notes') ?? {}
  } catch {
    return {}
  }
}

export async function saveWeekNotes(notes: Record<string, string>): Promise<void> {
  await kv.set('week:notes', notes)
}

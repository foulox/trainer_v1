import { kv } from '@vercel/kv'
import type { CoachingNote, WeekReview } from './data'

export async function getCoachingNote(date: string): Promise<CoachingNote | null> {
  return kv.get<CoachingNote>(`coaching:${date}`)
}

export async function setCoachingNote(note: CoachingNote): Promise<void> {
  await kv.set(`coaching:${note.date}`, note, { ex: 60 * 60 * 24 * 7 })
}

export async function getWeekReview(weekNumber: number): Promise<WeekReview | null> {
  return kv.get<WeekReview>(`week-review:${weekNumber}`)
}

export async function setWeekReview(review: WeekReview): Promise<void> {
  await kv.set(`week-review:${review.weekNumber}`, review, { ex: 60 * 60 * 24 * 14 })
}

export type PlannedWorkout = {
  date: string
  day: string
  week: number
  phase: string
  dayType: 'Run' | 'Bike' | 'Supplementary' | 'Rest' | 'Race'
  runType: string | null
  workout: string | null
  distance: number | null
  targetPace: string | null
  hrZone: number | null
  intensity: string | null
  energySystem: string | null
  reason: string | null
  instructions: string | null
  notes: string | null
}

export type Phase = {
  name: string
  startDate: string
  endDate: string
  weeks: number
  goal: string
}

export type LibraryWorkout = {
  name: string
  sport: string
  category: string
  type: string
  reason: string
  instructions: string
  distTime: string
  lapStructure: string
  energySystem: string
  hrZone: string
  rpe: string
  coachingNotes: string | null
  mapLink: string | null
  variation: string
  progression: number | null
  author: string | null
  raceTypes: string[]
  trainingPhases: string[]
}

export const RACE_TYPES = ['Mile', '5K', '10K', 'Half', 'Full'] as const
export const TRAINING_PHASES = ['Base', 'Build', 'Peak', 'Taper'] as const

export const ABBREVIATIONS: { abbr: string; meaning: string }[] = [
  { abbr: 'WU', meaning: 'Warm-up' },
  { abbr: 'CD', meaning: 'Cool-down' },
  { abbr: 'r', meaning: 'Recovery' },
  { abbr: '@', meaning: 'At pace' },
  { abbr: 'MP', meaning: 'Marathon Pace' },
  { abbr: 'HMP', meaning: 'Half Marathon Pace' },
  { abbr: '10M', meaning: '10-Mile Pace' },
  { abbr: '10K / 5K', meaning: 'Race pace at that distance' },
  { abbr: 'LT', meaning: 'Lactate Threshold' },
  { abbr: 'Z1–Z5', meaning: 'Heart Rate Zones 1–5' },
  { abbr: 'RPE', meaning: 'Rate of Perceived Exertion (1–10)' },
  { abbr: '×', meaning: 'Repeats / sets' },
  { abbr: 's / min', meaning: 'Seconds / minutes' },
]

export type Race = {
  name: string
  date: string
  distance: string
  grade: 'A' | 'B' | 'C'
  location: string
  notes: string | null
}

export type StravaActivity = {
  activityId: string
  date: string
  name: string
  type: string
  distance: number
  movingTime: number
  pace: string | null
  avgHr: number | null
  maxHr: number | null
  calories: number | null
  elevation: number | null
  description: string | null
  stravaUrl: string | null
}

export type HealthEntry = {
  date: string
  restingHr: number | null
  hrv: number | null
  sleepScore: number | null   // SleepWatch score 0–1000, stored in "Sleep Quality" sheet column
  respiratoryRate: number | null
  steps: number | null
  activeCalories: number | null
  vo2max: number | null
  weight: number | null
  notes: string | null
}

export type TrainingLogEntry = {
  date: string
  day: string
  week: number
  phase: string
  activityType: string
  source: 'Strava' | 'Manual'
  distance: number | null
  duration: number | null
  pace: string | null
  avgHr: number | null
  maxHr: number | null
  elevation: number | null
  rpe: number | null
  effortFeel: string | null
  postRunFeel: string | null
  stravaId: string | null
  injuryNotes: string | null
  notes: string | null
  zone1: number | null
  zone2: number | null
  zone3: number | null
  zone4: number | null
  zone5: number | null
}

export type CoachingNote = {
  date: string
  generatedAt: string
  workoutPurpose: string
  coachingTake: string
  type?: 'pre' | 'post'
  verdict?: string
  readinessSummary?: string
  workoutSummary?: string
  readinessScore?: number
  effortMode?: 'rest' | 'easy' | 'moderate' | 'hard' | 'race'
  effortLabel?: string
  effortReason?: string
}

export type CheckInMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type CheckIn = {
  date: string
  messages: CheckInMessage[]
  coachingNote: string | null
}

export type WeekReview = {
  weekNumber: number
  startDate: string
  endDate: string
  generatedAt: string
  summary: string
  ptSummary: string
}

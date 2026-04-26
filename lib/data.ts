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

export type Race = {
  name: string
  date: string
  distance: string
  purpose: 'Target' | 'Test'
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
  sleepHours: number | null
  sleepQuality: string | null
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
}

export type CoachingNote = {
  date: string
  generatedAt: string
  workoutPurpose: string
  coachingTake: string
}

export type WeekReview = {
  weekNumber: number
  startDate: string
  endDate: string
  generatedAt: string
  summary: string
  ptSummary: string
}

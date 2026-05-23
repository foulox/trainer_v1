// Run start times by day of week (0=Sun…6=Sat). Sunday is rest — no entry.
export const RUN_START_TIMES: Record<number, string> = {
  1: '06:45', 2: '06:30', 3: '06:00', 4: '06:30', 5: '07:00', 6: '08:00',
}

export function getLeaveByTime(isoDate: string): string | null {
  const dow = new Date(isoDate + 'T00:00:00').getDay()
  const start = RUN_START_TIMES[dow]
  if (!start) return null
  const [h, m] = start.split(':').map(Number)
  const lm = h * 60 + m - 10
  return `${Math.floor(lm / 60)}:${String(lm % 60).padStart(2, '0')}`
}

export function computeLeaveByFromStart(startTime: string): string {
  const [h, m] = startTime.split(':').map(Number)
  const lm = h * 60 + m - 10
  return `${Math.floor(lm / 60)}:${String(lm % 60).padStart(2, '0')}`
}

// Accepts total minutes since midnight so callers can inject time for testing.
function isBeforeRunWindow(isoDate: string, currentTotalMinutes: number): boolean {
  const dow = new Date(isoDate + 'T00:00:00').getDay()
  const start = RUN_START_TIMES[dow]
  if (!start) return false
  const [h, m] = start.split(':').map(Number)
  return currentTotalMinutes < h * 60 + m + 45
}

export type TodayFlagsInput = {
  isViewingToday: boolean
  hasActivities: boolean
  isRestDay: boolean
  today: string
  currentHour: number
  currentMinutes: number
}

export type TodayFlags = {
  isMorningWindow: boolean
  isEveningMode: boolean
  isPostRun: boolean
  isAfternoon: boolean
  showSyncPrompt: boolean
  isNightMode: boolean
}

export function computeTodayFlags({
  isViewingToday,
  hasActivities,
  isRestDay,
  today,
  currentHour,
  currentMinutes,
}: TodayFlagsInput): TodayFlags {
  const totalMinutes = currentHour * 60 + currentMinutes
  const isMorningWindow = isViewingToday && !isRestDay && !hasActivities && isBeforeRunWindow(today, totalMinutes)
  const isEveningMode = isViewingToday && !isMorningWindow && (hasActivities || isRestDay)
  const isPostRun = isViewingToday && hasActivities && !isRestDay
  const isAfternoon = currentHour >= 13
  const showSyncPrompt = isViewingToday && !isRestDay && !hasActivities && !isMorningWindow && isAfternoon
  const isNightMode = isViewingToday && isEveningMode && currentHour >= 20
  return { isMorningWindow, isEveningMode, isPostRun, isAfternoon, showSyncPrompt, isNightMode }
}

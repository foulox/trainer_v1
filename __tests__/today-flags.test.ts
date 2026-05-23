import {
  getLeaveByTime,
  computeLeaveByFromStart,
  computeTodayFlags,
} from '../lib/today-flags'

// Known dates by day of week
const MONDAY    = '2026-05-25'  // dow=1, run start 06:45, window closes at 07:30
const WEDNESDAY = '2026-05-27'  // dow=3, run start 06:00, window closes at 06:45
const FRIDAY    = '2026-05-29'  // dow=5, run start 07:00, window closes at 07:45
const SATURDAY  = '2026-05-23'  // dow=6, run start 08:00, window closes at 08:45
const SUNDAY    = '2026-05-24'  // dow=0, no run scheduled

// Helper to build computeTodayFlags input with sensible defaults
function flags(overrides: Partial<Parameters<typeof computeTodayFlags>[0]>) {
  return computeTodayFlags({
    isViewingToday: true,
    hasActivities: false,
    isRestDay: false,
    today: MONDAY,
    currentHour: 7,
    currentMinutes: 0,
    ...overrides,
  })
}

// ─── getLeaveByTime ──────────────────────────────────────────────────────────

describe('getLeaveByTime', () => {
  it('Monday: 06:45 start → 06:35 leave-by', () => {
    expect(getLeaveByTime(MONDAY)).toBe('6:35')
  })

  it('Wednesday: 06:00 start → 05:50 leave-by', () => {
    expect(getLeaveByTime(WEDNESDAY)).toBe('5:50')
  })

  it('Saturday: 08:00 start → 07:50 leave-by', () => {
    expect(getLeaveByTime(SATURDAY)).toBe('7:50')
  })

  it('Sunday: no run scheduled → null', () => {
    expect(getLeaveByTime(SUNDAY)).toBeNull()
  })
})

// ─── computeLeaveByFromStart ─────────────────────────────────────────────────

describe('computeLeaveByFromStart', () => {
  it('06:45 → 06:35', () => {
    expect(computeLeaveByFromStart('06:45')).toBe('6:35')
  })

  it('06:00 → 05:50', () => {
    expect(computeLeaveByFromStart('06:00')).toBe('5:50')
  })

  it('08:00 → 07:50', () => {
    expect(computeLeaveByFromStart('08:00')).toBe('7:50')
  })
})

// ─── isMorningWindow ─────────────────────────────────────────────────────────

describe('isMorningWindow', () => {
  it('is true before run window, no activities, workout day, viewing today', () => {
    // Monday window closes at 7:30am (06:45 + 45min). 7:00am is inside.
    expect(flags({ currentHour: 7, currentMinutes: 0 }).isMorningWindow).toBe(true)
  })

  it('is false at exactly the window close (7:30am Monday)', () => {
    expect(flags({ currentHour: 7, currentMinutes: 30 }).isMorningWindow).toBe(false)
  })

  it('is false after the window (8:00am Monday)', () => {
    expect(flags({ currentHour: 8, currentMinutes: 0 }).isMorningWindow).toBe(false)
  })

  it('is false when there are already activities', () => {
    expect(flags({ hasActivities: true, currentHour: 7, currentMinutes: 0 }).isMorningWindow).toBe(false)
  })

  it('is false on a rest day', () => {
    expect(flags({ isRestDay: true, currentHour: 7, currentMinutes: 0 }).isMorningWindow).toBe(false)
  })

  it('is false when viewing a past date (not today)', () => {
    expect(flags({ isViewingToday: false, currentHour: 7, currentMinutes: 0 }).isMorningWindow).toBe(false)
  })

  it('is false on Sunday (no scheduled run)', () => {
    expect(flags({ today: SUNDAY, currentHour: 7, currentMinutes: 0 }).isMorningWindow).toBe(false)
  })

  it('Wednesday window closes at 06:45 — 06:30 is still inside', () => {
    expect(flags({ today: WEDNESDAY, currentHour: 6, currentMinutes: 30 }).isMorningWindow).toBe(true)
  })

  it('Wednesday window closes at 06:45 — 06:50 is outside', () => {
    expect(flags({ today: WEDNESDAY, currentHour: 6, currentMinutes: 50 }).isMorningWindow).toBe(false)
  })
})

// ─── isPostRun ───────────────────────────────────────────────────────────────

describe('isPostRun', () => {
  it('is true when viewing today with activities on a workout day', () => {
    expect(flags({ hasActivities: true }).isPostRun).toBe(true)
  })

  it('is false on a rest day even with activities logged', () => {
    // Rest day + activity (e.g. bike commute) — should not trigger post-run view
    expect(flags({ hasActivities: true, isRestDay: true }).isPostRun).toBe(false)
  })

  it('is false with no activities', () => {
    expect(flags({ hasActivities: false }).isPostRun).toBe(false)
  })

  it('is false when viewing a past date even with activities', () => {
    // Navigating back to yesterday should not trigger post-run view for today
    expect(flags({ isViewingToday: false, hasActivities: true }).isPostRun).toBe(false)
  })
})

// ─── isEveningMode ───────────────────────────────────────────────────────────

describe('isEveningMode', () => {
  // Evening = viewing today, past morning window, and (has activities OR rest day)

  it('is true in afternoon after a run', () => {
    expect(flags({ hasActivities: true, currentHour: 14 }).isEveningMode).toBe(true)
  })

  it('is true on a rest day after the morning window', () => {
    expect(flags({ isRestDay: true, currentHour: 14 }).isEveningMode).toBe(true)
  })

  it('is false during the morning window (pre-run)', () => {
    // Still inside morning window — should show pre-run state, not evening
    expect(flags({ hasActivities: false, isRestDay: false, currentHour: 7, currentMinutes: 0 }).isEveningMode).toBe(false)
  })

  it('is false with no activities and not a rest day (awaiting sync)', () => {
    // Past morning window but no activity — sync prompt state, not evening
    expect(flags({ hasActivities: false, isRestDay: false, currentHour: 15 }).isEveningMode).toBe(false)
  })

  it('is false when viewing a past date', () => {
    expect(flags({ isViewingToday: false, hasActivities: true, currentHour: 14 }).isEveningMode).toBe(false)
  })
})

// ─── showSyncPrompt ──────────────────────────────────────────────────────────

describe('showSyncPrompt', () => {
  // Shows when: viewing today, workout day, no activities, past morning window, afternoon

  it('is true in the afternoon on a workout day with no sync yet', () => {
    expect(flags({ currentHour: 14, hasActivities: false, isRestDay: false }).showSyncPrompt).toBe(true)
  })

  it('is false before 1pm (not yet afternoon)', () => {
    expect(flags({ currentHour: 12, hasActivities: false, isRestDay: false }).showSyncPrompt).toBe(false)
  })

  it('is false once activities are logged', () => {
    expect(flags({ currentHour: 14, hasActivities: true }).showSyncPrompt).toBe(false)
  })

  it('is false on a rest day', () => {
    expect(flags({ currentHour: 14, isRestDay: true }).showSyncPrompt).toBe(false)
  })

  it('is false when viewing a past date', () => {
    expect(flags({ isViewingToday: false, currentHour: 14 }).showSyncPrompt).toBe(false)
  })

  it('is false during the morning window even if afternoon somehow', () => {
    // Defensive: morning window gates sync prompt too
    expect(flags({ currentHour: 7, currentMinutes: 0, hasActivities: false, isRestDay: false }).showSyncPrompt).toBe(false)
  })
})

// ─── isNightMode ─────────────────────────────────────────────────────────────

describe('isNightMode', () => {
  it('is true at 8pm on a day with activities', () => {
    expect(flags({ hasActivities: true, currentHour: 20 }).isNightMode).toBe(true)
  })

  it('is true at 10pm on a rest day', () => {
    expect(flags({ isRestDay: true, currentHour: 22 }).isNightMode).toBe(true)
  })

  it('is false at 7:59pm (not yet night)', () => {
    expect(flags({ hasActivities: true, currentHour: 19, currentMinutes: 59 }).isNightMode).toBe(false)
  })

  it('is false when not in evening mode (no activities, not rest day)', () => {
    // No activities + not rest = no evening mode = no night mode
    expect(flags({ hasActivities: false, isRestDay: false, currentHour: 21 }).isNightMode).toBe(false)
  })

  it('is false when viewing a past date at night', () => {
    expect(flags({ isViewingToday: false, hasActivities: true, currentHour: 21 }).isNightMode).toBe(false)
  })
})

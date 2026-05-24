'use client'

import React, { useState, useTransition, useEffect } from 'react'
import type { PlannedWorkout, Phase, Race, HealthEntry, TrainingLogEntry, CoachingNote, StravaActivity, CheckIn, LibraryWorkout } from '@/lib/data'
import { RUN_START_TIMES, getLeaveByTime, computeLeaveByFromStart, computeTodayFlags } from '@/lib/today-flags'
import { Zap, Moon, Heart, RefreshCw, ChevronLeft, ChevronRight, MessageCircle, ChevronDown, ChevronUp, Activity, Smile, Radio, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { syncStrava, regenerateCoachingNote, fetchCoachingNoteForDate, saveSleepScore, fetchPostWorkoutNoteForDate, refreshHealthData } from '@/app/actions'
import ActivityDrawer from './ActivityDrawer'
import CheckInDrawer from './CheckInDrawer'
import ReactMarkdown from '@/components/Markdown'

const ZONE_COLORS = ['bg-gray-300', 'bg-blue-400', 'bg-green-400', 'bg-amber-400', 'bg-red-400']
const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

function formatDateHeader(iso: string, today: string) {
  if (iso === today) return 'Today'
  const d = new Date(iso + 'T00:00:00')
  const diff = Math.round((d.getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000)
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatDateSub(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function daysUntil(iso: string) {
  const diff = new Date(iso + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function runTypeBorderColor(entry: PlannedWorkout) {
  if (entry.dayType === 'Rest') return 'border-l-gray-200'
  if (entry.dayType === 'Bike') return 'border-l-yellow-500'
  if (entry.dayType === 'Race') return 'border-l-red-500'
  if (entry.runType === 'Easy') return 'border-l-green-500'
  if (entry.runType === 'Long') return 'border-l-purple-500'
  if (entry.runType === 'Quality') return 'border-l-blue-600'
  return 'border-l-blue-400'
}

function hrvColor(hrv: number | null) {
  if (!hrv) return 'text-gray-400'
  if (hrv >= 55) return 'text-emerald-600'
  if (hrv >= 40) return 'text-amber-500'
  return 'text-red-500'
}

function ZoneBar({ logs }: { logs: TrainingLogEntry[] }) {
  const totals = [
    logs.reduce((s, l) => s + (l.zone1 ?? 0), 0),
    logs.reduce((s, l) => s + (l.zone2 ?? 0), 0),
    logs.reduce((s, l) => s + (l.zone3 ?? 0), 0),
    logs.reduce((s, l) => s + (l.zone4 ?? 0), 0),
    logs.reduce((s, l) => s + (l.zone5 ?? 0), 0),
  ]
  const total = totals.reduce((s, v) => s + v, 0)
  if (total === 0) return null
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden mt-2">
      {totals.map((t, i) => t > 0 ? (
        <div key={i} className={ZONE_COLORS[i]} style={{ width: `${(t / total) * 100}%` }} />
      ) : null)}
    </div>
  )
}

const EFFORT_MODES = ['rest', 'easy', 'moderate', 'hard', 'race'] as const
const EFFORT_LABELS: Record<string, string> = { rest: 'Rest', easy: 'Easy', moderate: 'Mod', hard: 'Hard', race: 'Race' }
const EFFORT_DOT: Record<string, string> = {
  rest: 'bg-gray-400', easy: 'bg-blue-400', moderate: 'bg-amber-400', hard: 'bg-orange-500', race: 'bg-red-500',
}
const EFFORT_LINE: Record<string, string> = {
  rest: 'bg-gray-300', easy: 'bg-blue-200', moderate: 'bg-amber-200', hard: 'bg-orange-200', race: 'bg-red-200',
}
const EFFORT_TEXT: Record<string, string> = {
  rest: 'text-gray-600', easy: 'text-blue-600', moderate: 'text-amber-600', hard: 'text-orange-600', race: 'text-red-600',
}

function EffortScale({ mode }: { mode: string }) {
  const activeIdx = EFFORT_MODES.indexOf(mode as typeof EFFORT_MODES[number])
  return (
    <div className="flex items-start">
      {EFFORT_MODES.map((m, i) => {
        const isActive = m === mode
        const isBefore = i < activeIdx
        return (
          <React.Fragment key={m}>
            {i > 0 && (
              <div className={`flex-1 h-px mt-[5px] ${isBefore ? EFFORT_LINE[mode] ?? 'bg-gray-200' : 'bg-gray-100'}`} />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-2.5 h-2.5 rounded-full ${
                isActive ? `${EFFORT_DOT[m]} ring-2 ring-offset-1 ring-gray-600` : isBefore ? 'bg-gray-200' : 'bg-gray-100'
              }`} />
              <span className={`text-[10px] leading-none font-semibold ${isActive ? EFFORT_TEXT[m] : 'text-gray-300'}`}>
                {EFFORT_LABELS[m]}
              </span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}


const MORNING_DIRECTIVES: Record<string, string> = {
  good:  "You're primed — try to get 5 minutes of dynamic stretching in before you go.",
  okay:  "You're a bit flat — walk the dog easy, don't overthink it, just get out the door.",
  rough: "Your body is asking for easy today — just move, no pressure on pace or effort.",
}

function CheckCircle({ done }: { done: boolean }) {
  return (
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
      {done && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  )
}

function EveningRow({ done, label, why, note }: { done: boolean; label: string; why?: string; note?: string }) {
  return (
    <div className={`flex items-start gap-3 ${done ? 'opacity-50' : ''}`}>
      <CheckCircle done={done} />
      <div>
        <div className={`text-sm font-semibold ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{label}</div>
        {!done && why && <div className="text-xs text-gray-400 mt-0.5">{why}</div>}
        {note && <div className="text-xs text-gray-300 mt-0.5">{note}</div>}
      </div>
    </div>
  )
}

function readinessScoreColor(score: number) {
  if (score >= 7) return 'text-emerald-600'
  if (score >= 4) return 'text-amber-500'
  return 'text-red-500'
}

type Props = {
  today: string
  plan: PlannedWorkout[]
  phases: Phase[]
  races: Race[]
  health: HealthEntry[]
  log: TrainingLogEntry[]
  strava: StravaActivity[]
  library: LibraryWorkout[]
  initialCoachingNote: CoachingNote | null
  initialPostNote: CoachingNote | null
  initialCheckIn: CheckIn | null
}

export default function TodayClient({
  today, plan, phases, races, health, log, strava, library,
  initialCoachingNote, initialPostNote, initialCheckIn,
}: Props) {
  const [viewDate, setViewDate] = useState(today)
  const [note, setNote] = useState(initialCoachingNote)
  const [postNote, setPostNote] = useState(initialPostNote)
  const router = useRouter()
  const [noteLoading, setNoteLoading] = useState(false)
  const [postNoteLoading, setPostNoteLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [refreshingHealth, setRefreshingHealth] = useState(false)
  const [selected, setSelected] = useState<TrainingLogEntry | null>(null)
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [regenerating, startRegenerate] = useTransition()
  const [regenerateError, setRegenerateError] = useState(false)
  const [reasonExpanded, setReasonExpanded] = useState(false)
  const [instructionsExpanded, setInstructionsExpanded] = useState(false)
  const [readinessExpanded, setReadinessExpanded] = useState(false)
  const [workoutContextExpanded, setWorkoutContextExpanded] = useState(false)
  const [postReadinessExpanded, setPostReadinessExpanded] = useState(false)
  const [postWorkoutExpanded, setPostWorkoutExpanded] = useState(false)
  const [readinessBarExpanded, setReadinessBarExpanded] = useState(false)
  const [effortExpanded, setEffortExpanded] = useState(false)
  const [editingSleep, setEditingSleep] = useState(false)
  const [sleepInput, setSleepInput] = useState('')
  const [sleepScore, setSleepScore] = useState<number | null>(
    () => health.find(e => e.date === today)?.sleepScore ?? null
  )
  const [morningFeel, setMorningFeel] = useState<'good' | 'okay' | 'rough' | null>(null)
  const [runStartOverride, setRunStartOverride] = useState<string | null>(null)
  const [editingLeaveBy, setEditingLeaveBy] = useState(false)
  const [recoveryDismissed, setRecoveryDismissed] = useState(false)
  const [demoHour, setDemoHour] = useState<number | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(`trainer-morning-${today}`)
    if (stored === 'good' || stored === 'okay' || stored === 'rough') setMorningFeel(stored)
    const startOverride = localStorage.getItem(`trainer-run-start-${today}`)
    if (startOverride) setRunStartOverride(startOverride)
    if (localStorage.getItem(`trainer-recovery-dismissed-${today}`) === '1') setRecoveryDismissed(true)
  }, [today])

  function saveMorningFeel(feel: 'good' | 'okay' | 'rough') {
    setMorningFeel(feel)
    localStorage.setItem(`trainer-morning-${today}`, feel)
  }

  // Derive view data from viewDate
  const viewEntry = plan.find(e => e.date === viewDate) ?? null
  const viewHealth = health.find(e => e.date === viewDate) ?? null
  const recentHrvValues = health
    .filter(e => e.date <= viewDate && e.hrv)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .map(e => e.hrv!)
  const hrv7dayAvg = recentHrvValues.length
    ? Math.round(recentHrvValues.reduce((s, v) => s + v, 0) / recentHrvValues.length)
    : null
  const viewLogs = log.filter(e => e.date === viewDate)
  const viewPhase = phases.find(p => p.startDate <= viewDate && p.endDate >= viewDate) ?? phases[0] ?? null
  const viewRace = races.filter(r => r.date >= viewDate).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null

  const nextWorkout = plan.find(e => e.date >= viewDate && e.dayType !== 'Rest') ?? null
  const displayEntry = viewEntry ?? (viewDate === today ? nextWorkout : null)
  const isRestDay = viewEntry?.dayType === 'Rest'
  const tomorrowWorkout = isRestDay
    ? plan.find(e => e.date > viewDate && e.dayType !== 'Rest') ?? null
    : null

  const libraryMatch = displayEntry?.workout
    ? library.find(w => w.name.toLowerCase() === displayEntry.workout!.toLowerCase()) ?? null
    : null
  const workoutInstructions = libraryMatch?.instructions || displayEntry?.instructions || null
  const workoutReason = libraryMatch?.reason || displayEntry?.reason || null

  const planDates = plan.map(e => e.date).sort()
  const minDate = planDates[0] ?? today
  const maxDate = planDates[planDates.length - 1] ?? today

  const isViewingToday = viewDate === today
  const hasActivities = viewLogs.length > 0
  const _now = new Date()
  const effectiveHour = demoHour ?? _now.getHours()
  const effectiveMinutes = demoHour != null ? 0 : _now.getMinutes()
  // Morning demo state suppresses activities to show the genuine pre-run layout
  const DEMO_STATES = [
    { label: 'Morning',  hour: 6,  suppressActivities: true },
    { label: 'Post-run', hour: 11, suppressActivities: false },
    { label: 'Evening',  hour: 18, suppressActivities: false },
    { label: 'Night',    hour: 21, suppressActivities: false },
  ] as const
  const activeDemoState = DEMO_STATES.find(s => s.hour === demoHour) ?? null
  const effectiveHasActivities = activeDemoState?.suppressActivities ? false : hasActivities
  const { isMorningWindow, isEveningMode, isPostRun, isAfternoon, showSyncPrompt, isNightMode } = computeTodayFlags({
    isViewingToday, hasActivities: effectiveHasActivities, isRestDay, today,
    currentHour: effectiveHour,
    currentMinutes: effectiveMinutes,
  })
  const defaultRunStart = RUN_START_TIMES[new Date(today + 'T00:00:00').getDay()] ?? null
  const leaveBy = isViewingToday && !isRestDay ? getLeaveByTime(today) : null
  const effectiveLeaveBy = runStartOverride ? computeLeaveByFromStart(runStartOverride) : leaveBy

  // Weekly activity tracking for evening stack
  const weekStartDate = (() => {
    const d = new Date(today + 'T00:00:00')
    const dow = d.getDay()
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
    return d.toISOString().slice(0, 10)
  })()
  const weekLogs = log.filter(e => e.date >= weekStartDate && e.date <= today)
  const weekStrength = weekLogs.filter(e => /weight|strength|lift|gym/i.test(e.activityType)).length
  const weekYoga    = weekLogs.filter(e => /yoga/i.test(e.activityType)).length
  const weekClimbing = weekLogs.filter(e => /climb|boulder/i.test(e.activityType)).length
  const todayYoga     = viewLogs.some(e => /yoga/i.test(e.activityType))
  const todayStrength = viewLogs.some(e => /weight|strength|lift|gym/i.test(e.activityType))
  const todayClimbing = viewLogs.some(e => /climb|boulder/i.test(e.activityType))
  const isHardDay = note?.effortMode === 'hard' || note?.effortMode === 'race' ||
    displayEntry?.runType === 'Quality' || displayEntry?.dayType === 'Race'
  const runLog = viewLogs.find(e => /run/i.test(e.activityType)) ?? viewLogs[0] ?? null
  const distanceDelta = runLog?.distance != null && displayEntry?.distance != null
    ? runLog.distance - displayEntry.distance : null
  const nextDayDate = (() => {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })()
  const nextDayPlan = plan.find(e => e.date === nextDayDate) ?? null
  const nextDayLeaveBy = nextDayPlan && nextDayPlan.dayType !== 'Rest' ? getLeaveByTime(nextDayDate) : null

  async function handleRefreshHealth() {
    setRefreshingHealth(true)
    await refreshHealthData()
    router.refresh()
    setRefreshingHealth(false)
  }

  async function navigateDate(newDate: string) {
    if (newDate < minDate || newDate > maxDate) return
    setViewDate(newDate)
    setReasonExpanded(false)
    setInstructionsExpanded(false)
    setReadinessExpanded(false)
    setWorkoutContextExpanded(false)
    setPostReadinessExpanded(false)
    setPostWorkoutExpanded(false)
    setReadinessBarExpanded(false)
    setEffortExpanded(false)
    setEditingSleep(false)
    setSleepScore(health.find(e => e.date === newDate)?.sleepScore ?? null)
    if (newDate === today) {
      setNote(initialCoachingNote)
      setPostNote(initialPostNote)
      return
    }
    setNote(null)
    setPostNote(null)
    setNoteLoading(true)
    const fetched = await fetchCoachingNoteForDate(newDate)
    setNote(fetched)
    setNoteLoading(false)
  }

  function handleRegenerate() {
    setRegenerateError(false)
    startRegenerate(async () => {
      const fresh = await regenerateCoachingNote(viewDate)
      if (fresh) setNote(fresh)
      else setRegenerateError(true)
    })
  }

  async function handleGeneratePostNote() {
    setPostNoteLoading(true)
    const fresh = await fetchPostWorkoutNoteForDate(viewDate)
    setPostNote(fresh)
    setPostNoteLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const result = await syncStrava()
      setSyncMsg(result.added > 0
        ? `Synced ${result.added} activit${result.added === 1 ? 'y' : 'ies'}`
        : 'Already up to date'
      )
      // Refresh post note if activities were added for today
      if (result.added > 0 && isViewingToday) {
        const fresh = await fetchPostWorkoutNoteForDate(today)
        setPostNote(fresh)
      }
    } catch {
      setSyncMsg('Sync failed — check credentials')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="px-4 pt-10 pb-4">

      {/* Date navigation header */}
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate(addDays(viewDate, -1))}
            disabled={viewDate <= minDate}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-gray-900">{formatDateHeader(viewDate, today)}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{formatDateSub(viewDate)}</p>
          </div>
          <button
            onClick={() => navigateDate(addDays(viewDate, 1))}
            disabled={viewDate >= maxDate}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        {!isViewingToday && (
          <button
            onClick={() => navigateDate(today)}
            className="mt-1 w-full text-xs text-blue-500 hover:text-blue-700 text-center"
          >
            Back to today
          </button>
        )}
      </header>

      {/* Demo scrubber — time-of-day override for showing the app to people */}
      {(() => {
        return (
          <div className="mb-4">
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-colors ${demoHour != null ? 'bg-violet-50 border-violet-200' : 'bg-gray-50 border-gray-100'}`}>
              <span className={`text-[10px] font-bold tracking-widest uppercase mr-1 shrink-0 ${demoHour != null ? 'text-violet-500' : 'text-gray-300'}`}>
                Demo
              </span>
              {DEMO_STATES.map(({ label, hour }) => {
                const active = demoHour === hour
                return (
                  <button
                    key={label}
                    onClick={() => setDemoHour(active ? null : hour)}
                    className={`flex-1 text-xs font-semibold py-1 rounded-lg transition-colors ${
                      active
                        ? 'bg-violet-600 text-white'
                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {viewRace && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{viewRace.name}</span>
          <span className="ml-auto text-sm font-bold text-blue-600">{daysUntil(viewRace.date)} days</span>
        </div>
      )}

      {/* Morning directive — shown after check-in completes (#9) */}
      {isMorningWindow && morningFeel && (
        <div className="mb-4 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <p className="text-sm text-blue-900 font-medium leading-snug">
            {MORNING_DIRECTIVES[morningFeel]}
          </p>
          <button
            onClick={() => { setMorningFeel(null); localStorage.removeItem(`trainer-morning-${today}`) }}
            className="mt-1.5 text-xs text-blue-400 hover:text-blue-600"
          >
            Change
          </button>
        </div>
      )}

      {/* Morning check-in card — shown before first tap (#8) */}
      {isMorningWindow && !morningFeel && (
        <div className="mb-4 bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <p className="text-xs font-bold text-gray-400 tracking-wide mb-3">HOW&apos;S THIS MORNING?</p>
          <div className="grid grid-cols-3 gap-2">
            {(['good', 'okay', 'rough'] as const).map(feel => (
              <button
                key={feel}
                onClick={() => saveMorningFeel(feel)}
                className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  feel === 'good'  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 active:bg-emerald-100' :
                  feel === 'okay'  ? 'bg-amber-50 border-amber-200 text-amber-700 active:bg-amber-100' :
                                     'bg-red-50 border-red-200 text-red-700 active:bg-red-100'
                }`}
              >
                {feel === 'good' ? 'Feeling good' : feel === 'okay' ? 'A bit stiff' : 'Rough day'}
              </button>
            ))}
          </div>
        </div>
      )}

      {(viewHealth || isViewingToday) && note?.readinessScore == null && !isPostRun && (
        <div className="mb-4">
          {/* #6 — when watch data hasn't synced yet, explain why tiles are blank */}
          {!viewHealth && isViewingToday && (
            <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400">
              <span className="flex-1">Watch data not yet synced — HRV and RHR pending</span>
              <button
                onClick={handleRefreshHealth}
                disabled={refreshingHealth}
                className="text-blue-500 hover:text-blue-700 disabled:opacity-40 flex items-center gap-1 shrink-0 font-medium"
              >
                <RefreshCw size={10} className={refreshingHealth ? 'animate-spin' : ''} />
                {refreshingHealth ? 'Checking…' : 'Refresh'}
              </button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <Zap size={16} className={`mx-auto mb-1 ${hrvColor(viewHealth?.hrv ?? null)}`} />
              <div className={`text-xl font-bold ${hrvColor(viewHealth?.hrv ?? null)}`}>
                {viewHealth?.hrv != null ? Math.round(viewHealth.hrv) : '—'}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">HRV ms</div>
              {hrv7dayAvg && (
                <div className="text-xs text-gray-300 mt-0.5">{hrv7dayAvg} avg</div>
              )}
            </div>
            <button
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center w-full"
              onClick={() => { setSleepInput(String(sleepScore ?? '')); setEditingSleep(true) }}
            >
              <Moon size={16} className="mx-auto mb-1 text-indigo-400" />
              {editingSleep ? (
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={sleepInput}
                  autoFocus
                  className="text-xl font-bold text-gray-900 w-full text-center bg-transparent outline-none"
                  onClick={e => e.stopPropagation()}
                  onChange={e => setSleepInput(e.target.value)}
                  onBlur={async () => {
                    setEditingSleep(false)
                    const val = parseInt(sleepInput)
                    if (!isNaN(val) && val >= 0 && val <= 1000) {
                      setSleepScore(val)
                      await saveSleepScore(viewDate, val)
                    }
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                />
              ) : (
                <div className="text-xl font-bold text-gray-900">{sleepScore ?? '—'}</div>
              )}
              <div className="text-xs text-gray-400 mt-0.5">Sleep {sleepScore == null ? '· tap to add' : '/1000'}</div>
            </button>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
              <Heart size={16} className="mx-auto mb-1 text-red-400" />
              <div className="text-xl font-bold text-gray-900">{viewHealth?.restingHr ?? '—'}</div>
              <div className="text-xs text-gray-400 mt-0.5">RHR bpm</div>
            </div>
          </div>
          {isViewingToday && viewHealth && (
            <button
              onClick={handleRefreshHealth}
              disabled={refreshingHealth}
              className="mt-1.5 w-full text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 flex items-center justify-center gap-1"
            >
              <RefreshCw size={11} className={refreshingHealth ? 'animate-spin' : ''} />
              {refreshingHealth ? 'Refreshing…' : 'Refresh health data'}
            </button>
          )}
        </div>
      )}

      {/* Readiness + Effort card — shown when The Signal has a score */}
      {note?.readinessScore != null && !isPostRun && (
        <div className="mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Readiness bar */}
          <button
            onClick={() => setReadinessBarExpanded(v => !v)}
            className="w-full p-4 text-left touch-manipulation"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-400 tracking-wide uppercase">Readiness</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${readinessScoreColor(note.readinessScore)}`}>
                  {note.readinessScore}/10
                </span>
                {displayEntry && displayEntry.date === viewDate && (
                  <button
                    onClick={e => { e.stopPropagation(); handleRegenerate() }}
                    disabled={regenerating || noteLoading}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-40 touch-manipulation"
                  >
                    <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} />
                  </button>
                )}
                {readinessBarExpanded
                  ? <ChevronUp size={14} className="text-gray-300" />
                  : <ChevronDown size={14} className="text-gray-300" />
                }
              </div>
            </div>
            <div className="relative h-2 rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-emerald-500 mb-2.5">
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white border-2 border-gray-700 rounded-full shadow"
                style={{ left: `${Math.round(((note.readinessScore - 1) / 9) * 100)}%` }}
              />
            </div>
          </button>
          {readinessBarExpanded && (
            <div className="border-t border-gray-50 pt-3 pb-4 px-4">
              {note.readinessSummary && (
                <p className="text-xs text-gray-500 leading-snug mb-3">{note.readinessSummary}</p>
              )}
              {/* HRV/Sleep/RHR tiles folded in here */}
              {(viewHealth || isViewingToday) && (
                <div className="mb-3">
                  <div className="grid grid-cols-3 gap-2 mb-1.5">
                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-center">
                      <Zap size={14} className={`mx-auto mb-1 ${hrvColor(viewHealth?.hrv ?? null)}`} />
                      <div className={`text-lg font-bold ${hrvColor(viewHealth?.hrv ?? null)}`}>
                        {viewHealth?.hrv != null ? Math.round(viewHealth.hrv) : '—'}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">HRV ms</div>
                      {hrv7dayAvg && <div className="text-xs text-gray-300 mt-0.5">{hrv7dayAvg} avg</div>}
                    </div>
                    <button
                      className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-center w-full"
                      onClick={() => { setSleepInput(String(sleepScore ?? '')); setEditingSleep(true) }}
                    >
                      <Moon size={14} className="mx-auto mb-1 text-indigo-400" />
                      {editingSleep ? (
                        <input type="number" min={0} max={1000} value={sleepInput} autoFocus
                          className="text-lg font-bold text-gray-900 w-full text-center bg-transparent outline-none"
                          onClick={e => e.stopPropagation()}
                          onChange={e => setSleepInput(e.target.value)}
                          onBlur={async () => {
                            setEditingSleep(false)
                            const val = parseInt(sleepInput)
                            if (!isNaN(val) && val >= 0 && val <= 1000) { setSleepScore(val); await saveSleepScore(viewDate, val) }
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        />
                      ) : (
                        <div className="text-lg font-bold text-gray-900">{sleepScore ?? '—'}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">Sleep {sleepScore == null ? '· tap' : '/1000'}</div>
                    </button>
                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-center">
                      <Heart size={14} className="mx-auto mb-1 text-red-400" />
                      <div className="text-lg font-bold text-gray-900">{viewHealth?.restingHr ?? '—'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">RHR bpm</div>
                    </div>
                  </div>
                  {isViewingToday && (
                    <button onClick={handleRefreshHealth} disabled={refreshingHealth}
                      className="w-full text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 flex items-center justify-center gap-1">
                      <RefreshCw size={11} className={refreshingHealth ? 'animate-spin' : ''} />
                      {refreshingHealth ? 'Refreshing…' : 'Refresh health data'}
                    </button>
                  )}
                </div>
              )}
              <div className="prose prose-sm prose-slate max-w-none">
                <ReactMarkdown>
                  {note.coachingTake.match(/## Readiness([\s\S]*?)(?=## |$)/)?.[1]?.trim() ?? note.readinessSummary ?? ''}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Effort guidance */}
          {note.effortMode && (
            <>
              <div className="h-px bg-gray-100 mx-4" />
              <button
                onClick={() => setEffortExpanded(v => !v)}
                className="w-full p-4 text-left touch-manipulation"
              >
                <div className="text-xs font-bold text-gray-400 tracking-wide uppercase mb-3">Today&apos;s Effort</div>
                <EffortScale mode={note.effortMode} />
                {note.effortLabel && (
                  <div className="mt-2.5 text-sm font-semibold text-gray-800">{note.effortLabel}</div>
                )}
                {note.effortReason && (
                  <div className="text-xs text-gray-400 mt-0.5">{note.effortReason}</div>
                )}
              </button>
              {effortExpanded && (
                <div className="px-4 pb-4 prose prose-sm prose-slate max-w-none border-t border-gray-50 pt-3">
                  <ReactMarkdown>
                    {note.coachingTake.match(/## Today's Workout in Context([\s\S]*?)(?=## |$)/)?.[1]?.trim() ?? note.workoutSummary ?? ''}
                  </ReactMarkdown>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Evening recovery stack (#13) — shown before run summary so it's first thing seen post-run */}
      {isEveningMode && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-400 tracking-wide">TONIGHT</span>
              {isHardDay && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                  Hard day
                </span>
              )}
            </div>
            <div className="space-y-2.5">
              {isHardDay && (
                <EveningRow
                  done={todayStrength}
                  label="Leg workout"
                  why="Compound today's training into the same recovery window"
                  note={`${weekStrength}/2 this week`}
                />
              )}
              <EveningRow
                done={todayYoga}
                label="Yoga"
                why={isHardDay ? 'Flush the legs, CNS recovery' : isRestDay ? 'Full recovery focus' : 'Recovery priority on easy days'}
                note={`${weekYoga} this week`}
              />
              <EveningRow done={false} label="Core" why="Daily habit" />
              <EveningRow
                done={todayClimbing || (!isHardDay && todayStrength)}
                label="Upper body / Bouldering"
                why="Once a week — bouldering counts"
                note={`${weekClimbing}/1 this week`}
              />
              {!isHardDay && (
                <EveningRow
                  done={false}
                  label="Balance work"
                  why="Single-leg stability — running happens on one leg"
                />
              )}
            </div>
            {!todayYoga && (
              <p className="mt-3 pt-3 border-t border-gray-50 text-xs text-gray-400 leading-snug">
                Not feeling 30 min? Balance board or 10 min stretching counts. Theragun + Normatec if you&apos;re spent.
              </p>
            )}
          </div>
          <div className="border-t border-gray-100 px-5 py-2.5 flex gap-4 text-xs text-gray-400">
            <span>Strength <span className="font-semibold text-gray-600">{weekStrength}/2</span></span>
            <span>Yoga <span className="font-semibold text-gray-600">{weekYoga}</span></span>
            {weekClimbing > 0 && <span>Climbing <span className="font-semibold text-gray-600">{weekClimbing}</span></span>}
          </div>
        </div>
      )}

      {isRestDay ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          <div className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-gray-400 tracking-wide mb-1">
                  {isViewingToday ? 'TODAY' : 'THIS DAY'} · REST
                </div>
                <div className="text-xl font-bold text-gray-900">Recovery Day</div>
                {viewPhase && (
                  <div className="text-sm text-gray-500 mt-0.5">{viewPhase.name}</div>
                )}
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 shrink-0">Rest</span>
            </div>
            {note?.verdict && (
              <p className="text-sm text-gray-600 mt-3 leading-relaxed">{note.verdict}</p>
            )}
          </div>
          {tomorrowWorkout && (
            <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
              <div className="text-xs font-bold text-gray-400 tracking-wide mb-1.5">TOMORROW</div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    {tomorrowWorkout.workout ?? tomorrowWorkout.runType ?? tomorrowWorkout.dayType}
                  </div>
                  {(tomorrowWorkout.distance || tomorrowWorkout.targetPace || tomorrowWorkout.hrZone) && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {[
                        tomorrowWorkout.distance && `${tomorrowWorkout.distance} mi`,
                        tomorrowWorkout.targetPace && `${tomorrowWorkout.targetPace} /mi`,
                        tomorrowWorkout.hrZone && `Z${tomorrowWorkout.hrZone}`,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600 shrink-0 whitespace-nowrap">
                  {tomorrowWorkout.runType ?? tomorrowWorkout.dayType}
                </span>
              </div>
            </div>
          )}
        </div>
      ) : displayEntry ? (
        isPostRun ? (
          <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${runTypeBorderColor(displayEntry)} shadow-sm overflow-hidden mb-4`}>
            <div className="p-5">
              <div className="text-xs font-bold text-gray-400 tracking-wide mb-1">DONE</div>
              <div className="text-xl font-bold text-gray-900 mb-3">
                {displayEntry.workout ?? displayEntry.runType ?? displayEntry.dayType}
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-semibold text-gray-400 w-14 shrink-0 pt-0.5">Planned</span>
                  <span className="text-sm text-gray-500">
                    {[
                      displayEntry.distance && `${displayEntry.distance} mi`,
                      displayEntry.targetPace && `${displayEntry.targetPace} /mi`,
                      displayEntry.hrZone && `Z${displayEntry.hrZone}`,
                      viewPhase?.name,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </div>
                {runLog && (
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-semibold text-gray-400 w-14 shrink-0 pt-0.5">Actual</span>
                    <div className="text-sm font-semibold text-gray-900">
                      {[
                        runLog.distance && `${runLog.distance} mi`,
                        runLog.pace && `${runLog.pace} /mi`,
                        runLog.duration && `${runLog.duration} min`,
                        runLog.avgHr && `${runLog.avgHr} bpm`,
                      ].filter(Boolean).join(' · ')}
                      {distanceDelta != null && Math.abs(distanceDelta) > 0.5 && (
                        <span className={`ml-2 text-xs font-normal ${distanceDelta > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          ({distanceDelta > 0 ? '+' : ''}{distanceDelta.toFixed(1)} mi)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Signal — embedded at bottom, hidden until tapped */}
            <div className="border-t border-gray-100">
              <button
                onClick={() => setPostWorkoutExpanded(v => !v)}
                className="w-full px-5 py-3 flex items-center justify-between text-left bg-gray-50 touch-manipulation"
              >
                <div className="flex items-center gap-2">
                  <Radio size={13} className="text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700 tracking-wide">The Signal</span>
                  <span className="text-xs text-emerald-500">Asst. Coach</span>
                </div>
                <div className="flex items-center gap-2">
                  <span onClick={e => { e.stopPropagation(); handleGeneratePostNote() }}>
                    <RefreshCw size={12} className={`text-emerald-400 hover:text-emerald-600 ${postNoteLoading ? 'animate-spin' : ''}`} />
                  </span>
                  {postWorkoutExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </div>
              </button>
              {postWorkoutExpanded && (
                <div className="px-5 pb-5 pt-3 bg-emerald-50">
                  {postNoteLoading ? (
                    <p className="text-sm text-gray-400 italic">Generating...</p>
                  ) : postNote ? (
                    <>
                      {postNote.verdict && (
                        <p className="text-sm text-emerald-900 leading-snug mb-3">{postNote.verdict.replace(/\*+/g, '')}</p>
                      )}
                      <div className="prose prose-sm prose-slate max-w-none">
                        <ReactMarkdown>{postNote.coachingTake}</ReactMarkdown>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Tap ↻ to generate analysis.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${runTypeBorderColor(displayEntry)} shadow-sm overflow-hidden mb-4`}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-xs font-bold text-gray-400 tracking-wide mb-1">
                    {displayEntry.date === viewDate
                      ? (isViewingToday ? 'TODAY' : 'THIS DAY')
                      : `NEXT UP · ${new Date(displayEntry.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
                  </div>
                  <div className="text-xl font-bold text-gray-900">
                    {displayEntry.workout ?? displayEntry.runType ?? displayEntry.dayType}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {effectiveLeaveBy && displayEntry.date === viewDate && (
                    editingLeaveBy ? (
                      <input
                        type="time"
                        defaultValue={runStartOverride ?? defaultRunStart ?? '06:30'}
                        autoFocus
                        className="text-xs border border-amber-200 rounded-lg px-2 py-1 bg-amber-50 text-amber-700 w-24"
                        onBlur={e => {
                          const val = e.target.value
                          if (val) {
                            setRunStartOverride(val)
                            localStorage.setItem(`trainer-run-start-${today}`, val)
                          }
                          setEditingLeaveBy(false)
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingLeaveBy(true)}
                        className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg"
                      >
                        <Clock size={11} />
                        Leave by {effectiveLeaveBy}
                      </button>
                    )
                  )}
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">
                    {displayEntry.runType ?? displayEntry.dayType}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
                {displayEntry.distance && <span className="font-semibold text-gray-700">{displayEntry.distance} mi</span>}
                {displayEntry.hrZone && <span>Zone {displayEntry.hrZone}</span>}
                {displayEntry.targetPace && <span>{displayEntry.targetPace} /mi</span>}
                {viewPhase && <span>{viewPhase.name}</span>}
              </div>
              {workoutInstructions && (() => {
                const firstLine = workoutInstructions.split(/\n|\.(?:\s|$)/)[0].trim()
                const hasMore = workoutInstructions.length > firstLine.length + 1
                return (
                  <div className="mb-3">
                    <div className="text-sm text-gray-800 leading-relaxed font-mono">
                      {instructionsExpanded ? workoutInstructions : firstLine}
                    </div>
                    {hasMore && (
                      <button
                        onClick={() => setInstructionsExpanded(v => !v)}
                        className="mt-1 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                      >
                        {instructionsExpanded ? <><ChevronUp size={12} /> Less</> : <><ChevronDown size={12} /> Full workout</>}
                      </button>
                    )}
                  </div>
                )
              })()}
              {workoutReason && (
                <button
                  onClick={() => setReasonExpanded(v => !v)}
                  className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3"
                >
                  <span>Why this workout</span>
                  <span>{reasonExpanded ? '▴' : '▾'}</span>
                </button>
              )}
              {workoutReason && reasonExpanded && (
                <div className="text-sm text-gray-500 leading-relaxed mb-3 pl-2 border-l-2 border-gray-100">
                  {workoutReason}
                </div>
              )}
            </div>
            {showSyncPrompt && (
              <div className="border-t border-amber-100 bg-amber-50 px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-amber-700">After 1pm — did you run this morning?</span>
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-900 disabled:opacity-40"
                  >
                    <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Syncing…' : 'Sync Strava'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="text-sm text-gray-400 italic">No workout scheduled.</div>
        </div>
      )}

      {displayEntry && displayEntry.notes && displayEntry.date === viewDate && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Smile size={14} className="text-indigo-400" />
            <div className="text-xs font-bold text-indigo-500 tracking-wide">Coach FouLox</div>
          </div>
          <p className="text-sm text-indigo-900 leading-relaxed">{displayEntry.notes}</p>
        </div>
      )}

      {/* Pre-workout coaching card — hidden when visual readiness card is active or post-run */}
      {note?.readinessScore == null && !isPostRun && <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Radio size={14} className="text-slate-500" />
          <div className="text-xs font-bold text-slate-600 tracking-wide">The Signal</div>
          <div className="text-xs text-slate-400">Asst. Coach</div>
          {displayEntry && displayEntry.dayType !== 'Rest' && displayEntry.date === viewDate && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating || noteLoading}
              className="ml-auto text-slate-400 hover:text-slate-600 disabled:opacity-40"
            >
              <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        {regenerateError && (
          <p className="text-xs text-red-400 mb-2">Couldn&apos;t regenerate — try again</p>
        )}
        {regenerating || noteLoading ? (
          <p className="text-sm text-gray-400 italic">Generating...</p>
        ) : note ? (
          <div className="space-y-3">
            {/* Readiness section */}
            <div className="border-t border-slate-200 pt-2">
              <button
                onClick={() => setReadinessExpanded(v => !v)}
                className="w-full flex items-center justify-between text-left gap-2"
              >
                <div className="flex items-center gap-2">
                  <Activity size={12} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Readiness</span>
                </div>
                {readinessExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
              </button>
              {note.readinessSummary && (
                <p className="text-xs text-slate-600 mt-1 leading-snug">{note.readinessSummary}</p>
              )}
              {readinessExpanded && (
                <div className="mt-2 prose prose-sm prose-slate max-w-none">
                  <ReactMarkdown>
                    {note.coachingTake.match(/## Readiness([\s\S]*?)(?=## |$)/)?.[1]?.trim() ?? ''}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Today's Workout section */}
            <div className="border-t border-slate-200 pt-2">
              <button
                onClick={() => setWorkoutContextExpanded(v => !v)}
                className="w-full flex items-center justify-between text-left gap-2"
              >
                <div className="flex items-center gap-2">
                  <Zap size={12} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Today's Workout</span>
                </div>
                {workoutContextExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
              </button>
              {note.workoutSummary && (
                <p className="text-xs text-slate-600 mt-1 leading-snug">{note.workoutSummary}</p>
              )}
              {workoutContextExpanded && (
                <div className="mt-2 prose prose-sm prose-slate max-w-none">
                  <ReactMarkdown>
                    {note.coachingTake.match(/## Today's Workout in Context([\s\S]*?)(?=## |$)/)?.[1]?.trim() ?? ''}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {displayEntry && displayEntry.date === viewDate
              ? 'Tap ↻ to generate analysis.'
              : 'No workout planned — no analysis needed.'}
          </p>
        )}
      </div>}

      {/* Immediate post-run recovery prompt (#12) — morning only */}
      {isPostRun && !recoveryDismissed && !isAfternoon && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-emerald-700 tracking-wide">RIGHT NOW</span>
            <button
              onClick={() => {
                setRecoveryDismissed(true)
                localStorage.setItem(`trainer-recovery-dismissed-${today}`, '1')
              }}
              className="text-xs text-emerald-500 hover:text-emerald-700 font-medium"
            >
              Done ✓
            </button>
          </div>
          <ul className="space-y-1.5">
            {isHardDay ? (
              <>
                <li className="flex items-start gap-2 text-sm text-emerald-900"><span className="shrink-0 mt-0.5">•</span><span><strong>Eat within 20 min</strong> — carbs + protein, don&apos;t skip this window</span></li>
                <li className="flex items-start gap-2 text-sm text-emerald-900"><span className="shrink-0 mt-0.5">•</span><span>Hydrate — electrolytes if you were sweating hard</span></li>
                <li className="flex items-start gap-2 text-sm text-emerald-900"><span className="shrink-0 mt-0.5">•</span><span>Elevate legs for 10 min</span></li>
                <li className="flex items-start gap-2 text-sm text-emerald-900"><span className="shrink-0 mt-0.5">•</span><span>Foam roll quads, calves, IT band</span></li>
                <li className="flex items-start gap-2 text-sm text-emerald-900"><span className="shrink-0 mt-0.5">•</span><span>Ice anything that felt off during the effort</span></li>
              </>
            ) : (
              <>
                <li className="flex items-start gap-2 text-sm text-emerald-900"><span className="shrink-0 mt-0.5">•</span><span><strong>Eat within 30 min</strong> — real food, not just coffee</span></li>
                <li className="flex items-start gap-2 text-sm text-emerald-900"><span className="shrink-0 mt-0.5">•</span><span>Hydrate</span></li>
                <li className="flex items-start gap-2 text-sm text-emerald-900"><span className="shrink-0 mt-0.5">•</span><span>5-10 min light stretch or slow walk to cool down</span></li>
              </>
            )}
          </ul>
        </div>
      )}

      {/* Post-workout coaching card — for past days only; today uses Signal inside DONE card */}
      {hasActivities && !isPostRun && displayEntry && displayEntry.date === viewDate && displayEntry.dayType !== 'Rest' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Radio size={14} className="text-emerald-600" />
            <div className="text-xs font-bold text-emerald-700 tracking-wide">The Signal</div>
            <div className="text-xs text-emerald-500">Asst. Coach</div>
            <button
              onClick={handleGeneratePostNote}
              disabled={postNoteLoading}
              className="ml-auto text-emerald-500 hover:text-emerald-700 disabled:opacity-40"
            >
              <RefreshCw size={13} className={postNoteLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          {postNoteLoading ? (
            <p className="text-sm text-gray-400 italic">Generating...</p>
          ) : postNote ? (
            <>
              {postNote.verdict && (
                <p className="text-sm font-semibold text-emerald-900 leading-snug mb-2">{postNote.verdict}</p>
              )}
              <button
                onClick={() => setPostWorkoutExpanded(v => !v)}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800"
              >
                {postWorkoutExpanded
                  ? <><ChevronUp size={12} /> Hide analysis</>
                  : <><ChevronDown size={12} /> Read full analysis</>}
              </button>
              {postWorkoutExpanded && (
                <div className="mt-3 pt-3 border-t border-emerald-200 prose prose-sm prose-slate max-w-none">
                  <ReactMarkdown>{postNote.coachingTake}</ReactMarkdown>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">Tap ↻ to generate post-workout analysis.</p>
          )}
        </div>
      )}


      {/* Night-before prep (#14) */}
      {isNightMode && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          <div className="px-5 pt-4 pb-3">
            <div className="text-xs font-bold text-gray-400 tracking-wide mb-3">TOMORROW</div>
            {!nextDayPlan || nextDayPlan.dayType === 'Rest' ? (
              <p className="text-sm text-gray-600">Rest day — sleep in, no alarm pressure.</p>
            ) : (
              <>
                <div className="text-lg font-bold text-gray-900 mb-1">
                  {nextDayPlan.workout ?? nextDayPlan.runType ?? nextDayPlan.dayType}
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                  {nextDayPlan.distance && <span className="font-semibold text-gray-700">{nextDayPlan.distance} mi</span>}
                  {nextDayPlan.hrZone && <span>Zone {nextDayPlan.hrZone}</span>}
                  {nextDayPlan.targetPace && <span>{nextDayPlan.targetPace} /mi</span>}
                  {nextDayPlan.runType && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{nextDayPlan.runType}</span>
                  )}
                </div>
              </>
            )}
          </div>
          {nextDayPlan && nextDayPlan.dayType !== 'Rest' && (
            <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
              <div className="text-xs font-bold text-gray-400 tracking-wide mb-2.5">BEFORE SLEEP</div>
              <div className="space-y-2 text-sm text-gray-600">
                {[
                  'Shoes + kit laid out',
                  'Watch on charger',
                  nextDayLeaveBy ? `Alarm set — leave by ${nextDayLeaveBy}` : 'Alarm set',
                  'Water bottle filled',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded border border-gray-300 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {viewLogs.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-bold text-gray-400 tracking-wide mb-2">LOGGED</div>
          <div className="flex flex-col gap-2">
            {viewLogs.map((l, i) => {
              const act = l.stravaId ? strava.find(a => a.activityId === l.stravaId) : null
              const name = act?.name ?? l.activityType
              return (
                <button
                  key={i}
                  onClick={() => setSelected(l)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left w-full"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-gray-900 text-sm">{name}</div>
                    <div className="text-xs text-gray-400">{l.activityType}</div>
                  </div>
                  <div className="flex gap-3 text-sm text-gray-500">
                    {l.distance && <span className="font-semibold text-gray-700">{l.distance} mi</span>}
                    {l.duration && <span>{l.duration} min</span>}
                    {l.pace && <span>{l.pace} /mi</span>}
                    {l.avgHr && <span>{l.avgHr} bpm</span>}
                  </div>
                  <ZoneBar logs={[l]} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {/* Check-in button — today only */}
        {isViewingToday && (
          <button
            onClick={() => setShowCheckIn(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <MessageCircle size={13} />
            Check In
          </button>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {syncMsg && <span className="text-xs text-gray-400">{syncMsg}</span>}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Strava'}
          </button>
        </div>
      </div>

      {selected && (
        <ActivityDrawer
          log={selected}
          stravaActivities={strava}
          onClose={() => setSelected(null)}
        />
      )}

      {showCheckIn && (
        <CheckInDrawer
          date={viewDate}
          workout={displayEntry}
          health={viewHealth}
          phase={viewPhase}
          race={viewRace}
          initialCheckIn={initialCheckIn}
          onClose={() => setShowCheckIn(false)}
        />
      )}
    </div>
  )
}

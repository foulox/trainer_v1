'use client'

import { useState, useTransition } from 'react'
import type { PlannedWorkout, Phase, Race, HealthEntry, TrainingLogEntry, CoachingNote, StravaActivity, CheckIn } from '@/lib/data'
import { Brain, Zap, Moon, Heart, RefreshCw, ChevronLeft, ChevronRight, MessageCircle, ChevronDown, ChevronUp, Activity } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { syncStrava, regenerateCoachingNote, fetchCoachingNoteForDate, saveSleepScore, fetchPostWorkoutNoteForDate, refreshHealthData } from '@/app/actions'
import ActivityDrawer from './ActivityDrawer'
import CheckInDrawer from './CheckInDrawer'
import ReactMarkdown from 'react-markdown'

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

type Props = {
  today: string
  plan: PlannedWorkout[]
  phases: Phase[]
  races: Race[]
  health: HealthEntry[]
  log: TrainingLogEntry[]
  strava: StravaActivity[]
  initialCoachingNote: CoachingNote | null
  initialPostNote: CoachingNote | null
  initialCheckIn: CheckIn | null
}

export default function TodayClient({
  today, plan, phases, races, health, log, strava,
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
  const [reasonExpanded, setReasonExpanded] = useState(false)
  const [instructionsExpanded, setInstructionsExpanded] = useState(false)
  const [readinessExpanded, setReadinessExpanded] = useState(false)
  const [workoutContextExpanded, setWorkoutContextExpanded] = useState(false)
  const [postReadinessExpanded, setPostReadinessExpanded] = useState(false)
  const [postWorkoutExpanded, setPostWorkoutExpanded] = useState(false)
  const [editingSleep, setEditingSleep] = useState(false)
  const [sleepInput, setSleepInput] = useState('')
  const [sleepScore, setSleepScore] = useState<number | null>(
    () => health.find(e => e.date === today)?.sleepScore ?? null
  )

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

  const planDates = plan.map(e => e.date).sort()
  const minDate = planDates[0] ?? today
  const maxDate = planDates[planDates.length - 1] ?? today

  const isViewingToday = viewDate === today
  const hasActivities = viewLogs.length > 0

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
    startRegenerate(async () => {
      const fresh = await regenerateCoachingNote(viewDate)
      if (fresh) setNote(fresh)
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

      {viewRace && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{viewRace.name}</span>
          <span className="ml-auto text-sm font-bold text-blue-600">{daysUntil(viewRace.date)} days</span>
        </div>
      )}

      {(viewHealth || isViewingToday) && (
        <div className="mb-4">
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
          {isViewingToday && (
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

      {isRestDay ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="text-xs font-bold text-gray-400 tracking-wide mb-1">
            {isViewingToday ? 'TODAY' : 'THIS DAY'}
          </div>
          <div className="text-xl font-bold text-gray-900">Rest Day</div>
          {viewPhase && (
            <div className="text-sm text-gray-500 mt-1">{viewPhase.name} · {viewPhase.goal}</div>
          )}
        </div>
      ) : displayEntry ? (
        <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${runTypeBorderColor(displayEntry)} shadow-sm p-5 mb-4`}>
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
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 shrink-0 whitespace-nowrap">
              {displayEntry.runType ?? displayEntry.dayType}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
            {displayEntry.distance && <span className="font-semibold text-gray-700">{displayEntry.distance} mi</span>}
            {displayEntry.hrZone && <span>Zone {displayEntry.hrZone}</span>}
            {displayEntry.targetPace && <span>{displayEntry.targetPace} /mi</span>}
            {viewPhase && <span>{viewPhase.name}</span>}
          </div>
          {displayEntry.instructions && (() => {
            const firstLine = displayEntry.instructions!.split(/\n|\.(?:\s|$)/)[0].trim()
            const hasMore = displayEntry.instructions!.length > firstLine.length + 1
            return (
              <div className="mb-3">
                <div className="text-sm text-gray-800 leading-relaxed font-mono">
                  {instructionsExpanded ? displayEntry.instructions : firstLine}
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
          {displayEntry.reason && (
            <button
              onClick={() => setReasonExpanded(v => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3"
            >
              <span>Why this workout</span>
              <span>{reasonExpanded ? '▴' : '▾'}</span>
            </button>
          )}
          {displayEntry.reason && reasonExpanded && (
            <div className="text-sm text-gray-500 leading-relaxed mb-3 pl-2 border-l-2 border-gray-100">
              {displayEntry.reason}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="text-sm text-gray-400 italic">No workout scheduled.</div>
        </div>
      )}

      {displayEntry && displayEntry.notes && displayEntry.date === viewDate && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs font-bold text-indigo-500 tracking-wide">HEAD COACH</div>
          </div>
          <p className="text-sm text-indigo-900 leading-relaxed">{displayEntry.notes}</p>
        </div>
      )}

      {/* Pre-workout coaching card */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain size={14} className="text-slate-500" />
          <div className="text-xs font-bold text-slate-600 tracking-wide">
            {hasActivities ? 'PRE-WORKOUT' : 'ASSISTANT COACH'}
          </div>
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

        {regenerating || noteLoading ? (
          <p className="text-sm text-gray-400 italic">Generating...</p>
        ) : note ? (
          <div className="space-y-3">
            {/* Verdict — always visible */}
            {note.verdict && (
              <p className="text-sm font-semibold text-slate-800 leading-snug">{note.verdict}</p>
            )}

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
                {note.readinessSummary && !readinessExpanded && (
                  <span className="text-xs text-slate-500 truncate max-w-[180px]">{note.readinessSummary}</span>
                )}
                {readinessExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
              </button>
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
                {note.workoutSummary && !workoutContextExpanded && (
                  <span className="text-xs text-slate-500 truncate max-w-[180px]">{note.workoutSummary}</span>
                )}
                {workoutContextExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
              </button>
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
      </div>

      {/* Post-workout coaching card — shown when activities are logged */}
      {hasActivities && displayEntry && displayEntry.date === viewDate && displayEntry.dayType !== 'Rest' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={14} className="text-emerald-600" />
            <div className="text-xs font-bold text-emerald-700 tracking-wide">POST-WORKOUT</div>
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
            <div className="space-y-3">
              {postNote.verdict && (
                <p className="text-sm font-semibold text-emerald-900 leading-snug">{postNote.verdict}</p>
              )}
              <div className="border-t border-emerald-200 pt-2">
                <button
                  onClick={() => setPostReadinessExpanded(v => !v)}
                  className="w-full flex items-center justify-between text-left gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Activity size={12} className="text-emerald-500 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">What Happened</span>
                  </div>
                  {postNote.readinessSummary && !postReadinessExpanded && (
                    <span className="text-xs text-emerald-600 truncate max-w-[180px]">{postNote.readinessSummary}</span>
                  )}
                  {postReadinessExpanded ? <ChevronUp size={14} className="text-emerald-400 shrink-0" /> : <ChevronDown size={14} className="text-emerald-400 shrink-0" />}
                </button>
                {postReadinessExpanded && (
                  <div className="mt-2 prose prose-sm prose-emerald max-w-none">
                    <ReactMarkdown>
                      {postNote.coachingTake.match(/## What Happened([\s\S]*?)(?=## |$)/)?.[1]?.trim() ?? ''}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              <div className="border-t border-emerald-200 pt-2">
                <button
                  onClick={() => setPostWorkoutExpanded(v => !v)}
                  className="w-full flex items-center justify-between text-left gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Zap size={12} className="text-emerald-500 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Recovery Outlook</span>
                  </div>
                  {postNote.workoutSummary && !postWorkoutExpanded && (
                    <span className="text-xs text-emerald-600 truncate max-w-[180px]">{postNote.workoutSummary}</span>
                  )}
                  {postWorkoutExpanded ? <ChevronUp size={14} className="text-emerald-400 shrink-0" /> : <ChevronDown size={14} className="text-emerald-400 shrink-0" />}
                </button>
                {postWorkoutExpanded && (
                  <div className="mt-2 prose prose-sm prose-emerald max-w-none">
                    <ReactMarkdown>
                      {postNote.coachingTake.match(/## Recovery Outlook([\s\S]*?)(?=## |$)/)?.[1]?.trim() ?? ''}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Tap ↻ to generate post-workout analysis.</p>
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

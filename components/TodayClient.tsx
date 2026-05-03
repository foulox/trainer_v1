'use client'

import { useState, useTransition } from 'react'
import type { PlannedWorkout, Phase, Race, HealthEntry, TrainingLogEntry, CoachingNote, StravaActivity } from '@/lib/data'
import { Brain, Zap, Moon, Heart, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { syncStrava, regenerateCoachingNote, fetchCoachingNoteForDate, saveSleepScore } from '@/app/actions'
import ActivityDrawer from './ActivityDrawer'
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
}

export default function TodayClient({
  today, plan, phases, races, health, log, strava, initialCoachingNote,
}: Props) {
  const [viewDate, setViewDate] = useState(today)
  const [note, setNote] = useState(initialCoachingNote)
  const [noteLoading, setNoteLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [selected, setSelected] = useState<TrainingLogEntry | null>(null)
  const [regenerating, startRegenerate] = useTransition()
  const [reasonExpanded, setReasonExpanded] = useState(false)
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

  // For non-today dates, show next upcoming workout if nothing planned
  const nextWorkout = plan.find(e => e.date >= viewDate && e.dayType !== 'Rest') ?? null
  const displayEntry = viewEntry ?? (viewDate === today ? nextWorkout : null)
  const isRestDay = viewEntry?.dayType === 'Rest'

  const planDates = plan.map(e => e.date).sort()
  const minDate = planDates[0] ?? today
  const maxDate = planDates[planDates.length - 1] ?? today

  async function navigateDate(newDate: string) {
    if (newDate < minDate || newDate > maxDate) return
    setViewDate(newDate)
    setReasonExpanded(false)
    setEditingSleep(false)
    setSleepScore(health.find(e => e.date === newDate)?.sleepScore ?? null)
    if (newDate === today) {
      setNote(initialCoachingNote)
      return
    }
    setNote(null)
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

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const result = await syncStrava()
      setSyncMsg(result.added > 0
        ? `Synced ${result.added} activit${result.added === 1 ? 'y' : 'ies'}`
        : 'Already up to date'
      )
    } catch {
      setSyncMsg('Sync failed — check credentials')
    } finally {
      setSyncing(false)
    }
  }

  const isViewingToday = viewDate === today

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
            {!isViewingToday && (
              <p className="text-sm text-gray-400 mt-0.5">{formatDateSub(viewDate)}</p>
            )}
            {isViewingToday && (
              <p className="text-sm text-gray-400 mt-0.5">{formatDateSub(today)}</p>
            )}
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

      {viewHealth && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <div className={`text-lg font-bold ${hrvColor(viewHealth.hrv)}`}>
              {viewHealth.hrv ?? '—'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Zap size={10} /> HRV ms
            </div>
            {hrv7dayAvg && (
              <div className="text-xs text-gray-300 mt-0.5">{hrv7dayAvg} avg</div>
            )}
          </div>
          <button
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center w-full"
            onClick={() => { setSleepInput(String(sleepScore ?? '')); setEditingSleep(true) }}
          >
            {editingSleep ? (
              <input
                type="number"
                min={0}
                max={100}
                value={sleepInput}
                autoFocus
                className="text-lg font-bold text-gray-900 w-full text-center bg-transparent outline-none"
                onClick={e => e.stopPropagation()}
                onChange={e => setSleepInput(e.target.value)}
                onBlur={async () => {
                  setEditingSleep(false)
                  const val = parseInt(sleepInput)
                  if (!isNaN(val) && val >= 0 && val <= 100) {
                    setSleepScore(val)
                    await saveSleepScore(viewDate, val)
                  }
                }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              />
            ) : (
              <div className="text-lg font-bold text-gray-900">{sleepScore ?? '—'}</div>
            )}
            <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Moon size={10} /> Sleep
            </div>
          </button>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <div className="text-lg font-bold text-gray-900">{viewHealth.restingHr ?? '—'}</div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Heart size={10} /> RHR bpm
            </div>
          </div>
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
          {displayEntry.instructions && (
            <div className="text-sm text-gray-800 leading-relaxed mb-3">
              {displayEntry.instructions}
            </div>
          )}
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

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={14} className="text-slate-500" />
          <div className="text-xs font-bold text-slate-600 tracking-wide">ASSISTANT COACH</div>
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
          <div className="prose prose-sm prose-slate max-w-none">
            <ReactMarkdown>{note.coachingTake}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {displayEntry && displayEntry.date === viewDate
              ? 'Tap ↻ to generate analysis.'
              : 'No workout planned — no analysis needed.'}
          </p>
        )}
      </div>

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

      <div className="flex items-center justify-end gap-3">
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

      {selected && (
        <ActivityDrawer
          log={selected}
          stravaActivities={strava}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

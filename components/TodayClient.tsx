'use client'

import { useState, useTransition } from 'react'
import type { PlannedWorkout, Phase, Race, HealthEntry, TrainingLogEntry, CoachingNote, StravaActivity } from '@/lib/data'
import { Brain, Zap, Moon, Heart, RefreshCw } from 'lucide-react'
import { syncStrava, regenerateCoachingNote } from '@/app/actions'
import ActivityDrawer from './ActivityDrawer'

const ZONE_COLORS = ['bg-gray-300', 'bg-blue-400', 'bg-green-400', 'bg-amber-400', 'bg-red-400']

function formatDateLong(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function daysUntil(iso: string) {
  const diff = new Date(iso + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
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
  todayEntry: PlannedWorkout | null
  nextWorkout: PlannedWorkout | null
  todayHealth: HealthEntry | null
  todayLogs: TrainingLogEntry[]
  stravaActivities: StravaActivity[]
  currentPhase: Phase | null
  nextRace: Race | null
  coachingNote: CoachingNote | null
}

export default function TodayClient({
  today, todayEntry, nextWorkout, todayHealth, todayLogs, stravaActivities,
  currentPhase, nextRace, coachingNote,
}: Props) {
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [selected, setSelected] = useState<TrainingLogEntry | null>(null)
  const [note, setNote] = useState(coachingNote)
  const [regenerating, startRegenerate] = useTransition()

  function handleRegenerate() {
    startRegenerate(async () => {
      const fresh = await regenerateCoachingNote(today)
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

  const entry = todayEntry ?? nextWorkout
  const isToday = entry?.date === today
  const isRestDay = todayEntry?.dayType === 'Rest'

  return (
    <div className="px-4 pt-10 pb-4">

      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Today</h1>
        <p className="text-sm text-gray-500 mt-0.5">{formatDateLong(today)}</p>
      </header>

      {nextRace && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{nextRace.name}</span>
          <span className="ml-auto text-sm font-bold text-blue-600">{daysUntil(nextRace.date)} days</span>
        </div>
      )}

      {todayHealth && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <div className={`text-lg font-bold ${hrvColor(todayHealth.hrv)}`}>
              {todayHealth.hrv ?? '—'}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Zap size={10} /> HRV ms
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <div className="text-lg font-bold text-gray-900">{todayHealth.sleepHours ?? '—'}</div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Moon size={10} /> Sleep h
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <div className="text-lg font-bold text-gray-900">{todayHealth.restingHr ?? '—'}</div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Heart size={10} /> RHR bpm
            </div>
          </div>
        </div>
      )}

      {isRestDay ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="text-xs font-bold text-gray-400 tracking-wide mb-1">TODAY</div>
          <div className="text-xl font-bold text-gray-900">Rest Day</div>
          {currentPhase && (
            <div className="text-sm text-gray-500 mt-1">{currentPhase.name} · {currentPhase.goal}</div>
          )}
        </div>
      ) : entry ? (
        <div className={`bg-white rounded-2xl border border-gray-100 border-l-4 ${runTypeBorderColor(entry)} shadow-sm p-5 mb-4`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <div className="text-xs font-bold text-gray-400 tracking-wide mb-1">
                {isToday ? 'TODAY' : `NEXT UP · ${new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
              </div>
              <div className="text-xl font-bold text-gray-900">{entry.workout ?? entry.runType ?? entry.dayType}</div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 shrink-0 whitespace-nowrap">
              {entry.runType ?? entry.dayType}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
            {entry.distance && <span className="font-semibold text-gray-700">{entry.distance} mi</span>}
            {entry.hrZone && <span>Zone {entry.hrZone}</span>}
            {entry.targetPace && <span>{entry.targetPace} /mi</span>}
            {currentPhase && <span>{currentPhase.name}</span>}
          </div>
          {entry.reason && (
            <div className="text-sm text-gray-600 mb-3 leading-relaxed">
              <span className="font-semibold text-gray-700">Purpose: </span>{entry.reason}
            </div>
          )}
          {entry.instructions && (
            <div className="text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
              {entry.instructions}
            </div>
          )}
          {entry.notes && (
            <div className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-3 leading-relaxed">
              {entry.notes}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="text-sm text-gray-400 italic">No workout scheduled yet.</div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={14} className="text-blue-500" />
          <div className="text-xs font-bold text-blue-600 tracking-wide">COACHING TAKE</div>
          {entry && entry.dayType !== 'Rest' && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="ml-auto text-blue-400 hover:text-blue-600 disabled:opacity-40"
            >
              <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
        {regenerating ? (
          <p className="text-sm text-gray-400 italic">Generating...</p>
        ) : note ? (
          <p className="text-sm text-gray-700 leading-relaxed">{note.coachingTake}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {entry
              ? 'Coaching note generates overnight. Check back in the morning.'
              : 'No workout planned — no coaching note needed.'}
          </p>
        )}
      </div>

      {todayLogs.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-bold text-gray-400 tracking-wide mb-2">LOGGED TODAY</div>
          <div className="flex flex-col gap-2">
            {todayLogs.map((log, i) => {
              const act = log.stravaId ? stravaActivities.find(a => a.activityId === log.stravaId) : null
              const name = act?.name ?? log.activityType
              return (
                <button
                  key={i}
                  onClick={() => setSelected(log)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left w-full"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-gray-900 text-sm">{name}</div>
                    <div className="text-xs text-gray-400">{log.activityType}</div>
                  </div>
                  <div className="flex gap-3 text-sm text-gray-500">
                    {log.distance && <span className="font-semibold text-gray-700">{log.distance} mi</span>}
                    {log.duration && <span>{log.duration} min</span>}
                    {log.pace && <span>{log.pace} /mi</span>}
                    {log.avgHr && <span>{log.avgHr} bpm</span>}
                  </div>
                  <ZoneBar logs={[log]} />
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
          stravaActivities={stravaActivities}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

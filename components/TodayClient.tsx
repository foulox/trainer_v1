'use client'

import type { PlannedWorkout, Phase, Race, HealthEntry, TrainingLogEntry, CoachingNote } from '@/lib/data'
import { Brain, Zap, Moon, Heart, ChevronRight } from 'lucide-react'

function formatDateLong(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function daysUntil(iso: string) {
  const diff = new Date(iso + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const DAY_TYPE_COLORS: Record<string, string> = {
  Run:           'border-l-blue-500',
  'Run (Easy)':  'border-l-green-500',
  'Run (Long)':  'border-l-purple-500',
  'Run (Quality)': 'border-l-blue-600',
  Bike:          'border-l-yellow-500',
  Race:          'border-l-red-500',
  Supplementary: 'border-l-teal-500',
  Rest:          'border-l-gray-200',
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

type Props = {
  today: string
  todayEntry: PlannedWorkout | null
  nextWorkout: PlannedWorkout | null
  todayHealth: HealthEntry | null
  todayLog: TrainingLogEntry | null
  currentPhase: Phase | null
  nextRace: Race | null
  coachingNote: CoachingNote | null
}

export default function TodayClient({
  today, todayEntry, nextWorkout, todayHealth, todayLog, currentPhase, nextRace, coachingNote,
}: Props) {
  const entry = todayEntry ?? nextWorkout
  const isToday = entry?.date === today
  const isRestDay = todayEntry?.dayType === 'Rest'

  return (
    <div className="px-4 pt-10 pb-4">

      {/* Header */}
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Today</h1>
        <p className="text-sm text-gray-500 mt-0.5">{formatDateLong(today)}</p>
      </header>

      {/* Race countdown */}
      {nextRace && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{nextRace.name}</span>
          <span className="ml-auto text-sm font-bold text-blue-600">{daysUntil(nextRace.date)} days</span>
        </div>
      )}

      {/* Health snapshot */}
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

      {/* Workout card */}
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
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="text-sm text-gray-400 italic">No workout scheduled yet.</div>
        </div>
      )}

      {/* AI coaching note */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={14} className="text-blue-500" />
          <div className="text-xs font-bold text-blue-600 tracking-wide">COACHING TAKE</div>
        </div>
        {coachingNote ? (
          <p className="text-sm text-gray-700 leading-relaxed">{coachingNote.coachingTake}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">
            {entry
              ? 'Coaching note generates overnight. Check back in the morning.'
              : 'No workout planned — no coaching note needed.'}
          </p>
        )}
      </div>

      {/* Logged activity */}
      {todayLog && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs font-bold text-gray-400 tracking-wide mb-2">LOGGED TODAY</div>
          <div className="flex gap-4 text-sm">
            <div><span className="font-semibold text-gray-900">{todayLog.distance} mi</span></div>
            <div><span className="text-gray-500">{todayLog.duration} min</span></div>
            {todayLog.avgHr && <div><span className="text-gray-500">{todayLog.avgHr} bpm avg</span></div>}
            {todayLog.rpe && <div><span className="text-gray-500">RPE {todayLog.rpe}</span></div>}
          </div>
          {todayLog.postRunFeel && (
            <div className="text-sm text-gray-500 mt-1">{todayLog.postRunFeel}</div>
          )}
        </div>
      )}
    </div>
  )
}

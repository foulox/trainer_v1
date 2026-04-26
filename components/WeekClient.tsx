'use client'

import { useState } from 'react'
import { Copy, Check, Brain } from 'lucide-react'
import type { PlannedWorkout, TrainingLogEntry, HealthEntry, WeekReview, Phase, Race } from '@/lib/data'

function fmt(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDay(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

function runTypeDot(entry: PlannedWorkout) {
  if (entry.dayType === 'Rest') return 'bg-gray-200'
  if (entry.runType === 'Easy') return 'bg-green-400'
  if (entry.runType === 'Long') return 'bg-purple-400'
  if (entry.runType === 'Quality') return 'bg-blue-500'
  if (entry.dayType === 'Race') return 'bg-red-500'
  if (entry.dayType === 'Bike') return 'bg-yellow-400'
  return 'bg-blue-300'
}

type Props = {
  today: string
  weekStart: string
  weekEnd: string
  weekNum: number
  weekPlan: PlannedWorkout[]
  weekLog: TrainingLogEntry[]
  weekHealth: HealthEntry[]
  weekReview: WeekReview | null
  currentPhase: Phase | null
  nextRace: Race | null
}

export default function WeekClient({
  today, weekStart, weekEnd, weekNum, weekPlan, weekLog,
  weekHealth, weekReview, currentPhase,
}: Props) {
  const [copied, setCopied] = useState(false)

  const plannedMiles = weekPlan.reduce((s, e) => s + (e.distance ?? 0), 0)
  const actualMiles = weekLog.reduce((s, e) => s + (e.distance ?? 0), 0)
  const pct = plannedMiles > 0 ? Math.min(100, Math.round((actualMiles / plannedMiles) * 100)) : 0

  function handleCopy() {
    if (!weekReview?.ptSummary) return
    navigator.clipboard.writeText(weekReview.ptSummary).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="px-4 pt-10 pb-4">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Week {weekNum}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {fmt(weekStart)} – {fmt(weekEnd)}
          {currentPhase && ` · ${currentPhase.name}`}
        </p>
      </header>

      {/* Volume summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex justify-between items-baseline mb-2">
          <div className="text-sm font-semibold text-gray-700">Mileage</div>
          <div className="text-sm text-gray-500">{actualMiles.toFixed(1)} / {plannedMiles.toFixed(1)} mi</div>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-1">{pct}% complete</div>
      </div>

      {/* Day-by-day */}
      <div className="flex flex-col gap-2 mb-5">
        {weekPlan.map(entry => {
          const actual = weekLog.find(l => l.date === entry.date)
          const isToday = entry.date === today
          return (
            <div
              key={entry.date}
              className={`bg-white rounded-2xl border shadow-sm p-3 flex items-center gap-3 ${isToday ? 'border-blue-200' : 'border-gray-100'}`}
            >
              <div className="text-center w-8 shrink-0">
                <div className="text-xs font-semibold text-gray-400">{fmtDay(entry.date)}</div>
                <div className="text-sm font-bold text-gray-900">{new Date(entry.date + 'T00:00:00').getDate()}</div>
              </div>
              <div className={`w-2 h-2 rounded-full shrink-0 ${runTypeDot(entry)}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {entry.workout ?? entry.runType ?? entry.dayType}
                </div>
                <div className="text-xs text-gray-400">
                  {entry.distance ? `${entry.distance} mi planned` : entry.dayType}
                </div>
              </div>
              {actual ? (
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-emerald-600">{actual.distance} mi</div>
                  <div className="text-xs text-gray-400">{actual.duration} min</div>
                </div>
              ) : entry.date < today && entry.dayType !== 'Rest' ? (
                <div className="text-xs text-amber-500 font-medium shrink-0">Not logged</div>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* AI week review */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={14} className="text-blue-500" />
          <div className="text-xs font-bold text-blue-600 tracking-wide">WEEK IN REVIEW</div>
        </div>
        {weekReview ? (
          <p className="text-sm text-gray-700 leading-relaxed">{weekReview.summary}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">
            Week review generates Sunday night. Check back then.
          </p>
        )}
      </div>

      {/* PT summary */}
      {weekReview?.ptSummary && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs font-bold text-gray-500 tracking-wide mb-2">PT SUMMARY</div>
          <p className="text-sm text-gray-700 leading-relaxed mb-3">{weekReview.ptSummary}</p>
          <button
            onClick={handleCopy}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm touch-manipulation transition-colors ${
              copied ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'
            }`}
          >
            {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy for PT</>}
          </button>
        </div>
      )}
    </div>
  )
}

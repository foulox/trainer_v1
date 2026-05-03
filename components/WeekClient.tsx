'use client'

import { useState, useTransition } from 'react'
import { Copy, Check, Brain, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { PlannedWorkout, TrainingLogEntry, HealthEntry, WeekReview, Phase, Race, StravaActivity } from '@/lib/data'
import { regenerateWeekReview } from '@/app/actions'
import ActivityDrawer from './ActivityDrawer'

const ZONE_COLORS = ['bg-gray-300', 'bg-blue-400', 'bg-green-400', 'bg-amber-400', 'bg-red-400']
const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

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
    <div className="flex h-1 rounded-full overflow-hidden mt-2">
      {totals.map((t, i) => t > 0 ? (
        <div key={i} className={ZONE_COLORS[i]} style={{ width: `${(t / total) * 100}%` }} />
      ) : null)}
    </div>
  )
}

function DaySummary({ logs }: { logs: TrainingLogEntry[] }) {
  const totals = [
    logs.reduce((s, l) => s + (l.zone1 ?? 0), 0),
    logs.reduce((s, l) => s + (l.zone2 ?? 0), 0),
    logs.reduce((s, l) => s + (l.zone3 ?? 0), 0),
    logs.reduce((s, l) => s + (l.zone4 ?? 0), 0),
    logs.reduce((s, l) => s + (l.zone5 ?? 0), 0),
  ]
  const totalMin = totals.reduce((s, v) => s + v, 0)
  const totalDist = logs.reduce((s, l) => s + (l.distance ?? 0), 0)
  const avgHr = logs.filter(l => l.avgHr).length
    ? Math.round(logs.reduce((s, l) => s + (l.avgHr ?? 0), 0) / logs.filter(l => l.avgHr).length)
    : null

  return (
    <div className="mt-3 pl-11 border-t border-gray-100 pt-3">
      <div className="flex gap-4 text-xs text-gray-500 mb-2">
        {totalDist > 0 && <span className="font-semibold text-gray-700">{totalDist.toFixed(1)} mi total</span>}
        {totalMin > 0 && <span>{totalMin} min</span>}
        {avgHr && <span>{avgHr} bpm avg</span>}
      </div>
      {totalMin > 0 && (
        <div className="flex flex-col gap-1">
          {totals.map((t, i) => t > 0 ? (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${ZONE_COLORS[i]}`} />
              <div className="text-xs text-gray-500 w-5">{ZONE_LABELS[i]}</div>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${ZONE_COLORS[i]}`} style={{ width: `${(t / totalMin) * 100}%` }} />
              </div>
              <div className="text-xs text-gray-400 w-10 text-right">{t} min</div>
            </div>
          ) : null)}
        </div>
      )}
    </div>
  )
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
  stravaActivities: StravaActivity[]
}

export default function WeekClient({
  today, weekStart, weekEnd, weekNum, weekPlan, weekLog,
  weekHealth, weekReview, currentPhase, stravaActivities,
}: Props) {
  const [review, setReview] = useState(weekReview)
  const [copied, setCopied] = useState(false)
  const [selected, setSelected] = useState<TrainingLogEntry | null>(null)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  const [regenerating, startRegenerate] = useTransition()

  const plannedMiles = weekPlan.reduce((s, e) => s + (e.distance ?? 0), 0)
  const actualMiles = weekLog.reduce((s, e) => s + (e.distance ?? 0), 0)
  const pct = plannedMiles > 0 ? Math.min(100, Math.round((actualMiles / plannedMiles) * 100)) : 0

  function handleCopy() {
    if (!review?.ptSummary) return
    navigator.clipboard.writeText(review.ptSummary).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleRegenerate() {
    startRegenerate(async () => {
      const fresh = await regenerateWeekReview(weekStart)
      if (fresh) setReview(fresh)
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

      <div className="flex flex-col gap-2 mb-5">
        {weekPlan.map(entry => {
          const dayLogs = weekLog.filter(l => l.date === entry.date)
          const isToday = entry.date === today
          const isPast = entry.date < today
          const totalActualMi = dayLogs.reduce((s, l) => s + (l.distance ?? 0), 0)
          const isExpanded = expandedDay === entry.date

          return (
            <div
              key={entry.date}
              className={`bg-white rounded-2xl border shadow-sm p-3 ${isToday ? 'border-blue-200' : 'border-gray-100'}`}
            >
              {/* Tappable day header */}
              <button
                className="w-full text-left"
                onClick={() => setExpandedDay(isExpanded ? null : entry.date)}
              >
                <div className="flex items-center gap-3">
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
                  {dayLogs.length > 0 ? (
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-emerald-600">{totalActualMi.toFixed(1)} mi</div>
                      <div className="text-xs text-gray-400">
                        {dayLogs.reduce((s, l) => s + (l.duration ?? 0), 0)} min
                      </div>
                    </div>
                  ) : isPast && entry.dayType !== 'Rest' ? (
                    <div className="text-xs text-amber-500 font-medium shrink-0">Not logged</div>
                  ) : null}
                </div>
                {dayLogs.length > 0 && !isExpanded && <ZoneBar logs={dayLogs} />}
              </button>

              {/* Individual activity rows — stopPropagation so they don't toggle expand */}
              {dayLogs.length > 0 && (
                <div className="mt-2 pl-11 flex flex-col gap-1">
                  {dayLogs.map((log, i) => {
                    const act = log.stravaId ? stravaActivities.find(a => a.activityId === log.stravaId) : null
                    const name = act?.name ?? log.activityType
                    return (
                      <button
                        key={i}
                        onClick={e => { e.stopPropagation(); setSelected(log) }}
                        className="text-left flex items-center gap-2 py-0.5"
                      >
                        <span className="text-xs text-blue-600 underline font-medium truncate">{name}</span>
                        {log.distance && (
                          <span className="text-xs text-gray-400 shrink-0">{log.distance} mi</span>
                        )}
                        {log.avgHr && (
                          <span className="text-xs text-gray-400 shrink-0">{log.avgHr} bpm</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Expanded day summary */}
              {isExpanded && dayLogs.length > 0 && <DaySummary logs={dayLogs} />}
            </div>
          )
        })}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={14} className="text-blue-500" />
          <div className="text-xs font-bold text-blue-600 tracking-wide">WEEK IN REVIEW</div>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="ml-auto text-blue-400 hover:text-blue-600 disabled:opacity-40"
          >
            <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
          </button>
        </div>
        {regenerating ? (
          <p className="text-sm text-gray-400 italic">Generating...</p>
        ) : review ? (
          <div className="prose prose-sm prose-gray max-w-none">
            <ReactMarkdown>{review.summary}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">
            Tap ↻ to generate this week&apos;s review.
          </p>
        )}
      </div>

      {review?.ptSummary && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xs font-bold text-gray-500 tracking-wide">PT SUMMARY</div>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="ml-auto text-gray-400 hover:text-gray-600 disabled:opacity-40"
            >
              <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="prose prose-sm prose-gray max-w-none mb-3">
            <ReactMarkdown>{review.ptSummary}</ReactMarkdown>
          </div>
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

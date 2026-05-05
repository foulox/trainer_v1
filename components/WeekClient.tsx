'use client'

import { useState, useTransition } from 'react'
import { Copy, Check, Brain, RefreshCw, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import type { PlannedWorkout, TrainingLogEntry, HealthEntry, WeekReview, Phase, Race, StravaActivity } from '@/lib/data'
import { regenerateWeekReview, generatePTSummaryAction } from '@/app/actions'
import ActivityDrawer from './ActivityDrawer'
import DayDrawer from './DayDrawer'

const ZONE_COLORS = ['bg-gray-300', 'bg-blue-400', 'bg-green-400', 'bg-amber-400', 'bg-red-400']

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
  const [drawerDate, setDrawerDate] = useState<string | null>(null)
  const [regenerating, startRegenerate] = useTransition()

  // PT summary state
  const [ptExpanded, setPtExpanded] = useState(false)
  const [ptStart, setPtStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 28)
    return d.toISOString().slice(0, 10)
  })
  const [ptEnd, setPtEnd] = useState(today)
  const [ptResult, setPtResult] = useState<string | null>(null)
  const [ptLoading, setPtLoading] = useState(false)
  const [ptCopied, setPtCopied] = useState(false)

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

  async function handleGeneratePT() {
    setPtLoading(true)
    const result = await generatePTSummaryAction(ptStart, ptEnd)
    setPtResult(result)
    setPtLoading(false)
  }

  function handleCopyPT() {
    if (!ptResult) return
    navigator.clipboard.writeText(ptResult).then(() => {
      setPtCopied(true)
      setTimeout(() => setPtCopied(false), 2000)
    })
  }

  const drawerEntry = drawerDate ? weekPlan.find(e => e.date === drawerDate) ?? null : null
  const drawerLogs = drawerDate ? weekLog.filter(l => l.date === drawerDate) : []
  const drawerHealth = drawerDate ? weekHealth.find(h => h.date === drawerDate) ?? null : null

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

          return (
            <div
              key={entry.date}
              className={`bg-white rounded-2xl border shadow-sm p-3 ${isToday ? 'border-blue-200' : 'border-gray-100'}`}
            >
              <button
                className="w-full text-left"
                onClick={() => setDrawerDate(entry.date)}
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
                {dayLogs.length > 0 && <ZoneBar logs={dayLogs} />}
              </button>

              {/* Individual activity rows */}
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
            </div>
          )
        })}
      </div>

      {/* Week in Review */}
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

      {/* PT Summary — on-demand with date range */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <button
          className="w-full flex items-center gap-2"
          onClick={() => setPtExpanded(v => !v)}
        >
          <FileText size={14} className="text-gray-400" />
          <div className="text-xs font-bold text-gray-500 tracking-wide">PT SUMMARY</div>
          {ptExpanded ? <ChevronUp size={14} className="ml-auto text-gray-400" /> : <ChevronDown size={14} className="ml-auto text-gray-400" />}
        </button>

        {ptExpanded && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <div className="text-xs text-gray-400 mb-1">From</div>
                <input
                  type="date"
                  value={ptStart}
                  onChange={e => setPtStart(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-400 mb-1">To</div>
                <input
                  type="date"
                  value={ptEnd}
                  onChange={e => setPtEnd(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
            </div>

            <button
              onClick={handleGeneratePT}
              disabled={ptLoading}
              className="w-full bg-gray-800 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40"
            >
              {ptLoading ? 'Generating...' : 'Generate PT Summary'}
            </button>

            {ptResult && (
              <>
                <div className="prose prose-sm prose-gray max-w-none border-t border-gray-100 pt-3">
                  <ReactMarkdown>{ptResult}</ReactMarkdown>
                </div>
                <button
                  onClick={handleCopyPT}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors ${
                    ptCopied ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'
                  }`}
                >
                  {ptCopied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy for PT</>}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {selected && (
        <ActivityDrawer
          log={selected}
          stravaActivities={stravaActivities}
          onClose={() => setSelected(null)}
        />
      )}

      {drawerDate && (
        <DayDrawer
          date={drawerDate}
          plan={drawerEntry}
          logs={drawerLogs}
          health={drawerHealth}
          stravaActivities={stravaActivities}
          onClose={() => setDrawerDate(null)}
        />
      )}
    </div>
  )
}

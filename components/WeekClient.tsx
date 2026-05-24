'use client'

import { useState, useTransition } from 'react'
import { Copy, Check, Brain, RefreshCw, FileText, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react'
import ReactMarkdown from '@/components/Markdown'
import type { PlannedWorkout, TrainingLogEntry, HealthEntry, WeekReview, Phase, StravaActivity } from '@/lib/data'
import { regenerateWeekReview, fetchWeekReviewForWeek, generatePTSummaryAction } from '@/app/actions'
import ActivityDrawer from './ActivityDrawer'
import DayDrawer from './DayDrawer'

const ZONE_COLORS = ['bg-gray-300', 'bg-blue-400', 'bg-green-400', 'bg-amber-400', 'bg-red-400']

function fmt(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDay(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function getWeekMonday(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
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
  initialWeekStart: string
  plan: PlannedWorkout[]
  log: TrainingLogEntry[]
  health: HealthEntry[]
  phases: Phase[]
  strava: StravaActivity[]
  initialWeekReview: WeekReview | null
}

export default function WeekClient({
  today, initialWeekStart, plan, log, health, phases, strava, initialWeekReview,
}: Props) {
  const [viewWeekStart, setViewWeekStart] = useState(initialWeekStart)
  const [weekReviews, setWeekReviews] = useState<Record<string, WeekReview | null>>(
    { [initialWeekStart]: initialWeekReview }
  )
  const [selected, setSelected] = useState<TrainingLogEntry | null>(null)
  const [drawerDate, setDrawerDate] = useState<string | null>(null)
  const [regenerating, startRegenerate] = useTransition()
  const [copied, setCopied] = useState(false)

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

  // Derive week data from view state
  const viewWeekEnd = addDays(viewWeekStart, 6)
  const weekPlan = plan.filter(e => e.date >= viewWeekStart && e.date <= viewWeekEnd)
  const weekLog = log.filter(e => e.date >= viewWeekStart && e.date <= viewWeekEnd)
  const weekHealth = health.filter(e => e.date >= viewWeekStart && e.date <= viewWeekEnd)
  const weekStrava = strava.filter(a => a.date >= viewWeekStart && a.date <= viewWeekEnd)
  const weekNum = weekPlan[0]?.week ?? 0
  const currentPhase = phases.find(p => p.startDate <= viewWeekStart && p.endDate >= viewWeekEnd)
    ?? phases.find(p => p.startDate <= viewWeekStart && p.endDate >= viewWeekStart)
    ?? null
  const review = weekReviews[viewWeekStart] ?? null

  // Week navigation bounds from plan dates
  const planDates = plan.map(e => e.date).sort()
  const minWeekStart = planDates.length ? getWeekMonday(planDates[0]) : viewWeekStart
  const maxWeekStart = planDates.length ? getWeekMonday(planDates[planDates.length - 1]) : viewWeekStart
  const isCurrentWeek = viewWeekStart === initialWeekStart

  const plannedMiles = weekPlan.reduce((s, e) => s + (e.distance ?? 0), 0)
  const runMiles = weekLog.filter(e => /run/i.test(e.activityType)).reduce((s, e) => s + (e.distance ?? 0), 0)
  const bikeMiles = weekLog.filter(e => /ride/i.test(e.activityType)).reduce((s, e) => s + (e.distance ?? 0), 0)
  const pct = plannedMiles > 0 ? Math.min(100, Math.round((runMiles / plannedMiles) * 100)) : 0

  async function navigateWeek(newStart: string) {
    if (newStart < minWeekStart || newStart > maxWeekStart) return
    setViewWeekStart(newStart)
    if (!(newStart in weekReviews)) {
      // Load cached review for the target week without blocking navigation
      fetchWeekReviewForWeek(newStart).then(r =>
        setWeekReviews(prev => ({ ...prev, [newStart]: r }))
      )
    }
  }

  function handleRegenerate() {
    startRegenerate(async () => {
      const fresh = await regenerateWeekReview(viewWeekStart)
      if (fresh) setWeekReviews(prev => ({ ...prev, [viewWeekStart]: fresh }))
    })
  }

  function handleCopy() {
    if (!review?.ptSummary) return
    navigator.clipboard.writeText(review.ptSummary).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek(addDays(viewWeekStart, -7))}
            disabled={viewWeekStart <= minWeekStart}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 touch-manipulation"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-gray-900">
              {weekNum > 0 ? `Week ${weekNum}` : fmt(viewWeekStart) + ' week'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {fmt(viewWeekStart)} – {fmt(viewWeekEnd)}
              {currentPhase && ` · ${currentPhase.name}`}
            </p>
          </div>
          <button
            onClick={() => navigateWeek(addDays(viewWeekStart, 7))}
            disabled={viewWeekStart >= maxWeekStart}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-20 touch-manipulation"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        {!isCurrentWeek && (
          <button
            onClick={() => navigateWeek(initialWeekStart)}
            className="mt-1 w-full text-xs text-blue-500 hover:text-blue-700 text-center"
          >
            Back to this week
          </button>
        )}
      </header>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="flex justify-between items-baseline mb-2">
          <div className="text-sm font-semibold text-gray-700">Mileage</div>
          <div className="text-sm text-gray-500">
            Run {runMiles.toFixed(1)} / {plannedMiles.toFixed(1)} mi
            {bikeMiles > 0 && <span className="ml-2 text-gray-400">· Bike {bikeMiles.toFixed(1)} mi</span>}
          </div>
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
                className="w-full text-left touch-manipulation"
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
                        {dayLogs.reduce((s, l) => s + (l.duration ?? 0), 0).toFixed(1)} min
                      </div>
                    </div>
                  ) : isPast && entry.dayType !== 'Rest' ? (
                    <div className="text-xs text-amber-500 font-medium shrink-0">Not logged</div>
                  ) : null}
                </div>
                {dayLogs.length > 0 && <ZoneBar logs={dayLogs} />}
              </button>

              {dayLogs.length > 0 && (
                <div className="mt-2 pl-11 flex flex-col gap-1">
                  {dayLogs.map((log, i) => {
                    const act = log.stravaId ? weekStrava.find(a => a.activityId === log.stravaId) : null
                    const name = act?.name ?? log.activityType
                    return (
                      <button
                        key={i}
                        onClick={e => { e.stopPropagation(); setSelected(log) }}
                        className="text-left flex items-center gap-2 py-0.5 touch-manipulation"
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

        {weekPlan.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">No plan data for this week</div>
        )}
      </div>

      {/* Week in Review */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={14} className="text-blue-500" />
          <div className="text-xs font-bold text-blue-600 tracking-wide">WEEK IN REVIEW</div>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="ml-auto text-blue-400 hover:text-blue-600 disabled:opacity-40 touch-manipulation"
          >
            <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
          </button>
        </div>
        {regenerating ? (
          <p className="text-sm text-gray-400 italic">Generating...</p>
        ) : review ? (
          <>
            <div className="prose prose-sm prose-gray max-w-none">
              <ReactMarkdown>{review.summary}</ReactMarkdown>
            </div>
            {review.ptSummary && (
              <button
                onClick={handleCopy}
                className={`mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                  copied ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white'
                }`}
              >
                {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy PT summary</>}
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 italic">
            Tap ↻ to generate this week&apos;s review.
          </p>
        )}
      </div>

      {/* PT Summary — on-demand with date range */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <button
          className="w-full flex items-center gap-2 touch-manipulation"
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
              className="w-full bg-gray-800 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40 touch-manipulation"
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
          stravaActivities={strava}
          onClose={() => setSelected(null)}
        />
      )}

      {drawerDate && (
        <DayDrawer
          date={drawerDate}
          plan={drawerEntry}
          logs={drawerLogs}
          health={drawerHealth}
          stravaActivities={weekStrava}
          onClose={() => setDrawerDate(null)}
        />
      )}
    </div>
  )
}

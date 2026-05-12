'use client'

import { useState, useEffect } from 'react'
import { X, Zap, Moon, Heart, Brain } from 'lucide-react'
import ReactMarkdown from '@/components/Markdown'
import type { PlannedWorkout, TrainingLogEntry, HealthEntry, StravaActivity, CoachingNote } from '@/lib/data'
import { fetchCoachingNoteForDate } from '@/app/actions'
import ActivityDrawer from './ActivityDrawer'

const ZONE_COLORS = ['bg-gray-300', 'bg-blue-400', 'bg-green-400', 'bg-amber-400', 'bg-red-400']
const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

function fmt(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

function hrvColor(hrv: number | null) {
  if (!hrv) return 'text-gray-400'
  if (hrv >= 55) return 'text-emerald-600'
  if (hrv >= 40) return 'text-amber-500'
  return 'text-red-500'
}

type Props = {
  date: string
  plan: PlannedWorkout | null
  logs: TrainingLogEntry[]
  health: HealthEntry | null
  stravaActivities: StravaActivity[]
  onClose: () => void
}

export default function DayDrawer({ date, plan, logs, health, stravaActivities, onClose }: Props) {
  const [note, setNote] = useState<CoachingNote | null>(null)
  const [noteLoading, setNoteLoading] = useState(true)
  const [selected, setSelected] = useState<TrainingLogEntry | null>(null)

  useEffect(() => {
    setNoteLoading(true)
    fetchCoachingNoteForDate(date)
      .then(n => setNote(n))
      .catch(() => setNote(null))
      .finally(() => setNoteLoading(false))
  }, [date])

  const totalMi = logs.reduce((s, l) => s + (l.distance ?? 0), 0)
  const totalMin = logs.reduce((s, l) => s + (l.duration ?? 0), 0)

  const totals = [
    logs.reduce((s, l) => s + (l.zone1 ?? 0), 0),
    logs.reduce((s, l) => s + (l.zone2 ?? 0), 0),
    logs.reduce((s, l) => s + (l.zone3 ?? 0), 0),
    logs.reduce((s, l) => s + (l.zone4 ?? 0), 0),
    logs.reduce((s, l) => s + (l.zone5 ?? 0), 0),
  ]
  const totalZoneMin = totals.reduce((s, v) => s + v, 0)

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
        <div className="bg-white rounded-t-3xl flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
            <div>
              <div className="text-sm font-bold text-gray-900">{fmt(date)}</div>
              {plan && plan.dayType !== 'Rest' && (
                <div className="text-xs text-gray-400 mt-0.5">
                  {plan.workout ?? plan.runType ?? plan.dayType}
                  {plan.distance ? ` · ${plan.distance} mi` : ''}
                </div>
              )}
              {plan?.dayType === 'Rest' && (
                <div className="text-xs text-gray-400 mt-0.5">Rest Day</div>
              )}
            </div>
            <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
            {/* Health vitals */}
            {health && (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className={`text-lg font-bold ${hrvColor(health.hrv)}`}>
                    {health.hrv != null ? Math.round(health.hrv) : '—'}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
                    <Zap size={10} /> HRV ms
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-gray-900">{health.sleepScore ?? '—'}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
                    <Moon size={10} /> Sleep
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-gray-900">{health.restingHr ?? '—'}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
                    <Heart size={10} /> RHR
                  </div>
                </div>
              </div>
            )}

            {/* Activities */}
            {logs.length > 0 && (
              <div>
                <div className="text-xs font-bold text-gray-400 tracking-wide mb-2">ACTIVITIES</div>
                <div className="flex flex-col gap-2">
                  {logs.map((log, i) => {
                    const act = log.stravaId ? stravaActivities.find(a => a.activityId === log.stravaId) : null
                    const name = act?.name ?? log.activityType
                    return (
                      <button
                        key={i}
                        onClick={() => setSelected(log)}
                        className="bg-gray-50 rounded-xl p-3 text-left w-full"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-semibold text-gray-900 text-sm">{name}</div>
                          <div className="text-xs text-gray-400">{log.activityType}</div>
                        </div>
                        <div className="flex gap-3 text-xs text-gray-500">
                          {log.distance && <span className="font-semibold text-gray-700">{log.distance} mi</span>}
                          {log.duration && <span>{log.duration} min</span>}
                          {log.avgHr && <span>{log.avgHr} bpm</span>}
                          {log.rpe && <span>RPE {log.rpe}</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {totalZoneMin > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-400 mb-1">{totalMi.toFixed(1)} mi · {totalMin} min total</div>
                    <div className="flex flex-col gap-1">
                      {totals.map((t, i) => t > 0 ? (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${ZONE_COLORS[i]}`} />
                          <div className="text-xs text-gray-500 w-5">{ZONE_LABELS[i]}</div>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${ZONE_COLORS[i]}`} style={{ width: `${(t / totalZoneMin) * 100}%` }} />
                          </div>
                          <div className="text-xs text-gray-400 w-10 text-right">{t} min</div>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {logs.length === 0 && plan && plan.dayType !== 'Rest' && (
              <div className="text-xs text-amber-500 font-medium">No activity logged for this day.</div>
            )}

            {/* Coaching note */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain size={13} className="text-slate-500" />
                <div className="text-xs font-bold text-slate-600 tracking-wide">ASSISTANT COACH</div>
              </div>
              {noteLoading ? (
                <p className="text-sm text-gray-400 italic">Loading...</p>
              ) : note ? (
                <div className="prose prose-sm prose-slate max-w-none">
                  <ReactMarkdown>{note.coachingTake}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">
                  {plan?.dayType === 'Rest' ? 'Rest day — no analysis.' : 'No coaching note available.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <ActivityDrawer
          log={selected}
          stravaActivities={stravaActivities}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

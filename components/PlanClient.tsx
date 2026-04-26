'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react'
import type { PlannedWorkout, Phase, Race } from '@/lib/data'

function fmt(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDay(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

function runTypeBg(entry: PlannedWorkout) {
  if (entry.dayType === 'Rest') return 'bg-gray-100 text-gray-400'
  if (entry.runType === 'Easy') return 'bg-green-100 text-green-700'
  if (entry.runType === 'Long') return 'bg-purple-100 text-purple-700'
  if (entry.runType === 'Quality') return 'bg-blue-100 text-blue-700'
  if (entry.dayType === 'Race') return 'bg-red-100 text-red-700'
  if (entry.dayType === 'Bike') return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-600'
}

type Props = {
  plan: PlannedWorkout[]
  phases: Phase[]
  races: Race[]
  today: string
}

export default function PlanClient({ plan, phases, races, today }: Props) {
  const weeks = useMemo(() => {
    const map = new Map<number, PlannedWorkout[]>()
    for (const e of plan) {
      const w = e.week || 1
      if (!map.has(w)) map.set(w, [])
      map.get(w)!.push(e)
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [plan])

  const currentWeekNum = plan.find(e => e.date >= today)?.week ?? weeks[0]?.[0] ?? 1
  const initialIdx = weeks.findIndex(([w]) => w === currentWeekNum)
  const [weekIdx, setWeekIdx] = useState(Math.max(0, initialIdx))

  const [weekNum, weekEntries] = weeks[weekIdx] ?? [1, []]
  const phase = phases.find(p => weekEntries.some(e => e.phase === p.name)) ?? phases[0]
  const weekRaces = races.filter(r => weekEntries.some(e => e.date === r.date))
  const totalMiles = weekEntries.reduce((s, e) => s + (e.distance ?? 0), 0)

  const weekStart = weekEntries[0]?.date ?? ''
  const weekEnd = weekEntries[weekEntries.length - 1]?.date ?? ''

  return (
    <div className="px-4 pt-10 pb-4">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Plan</h1>
        <p className="text-sm text-gray-500 mt-0.5">{weeks.length} weeks · {phases.length} phases</p>
      </header>

      {/* Week nav */}
      <div className="flex items-center justify-between mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-2 py-2">
        <button
          onClick={() => setWeekIdx(i => i - 1)}
          disabled={weekIdx === 0}
          className="p-2 rounded-xl touch-manipulation disabled:opacity-30 text-gray-500 active:bg-gray-100"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="text-sm font-bold text-gray-900">Week {weekNum}</div>
          <div className="text-xs text-gray-400">{weekStart && `${fmt(weekStart)} – ${fmt(weekEnd)}`}</div>
        </div>
        <button
          onClick={() => setWeekIdx(i => i + 1)}
          disabled={weekIdx >= weeks.length - 1}
          className="p-2 rounded-xl touch-manipulation disabled:opacity-30 text-gray-500 active:bg-gray-100"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Phase + volume */}
      {phase && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 mb-4">
          <div className="text-xs font-bold text-blue-600 tracking-wide mb-0.5">{phase.name.toUpperCase()}</div>
          <div className="text-sm text-gray-600">{phase.goal}</div>
          <div className="text-xs text-gray-400 mt-1">{totalMiles.toFixed(1)} mi planned this week</div>
        </div>
      )}

      {/* Race flags */}
      {weekRaces.map(r => (
        <div key={r.name} className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
          <Flag size={13} className="text-red-500" />
          <span className="text-sm font-semibold text-red-700">{r.name}</span>
          <span className="text-xs text-red-400 ml-auto">{r.purpose}</span>
        </div>
      ))}

      {/* Days */}
      <div className="flex flex-col gap-2">
        {weekEntries.map(entry => {
          const isToday = entry.date === today
          return (
            <div
              key={entry.date}
              className={`bg-white rounded-2xl border shadow-sm p-4 ${isToday ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-100'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-bold text-gray-400 w-7">{fmtDay(entry.date)}</div>
                  <div className="text-sm font-bold text-gray-900">
                    {entry.workout ?? (entry.dayType === 'Rest' ? 'Rest' : entry.runType ?? entry.dayType)}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${runTypeBg(entry)}`}>
                  {entry.runType ?? entry.dayType}
                </span>
              </div>
              {entry.dayType !== 'Rest' && (
                <div className="flex gap-3 text-xs text-gray-400 ml-9">
                  {entry.distance && <span>{entry.distance} mi</span>}
                  {entry.hrZone && <span>Zone {entry.hrZone}</span>}
                  {entry.intensity && <span>{entry.intensity}</span>}
                </div>
              )}
              {entry.reason && (
                <div className="text-xs text-gray-500 mt-2 ml-9 leading-relaxed">{entry.reason}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

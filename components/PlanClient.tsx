'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Flag, Plus, Pencil, Trash2, X, ChevronDown } from 'lucide-react'
import type { PlannedWorkout, Phase, Race, LibraryWorkout } from '@/lib/data'
import { createPhase, updatePhase, deletePhase, savePlanDay, setupPhaseDays, addRace, updateRace, deleteRace, applyWorkoutToWeekday } from '@/app/actions'

// ── Formatting helpers ────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDay(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

function dayTypeBg(entry: PlannedWorkout) {
  if (entry.dayType === 'Rest') return 'bg-gray-100 text-gray-400'
  if (entry.runType === 'Easy') return 'bg-green-100 text-green-700'
  if (entry.runType === 'Long') return 'bg-purple-100 text-purple-700'
  if (entry.runType === 'Quality') return 'bg-blue-100 text-blue-700'
  if (entry.dayType === 'Race') return 'bg-red-100 text-red-700'
  if (entry.dayType === 'Bike') return 'bg-yellow-100 text-yellow-700'
  return 'bg-gray-100 text-gray-600'
}

// ── Types ─────────────────────────────────────────────────────

type Props = {
  plan: PlannedWorkout[]
  phases: Phase[]
  races: Race[]
  library: LibraryWorkout[]
  today: string
}

type PhaseForm = {
  name: string
  startDate: string
  endDate: string
  goal: string
}

const emptyPhaseForm = (): PhaseForm => ({ name: '', startDate: '', endDate: '', goal: '' })

type TimelineItem =
  | { kind: 'phase'; phase: Phase; cRaces: Race[] }
  | { kind: 'race'; race: Race }

// ── Phase Form Modal ──────────────────────────────────────────

function PhaseModal({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: PhaseForm
  onSave: (f: PhaseForm) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState<PhaseForm>(initial)
  const set = (k: keyof PhaseForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
      <div className="bg-white w-full rounded-t-3xl p-6 pb-10 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">{initial.name ? 'Edit Phase' : 'New Phase'}</h2>
          <button onClick={onCancel} className="p-1 text-gray-400"><X size={20} /></button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Phase Name</span>
          <input value={form.name} onChange={set('name')} placeholder="Base Building"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Start Date</span>
            <input type="date" value={form.startDate} onChange={set('startDate')}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">End Date</span>
            <input type="date" value={form.endDate} onChange={set('endDate')}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Goal / Focus</span>
          <textarea value={form.goal} onChange={set('goal')} rows={3}
            placeholder="What you're building toward, what you're working on, any constraints..."
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none" />
        </label>

        <button
          onClick={() => onSave(form)}
          disabled={isPending || !form.name || !form.startDate || !form.endDate}
          className="bg-blue-600 text-white rounded-2xl py-3 text-sm font-bold disabled:opacity-40 active:bg-blue-700"
        >
          {isPending ? 'Saving…' : 'Save Phase'}
        </button>
      </div>
    </div>
  )
}

// ── Day Editor Modal ──────────────────────────────────────────

const DAY_TYPES = ['Run', 'Bike', 'Supplementary', 'Rest', 'Race'] as const
const RUN_TYPES = ['Easy', 'Long', 'Quality', 'Race'] as const

function DayEditor({
  entry,
  library,
  onSave,
  onCancel,
  isPending,
}: {
  entry: PlannedWorkout
  library: LibraryWorkout[]
  onSave: (fields: Partial<PlannedWorkout>) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [dayType, setDayType] = useState<string>(entry.dayType)
  const [runType, setRunType] = useState<string>(entry.runType ?? '')
  const [selectedWorkout, setSelectedWorkout] = useState<LibraryWorkout | null>(null)
  const [distance, setDistance] = useState<string>(entry.distance ? String(entry.distance) : '')
  const [notes, setNotes] = useState<string>(entry.notes ?? '')
  const [showPicker, setShowPicker] = useState(false)
  const [filterType, setFilterType] = useState<string>('')
  const [filterSubType, setFilterSubType] = useState<string>('')
  const [expandedVariation, setExpandedVariation] = useState<string | null>(null)

  const sportFiltered = useMemo(() => library.filter(w => {
    if (dayType === 'Run' && w.sport !== 'Run') return false
    if (dayType === 'Bike' && w.sport !== 'Bike') return false
    return true
  }), [library, dayType])

  const filteredLibrary = useMemo(() => {
    return sportFiltered.filter(w => {
      if (filterType && w.category !== filterType) return false
      if (filterSubType && w.type !== filterSubType) return false
      return true
    })
  }, [sportFiltered, filterType, filterSubType])

  // Standalone workouts (no variation family) + one representative per variation family
  const pickerRows = useMemo(() => {
    const seen = new Set<string>()
    return filteredLibrary.filter(w => {
      if (!w.variation) return true
      if (seen.has(w.variation)) return false
      seen.add(w.variation)
      return true
    })
  }, [filteredLibrary])

  const libraryTypes = useMemo(() =>
    Array.from(new Set(sportFiltered.map(w => w.category).filter(Boolean))).sort()
  , [sportFiltered])

  const librarySubTypes = useMemo(() => {
    if (!filterType) return []
    return Array.from(new Set(sportFiltered.filter(w =>
      w.category === filterType
    ).map(w => w.type).filter(Boolean))).sort()
  }, [sportFiltered, filterType])

  const displayWorkout = selectedWorkout ?? (entry.workout ? {
    name: entry.workout,
    reason: entry.reason ?? '',
    instructions: entry.instructions ?? '',
    energySystem: entry.energySystem ?? '',
    hrZone: entry.hrZone ? `Zone ${entry.hrZone}` : '',
    type: entry.runType ?? '',
  } as LibraryWorkout : null)

  function handleSave() {
    onSave({
      dayType: dayType as PlannedWorkout['dayType'],
      runType: runType || null,
      workout: displayWorkout?.name ?? null,
      distance: distance ? parseFloat(distance) : null,
      hrZone: displayWorkout?.hrZone ? parseInt(displayWorkout.hrZone.replace('Zone ', '')) : null,
      energySystem: displayWorkout?.energySystem ?? null,
      reason: displayWorkout?.reason ?? null,
      instructions: displayWorkout?.instructions ?? null,
      notes: notes || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
      <div className="bg-white w-full rounded-t-3xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{fmtDay(entry.date)} · {fmt(entry.date)}</div>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">Edit Day</h2>
          </div>
          <button onClick={onCancel} className="p-1 text-gray-400"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-4 flex flex-col gap-4">
          {/* Day type */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Day Type</div>
            <div className="flex gap-2 flex-wrap">
              {DAY_TYPES.map(t => (
                <button key={t} onClick={() => { setDayType(t); setRunType(''); setSelectedWorkout(null) }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${dayType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Run type (only for Run days) */}
          {dayType === 'Run' && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Run Type</div>
              <div className="flex gap-2 flex-wrap">
                {RUN_TYPES.map(t => (
                  <button key={t} onClick={() => {
                    setRunType(t)
                    setFilterType(library.some(w => w.sport === 'Run' && w.category === t) ? t : '')
                    setFilterSubType('')
                    setSelectedWorkout(null)
                  }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${runType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Workout picker (not for Rest) */}
          {dayType !== 'Rest' && (
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Workout</div>
              {displayWorkout && !showPicker ? (
                <button onClick={() => setShowPicker(true)}
                  className="w-full text-left bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-blue-800">{displayWorkout.name}</div>
                    {displayWorkout.reason && <div className="text-xs text-blue-600 mt-0.5 leading-snug">{displayWorkout.reason}</div>}
                  </div>
                  <ChevronDown size={16} className="text-blue-400 mt-0.5 shrink-0" />
                </button>
              ) : (
                <div className="border border-gray-200 rounded-2xl overflow-hidden">
                  {/* Category filter row */}
                  <div className="flex gap-1.5 p-2 overflow-x-auto bg-gray-50 border-b border-gray-100">
                    <button onClick={() => { setFilterType(''); setFilterSubType('') }}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${filterType === '' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                      All
                    </button>
                    {libraryTypes.map(t => (
                      <button key={t} onClick={() => { setFilterType(t); setFilterSubType('') }}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${filterType === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  {/* Sub-type filter row — shown when a category is selected and has multiple types */}
                  {librarySubTypes.length > 1 && (
                    <div className="flex gap-1.5 p-2 overflow-x-auto bg-gray-50 border-b border-gray-100">
                      <button onClick={() => setFilterSubType('')}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${filterSubType === '' ? 'bg-gray-700 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                        All types
                      </button>
                      {librarySubTypes.map(t => (
                        <button key={t} onClick={() => setFilterSubType(t)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${filterSubType === t ? 'bg-gray-700 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Workout list */}
                  <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                    {pickerRows.length === 0 ? (
                      <div className="text-xs text-gray-400 p-4 text-center">No workouts found</div>
                    ) : pickerRows.map((w, i) => {
                      if (!w.variation) {
                        return (
                          <button key={`${w.name}-${i}`} onClick={() => { setSelectedWorkout(w); setShowPicker(false); if (!runType && w.type) setRunType(w.type) }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100 transition-colors">
                            <div className="text-sm font-semibold text-gray-800">{w.name}</div>
                            {w.reason && <div className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">{w.reason}</div>}
                          </button>
                        )
                      }
                      // Variation family — show family header + expandable progressions
                      const progressions = filteredLibrary
                        .filter(v => v.variation === w.variation)
                        .sort((a, b) => (a.progression ?? 0) - (b.progression ?? 0))
                      const isExpanded = expandedVariation === w.variation
                      return (
                        <div key={`var-${w.variation}-${i}`}>
                          <button
                            onClick={() => setExpandedVariation(isExpanded ? null : w.variation)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="text-sm font-semibold text-gray-800">{w.variation}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{progressions.length} progressions</div>
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">{isExpanded ? '▴' : '▾'}</span>
                          </button>
                          {isExpanded && progressions.map((v, j) => (
                            <button
                              key={`${v.name}-${j}`}
                              onClick={() => { setSelectedWorkout(v); setShowPicker(false); setExpandedVariation(null); if (!runType && v.type) setRunType(v.type) }}
                              className="w-full text-left px-6 py-2.5 bg-gray-50 hover:bg-blue-50 active:bg-blue-100 transition-colors border-t border-gray-100"
                            >
                              <div className="text-sm font-semibold text-gray-700">
                                P{v.progression ?? j + 1} — {v.name}
                              </div>
                              {v.reason && <div className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">{v.reason}</div>}
                            </button>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Distance */}
          {dayType !== 'Rest' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Distance (mi) — optional</span>
              <input type="number" step="0.1" value={distance} onChange={e => setDistance(e.target.value)}
                placeholder="e.g. 6"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
            </label>
          )}

          {/* Notes */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</span>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Anything specific for this day..."
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none" />
          </label>
        </div>

        <div className="px-6 pb-8 pt-2 shrink-0 border-t border-gray-100">
          <button onClick={handleSave} disabled={isPending}
            className="w-full bg-blue-600 text-white rounded-2xl py-3 text-sm font-bold disabled:opacity-40 active:bg-blue-700">
            {isPending ? 'Saving…' : 'Save Day'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export default function PlanClient({ plan, phases, races, library, today }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'plan' | 'phases' | 'races'>('plan')
  const [propagateOffer, setPropagateOffer] = useState<{
    workout: string | null
    dayName: string
    phaseName: string
    dates: string[]
    fields: Partial<PlannedWorkout>
  } | null>(null)
  const [showRaceForm, setShowRaceForm] = useState(false)
  const [editingRace, setEditingRace] = useState<Race | null>(null)
  const [raceForm, setRaceForm] = useState({ name: '', date: '', distance: '', grade: 'A' as 'A' | 'B' | 'C', location: '', notes: '' })
  const [phaseModal, setPhaseModal] = useState<{ open: boolean; editing: Phase | null }>({ open: false, editing: null })
  const [dayEditing, setDayEditing] = useState<PlannedWorkout | null>(null)
  const [isPending, startTransition] = useTransition()

  // Week navigation — grouped by calendar week (Mon–Sun) so races and manually
  // added days with Week#=0 don't collapse everything into "Week 1"
  const weeks = useMemo(() => {
    const map = new Map<string, PlannedWorkout[]>()
    for (const e of plan) {
      const d = new Date(e.date + 'T00:00:00')
      const day = d.getDay() // 0=Sun
      const mon = new Date(d)
      mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      const key = mon.toISOString().slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, entries]) => {
        const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
        return sorted
      })
      .filter(entries => !entries.every(e => !e.phase))
      .map((entries, idx) => {
        const weekNum = entries.find(e => e.week > 0)?.week ?? (idx + 1)
        return { weekNum, entries }
      })
  }, [plan])

  const initialWeekIdx = useMemo(() => {
    const idx = weeks.findIndex(w => w.entries.some(e => e.date === today))
    if (idx !== -1) return idx
    const futureIdx = weeks.findIndex(w => (w.entries[0]?.date ?? '') > today)
    return Math.max(0, futureIdx === -1 ? 0 : futureIdx)
  }, [weeks, today])

  const [weekIdx, setWeekIdx] = useState(initialWeekIdx)

  const { weekNum, entries: weekEntries } = weeks[weekIdx] ?? { weekNum: 1, entries: [] as PlannedWorkout[] }
  const phase = phases.find(p => weekEntries.some(e => e.phase === p.name)) ?? phases[0]
  const totalMiles = weekEntries.reduce((s, e) => s + (e.distance ?? 0), 0)
  const weekStart = weekEntries[0]?.date ?? ''
  const weekEnd = weekEntries[weekEntries.length - 1]?.date ?? ''

  const sortedRaces = useMemo(() => [...races].sort((a, b) => a.date.localeCompare(b.date)), [races])

  // Build chronological timeline for Phases tab — A/B races are separate items, C races inline
  const phaseTimeline = useMemo((): TimelineItem[] => {
    const sortedPhases = [...phases].sort((a, b) => a.startDate.localeCompare(b.startDate))
    const abRaces = sortedRaces.filter(r => r.grade !== 'C')
    const cRaces = sortedRaces.filter(r => r.grade === 'C')

    const items: TimelineItem[] = [
      ...sortedPhases.map(p => ({
        kind: 'phase' as const,
        phase: p,
        cRaces: cRaces.filter(r => r.date >= p.startDate && r.date <= p.endDate),
      })),
      ...abRaces.map(r => ({ kind: 'race' as const, race: r })),
    ]

    return items.sort((a, b) => {
      const dateA = a.kind === 'phase' ? a.phase.startDate : a.race.date
      const dateB = b.kind === 'phase' ? b.phase.startDate : b.race.date
      return dateA.localeCompare(dateB)
    })
  }, [phases, sortedRaces])

  // Phase actions
  function handleSavePhase(form: PhaseForm) {
    startTransition(async () => {
      if (phaseModal.editing) {
        await updatePhase(phaseModal.editing.name, form)
      } else {
        await createPhase(form)
      }
      setPhaseModal({ open: false, editing: null })
      router.refresh()
    })
  }

  function handleDeletePhase(p: Phase) {
    if (!confirm(`Delete phase "${p.name}"? This will also remove all planned days in this phase.`)) return
    startTransition(async () => {
      await deletePhase(p.name, p.startDate, p.endDate)
      router.refresh()
    })
  }

  function handleSetupDays(p: Phase) {
    const start = new Date(p.startDate + 'T00:00:00')
    const end = new Date(p.endDate + 'T00:00:00')
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const existingInRange = plan.filter(e => e.date >= p.startDate && e.date <= p.endDate)
    const msg = existingInRange.length > 0
      ? `This will overwrite ${existingInRange.length} existing day(s) in "${p.name}" (${fmt(p.startDate)} – ${fmt(p.endDate)}) with blank Rest days. Continue?`
      : `Create ${days} blank days for "${p.name}" (${fmt(p.startDate)} – ${fmt(p.endDate)})?`
    if (!confirm(msg)) return
    startTransition(async () => {
      await setupPhaseDays(p.name, p.startDate, p.endDate, 1)
      router.refresh()
    })
  }

  function handleSaveDay(fields: Partial<PlannedWorkout>) {
    if (!dayEditing) return
    const entry = dayEditing
    const propagateDates = (fields.dayType !== 'Rest' && fields.dayType !== 'Race')
      ? plan.filter(e => e.day === entry.day && e.phase === entry.phase && e.date !== entry.date).map(e => e.date)
      : []
    startTransition(async () => {
      await savePlanDay({
        date: entry.date,
        week: entry.week,
        phase: entry.phase,
        dayType: fields.dayType ?? entry.dayType,
        runType: fields.runType ?? undefined,
        workout: fields.workout ?? undefined,
        distance: fields.distance ?? null,
        hrZone: fields.hrZone ?? null,
        energySystem: fields.energySystem ?? undefined,
        reason: fields.reason ?? undefined,
        instructions: fields.instructions ?? undefined,
        notes: fields.notes ?? undefined,
      })
      setDayEditing(null)
      router.refresh()
      if (propagateDates.length > 0) {
        setPropagateOffer({ workout: fields.workout ?? null, dayName: entry.day, phaseName: entry.phase, dates: propagateDates, fields })
      }
    })
  }

  function handlePropagate() {
    if (!propagateOffer) return
    const { fields, dates } = propagateOffer
    startTransition(async () => {
      await applyWorkoutToWeekday({
        dates,
        dayType: fields.dayType ?? 'Run',
        runType: fields.runType ?? undefined,
        workout: fields.workout ?? undefined,
        distance: fields.distance ?? null,
        hrZone: fields.hrZone ?? null,
        energySystem: fields.energySystem ?? undefined,
        reason: fields.reason ?? undefined,
        instructions: fields.instructions ?? undefined,
        notes: fields.notes ?? undefined,
      })
      setPropagateOffer(null)
      router.refresh()
    })
  }

  function openAddRace() {
    setEditingRace(null)
    setRaceForm({ name: '', date: '', distance: '', grade: 'A', location: '', notes: '' })
    setShowRaceForm(true)
  }

  function openEditRace(r: Race) {
    setEditingRace(r)
    setRaceForm({ name: r.name, date: r.date, distance: r.distance, grade: r.grade, location: r.location, notes: r.notes ?? '' })
    setShowRaceForm(true)
  }

  function handleSaveRace() {
    if (!raceForm.name || !raceForm.date || !raceForm.distance) return
    startTransition(async () => {
      if (editingRace) {
        await updateRace({ name: editingRace.name, date: editingRace.date }, raceForm)
      } else {
        await addRace(raceForm)
      }
      setShowRaceForm(false)
      setEditingRace(null)
      router.refresh()
    })
  }

  function handleDeleteRace(r: Race) {
    if (!confirm(`Delete "${r.name}"?`)) return
    startTransition(async () => {
      await deleteRace(r.name, r.date)
      router.refresh()
    })
  }

  const TAB_LABELS: Record<'plan' | 'phases' | 'races', string> = {
    plan: 'Weeks',
    phases: 'Phases',
    races: 'Races',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-100 px-4 pt-10 bg-white sticky top-0 z-10">
        {(['plan', 'phases', 'races'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── Phases tab ── */}
      {tab === 'phases' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{phases.length} phase{phases.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setPhaseModal({ open: true, editing: null })}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-blue-700">
              <Plus size={15} /> Add Phase
            </button>
          </div>

          {phases.length === 0 && races.filter(r => r.grade !== 'C').length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-16">
              <p className="font-semibold mb-1">No phases yet</p>
              <p>Add your first phase to start building the plan.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {phaseTimeline.map((item, idx) => {
                if (item.kind === 'race') {
                  const r = item.race
                  const daysOut = Math.ceil((new Date(r.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
                  const isPast = daysOut <= 0
                  return (
                    <div key={`race-${r.date}-${r.name}`}
                      className={`rounded-2xl border-2 p-4 ${r.grade === 'A' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'} ${isPast ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Flag size={14} className={r.grade === 'A' ? 'text-red-500' : 'text-orange-400'} />
                            <span className="font-bold text-gray-900">{r.name}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.grade === 'A' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                              {r.grade}-race
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 ml-5">
                            {fmt(r.date)} · {r.distance}{r.location ? ` · ${r.location}` : ''}
                          </div>
                          {r.notes && <div className="text-xs text-gray-600 mt-1.5 ml-5 italic leading-relaxed">{r.notes}</div>}
                        </div>
                        <div className="shrink-0 text-right">
                          {!isPast && <div className="text-sm font-bold text-blue-600">{daysOut}d</div>}
                          {isPast && <div className="text-xs text-gray-300">past</div>}
                        </div>
                      </div>
                    </div>
                  )
                }

                const p = item.phase
                const isPast = p.endDate < today
                const days = Math.round((new Date(p.endDate + 'T00:00:00').getTime() - new Date(p.startDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)) + 1
                return (
                  <div key={`phase-${p.name}-${idx}`} className={`bg-white rounded-2xl border shadow-sm p-4 ${isPast ? 'border-gray-100 opacity-50' : 'border-gray-100'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-base">{p.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{fmt(p.startDate)} – {fmt(p.endDate)} · {p.weeks} weeks · {days} days</div>
                        {p.goal && <div className="text-sm text-gray-600 mt-1.5 leading-relaxed">{p.goal}</div>}
                        {item.cRaces.length > 0 && (
                          <div className="mt-3 flex flex-col gap-2">
                            {item.cRaces.map(r => {
                              const daysOut = Math.ceil((new Date(r.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
                              return (
                                <div key={r.date} className="rounded-xl px-3 py-2 flex items-center gap-2 bg-gray-50 border border-gray-100">
                                  <Flag size={12} className="text-gray-400" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-gray-700">{r.name}</div>
                                    <div className="text-xs text-gray-400">{fmt(r.date)} · {r.distance}</div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <div className="text-xs font-bold text-gray-400">C-race</div>
                                    {daysOut > 0 && <div className="text-xs text-blue-500">{daysOut}d</div>}
                                    {daysOut <= 0 && <div className="text-xs text-gray-300">past</div>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                        <button onClick={() => handleSetupDays(p)} disabled={isPending}
                          className="mt-2 text-xs font-semibold text-blue-600 active:text-blue-800 disabled:opacity-40">
                          Set up days →
                        </button>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setPhaseModal({ open: true, editing: p })}
                          className="p-2 rounded-xl text-gray-400 active:bg-gray-100">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDeletePhase(p)}
                          className="p-2 rounded-xl text-red-400 active:bg-red-50">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Weeks tab ── */}
      {tab === 'plan' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
          {weeks.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-16">
              <p className="font-semibold mb-1">No plan yet</p>
              <p>Add phases first, then tap days to add workouts.</p>
              <button onClick={() => setTab('phases')} className="mt-4 text-blue-600 font-semibold text-sm">
                Go to Phases →
              </button>
            </div>
          ) : (
            <>
              {/* Week nav */}
              <div className="flex items-center justify-between mb-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-2 py-2">
                <button onClick={() => setWeekIdx(i => i - 1)} disabled={weekIdx === 0}
                  className="p-2 rounded-xl touch-manipulation disabled:opacity-30 text-gray-500 active:bg-gray-100">
                  <ChevronLeft size={20} />
                </button>
                <div className="text-center">
                  <div className="text-sm font-bold text-gray-900">Week {weekNum}</div>
                  <div className="text-xs text-gray-400">{weekStart && `${fmt(weekStart)} – ${fmt(weekEnd)}`}</div>
                </div>
                <button onClick={() => setWeekIdx(i => i + 1)} disabled={weekIdx >= weeks.length - 1}
                  className="p-2 rounded-xl touch-manipulation disabled:opacity-30 text-gray-500 active:bg-gray-100">
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Phase + volume */}
              {phase && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 mb-4">
                  <div className="text-xs font-bold text-blue-600 tracking-wide mb-0.5">{phase.name.toUpperCase()}</div>
                  <div className="text-sm text-gray-600">{phase.goal}</div>
                  {totalMiles > 0 && <div className="text-xs text-gray-400 mt-1">{totalMiles.toFixed(1)} mi planned this week</div>}
                </div>
              )}

              {/* Days */}
              <div className="flex flex-col gap-2">
                {weekEntries.map((entry, i) => {
                  const isToday = entry.date === today
                  const isEmpty = entry.dayType === 'Rest' && !entry.workout
                  const isRace = entry.dayType === 'Race'
                  const raceInfo = isRace ? races.find(r => r.date === entry.date) : null

                  if (isRace) {
                    return (
                      <button key={`${entry.date}-${i}`} onClick={() => setDayEditing(entry)}
                        className={`rounded-2xl border-2 shadow-sm p-4 text-left w-full active:opacity-80 ${raceInfo?.grade === 'A' ? 'bg-red-50 border-red-300' : raceInfo?.grade === 'B' ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-bold text-gray-400 w-7">{fmtDay(entry.date)}</div>
                            <Flag size={14} className={raceInfo?.grade === 'A' ? 'text-red-500' : raceInfo?.grade === 'B' ? 'text-orange-400' : 'text-gray-400'} />
                            <div className="font-bold text-gray-900 text-sm">{entry.workout ?? 'Race'}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {raceInfo && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${raceInfo.grade === 'A' ? 'bg-red-100 text-red-700' : raceInfo.grade === 'B' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{raceInfo.grade}-race</span>}
                            <Pencil size={13} className="text-gray-300 shrink-0" />
                          </div>
                        </div>
                        <div className="ml-9 mt-1.5 flex flex-col gap-1">
                          {raceInfo && (
                            <div className="text-xs text-gray-500">
                              {raceInfo.distance}{raceInfo.location ? ` · ${raceInfo.location}` : ''}
                            </div>
                          )}
                          {entry.reason && <div className="text-xs text-gray-500 leading-relaxed">{entry.reason}</div>}
                          {raceInfo?.notes && <div className="text-xs text-gray-600 italic leading-relaxed">{raceInfo.notes}</div>}
                          {entry.instructions && <div className="text-xs text-gray-500 leading-relaxed">{entry.instructions}</div>}
                        </div>
                      </button>
                    )
                  }

                  return (
                    <button key={`${entry.date}-${i}`} onClick={() => setDayEditing(entry)}
                      className={`bg-white rounded-2xl border shadow-sm p-4 text-left w-full active:bg-gray-50 ${isToday ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-100'}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-bold text-gray-400 w-7">{fmtDay(entry.date)}</div>
                          <div className={`text-sm font-bold ${isEmpty ? 'text-gray-300' : 'text-gray-900'}`}>
                            {entry.workout ?? (entry.dayType === 'Rest' ? 'Rest' : entry.runType ?? entry.dayType)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isEmpty && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${dayTypeBg(entry)}`}>
                              {entry.runType ?? entry.dayType}
                            </span>
                          )}
                          <Pencil size={13} className="text-gray-300 shrink-0" />
                        </div>
                      </div>
                      {entry.dayType !== 'Rest' && (
                        <div className="flex gap-3 text-xs text-gray-400 ml-9">
                          {entry.distance && <span>{entry.distance} mi</span>}
                          {entry.hrZone && <span>Zone {entry.hrZone}</span>}
                          {entry.intensity && <span>{entry.intensity}</span>}
                        </div>
                      )}
                      {entry.reason && (
                        <div className="text-xs text-gray-500 mt-2 ml-9 leading-relaxed line-clamp-2">{entry.reason}</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Races tab ── */}
      {tab === 'races' && (
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">{races.length} race{races.length !== 1 ? 's' : ''}</p>
            <button onClick={openAddRace}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-blue-700">
              <Plus size={15} /> Add Race
            </button>
          </div>

          {races.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-16">
              <p className="font-semibold mb-1">No races yet</p>
              <p>Add your target race to anchor the plan.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedRaces.map(r => {
                const daysOut = Math.ceil((new Date(r.date + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
                const isPast = daysOut <= 0
                return (
                  <div key={`${r.name}-${r.date}`} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 ${isPast ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Flag size={13} className={r.grade === 'A' ? 'text-red-500' : r.grade === 'B' ? 'text-orange-400' : 'text-gray-400'} />
                          <span className="font-bold text-gray-900">{r.name}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.grade === 'A' ? 'bg-red-50 text-red-600' : r.grade === 'B' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>{r.grade}-race</span>
                        </div>
                        <div className="text-xs text-gray-400 ml-5">{fmt(r.date)} · {r.distance}{r.location ? ` · ${r.location}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!isPast && <span className="text-sm font-bold text-blue-600">{daysOut}d</span>}
                        <button onClick={() => openEditRace(r)} className="p-1.5 rounded-xl text-gray-400 active:bg-gray-100">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDeleteRace(r)} className="p-1.5 rounded-xl text-red-400 active:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {r.notes && <p className="text-xs text-gray-500 mt-2 ml-5">{r.notes}</p>}
                  </div>
                )
              })}
            </div>
          )}

          {/* Add/edit race form */}
          {showRaceForm && (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
              <div className="bg-white w-full rounded-t-3xl p-6 pb-10 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold text-gray-900">{editingRace ? 'Edit Race' : 'Add Race'}</h2>
                  <button onClick={() => { setShowRaceForm(false); setEditingRace(null) }} className="p-1 text-gray-400"><X size={20} /></button>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Race Name</span>
                  <input value={raceForm.name} onChange={e => setRaceForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Boston Marathon"
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
                </label>

                <div className="flex gap-3">
                  <label className="flex flex-col gap-1 flex-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</span>
                    <input type="date" value={raceForm.date} onChange={e => setRaceForm(f => ({ ...f, date: e.target.value }))}
                      className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
                  </label>
                  <label className="flex flex-col gap-1 flex-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Distance</span>
                    <input value={raceForm.distance} onChange={e => setRaceForm(f => ({ ...f, distance: e.target.value }))}
                      placeholder="Marathon"
                      className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
                  </label>
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Race Grade</div>
                  <div className="flex gap-2">
                    {([['A', 'Target race'], ['B', 'Tune-up'], ['C', 'Training race']] as const).map(([g, label]) => (
                      <button key={g} onClick={() => setRaceForm(f => ({ ...f, grade: g }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${raceForm.grade === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                        <div>{g}</div>
                        <div className="text-xs font-normal opacity-70">{label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location <span className="text-gray-300 normal-case font-normal">optional</span></span>
                  <input value={raceForm.location} onChange={e => setRaceForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Boston, MA"
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes <span className="text-gray-300 normal-case font-normal">optional</span></span>
                  <textarea value={raceForm.notes} onChange={e => setRaceForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                    placeholder="Goals, context, what this race means..."
                    className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none" />
                </label>

                <button onClick={handleSaveRace} disabled={isPending || !raceForm.name || !raceForm.date || !raceForm.distance}
                  className="bg-blue-600 text-white rounded-2xl py-3 text-sm font-bold disabled:opacity-40 active:bg-blue-700">
                  {isPending ? 'Saving…' : editingRace ? 'Save Race' : 'Add Race'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {phaseModal.open && (
        <PhaseModal
          initial={phaseModal.editing
            ? { name: phaseModal.editing.name, startDate: phaseModal.editing.startDate, endDate: phaseModal.editing.endDate, goal: phaseModal.editing.goal }
            : emptyPhaseForm()
          }
          onSave={handleSavePhase}
          onCancel={() => setPhaseModal({ open: false, editing: null })}
          isPending={isPending}
        />
      )}

      {dayEditing && (
        <DayEditor
          entry={dayEditing}
          library={library}
          onSave={handleSaveDay}
          onCancel={() => setDayEditing(null)}
          isPending={isPending}
        />
      )}

      {propagateOffer && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-4">
          <div className="bg-gray-900 text-white rounded-2xl p-4 shadow-xl">
            <div className="text-sm font-semibold mb-0.5">
              Apply to all {propagateOffer.dayName}s in {propagateOffer.phaseName}?
            </div>
            <div className="text-xs text-gray-400 mb-3">
              {propagateOffer.workout ?? 'This workout'} · {propagateOffer.dates.length} other day{propagateOffer.dates.length !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPropagateOffer(null)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-gray-700 text-gray-300 active:bg-gray-600">
                Skip
              </button>
              <button onClick={handlePropagate} disabled={isPending}
                className="flex-1 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white active:bg-blue-500 disabled:opacity-40">
                {isPending ? 'Applying…' : `Apply to ${propagateOffer.dates.length} days →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

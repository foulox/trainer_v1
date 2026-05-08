'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, X, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { LibraryWorkout } from '@/lib/data'
import { RACE_TYPES, TRAINING_PHASES, ABBREVIATIONS } from '@/lib/data'
import { addLibraryWorkout, addLibraryWorkoutFamily } from '@/app/actions'
import type { InferredFields } from '@/app/api/workout/infer/route'

type Props = { library: LibraryWorkout[] }

const SPORTS = ['Run', 'Bike', 'Supplementary']
const SPORT_CATEGORIES: Record<string, string[]> = {
  Run: ['Easy', 'Long', 'Quality'],
  Bike: ['Easy', 'Quality'],
  Supplementary: ['Strength', 'Mobility', 'Cross-train'],
}
const RUN_TYPES = ['Hills', 'Broken Tempo', 'Intervals', 'Progression', 'Ladder', 'Superset', 'Straight Tempo', 'Threshold']

const chipBase = 'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors touch-manipulation'
const chipBlue = 'bg-blue-600 text-white border-blue-600'
const chipDark = 'bg-gray-900 text-white border-gray-900'
const chipOff = 'bg-white text-gray-600 border-gray-200'

const phaseColors: Record<string, string> = {
  Base: 'bg-blue-100 text-blue-700',
  Build: 'bg-amber-100 text-amber-700',
  Peak: 'bg-red-100 text-red-700',
  Taper: 'bg-green-100 text-green-700',
}

function toggle(list: string[], item: string) {
  return list.includes(item) ? list.filter(x => x !== item) : [...list, item]
}

type AddStep = 'entry' | 'loading' | 'review'

type EntryData = {
  name: string
  sport: string
  category: string
  type: string
  instructions: string
  reason: string
  route: string
}

function AddWorkoutModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [step, setStep] = useState<AddStep>('entry')
  const [entry, setEntry] = useState<EntryData>({
    name: '', sport: 'Run', category: 'Easy', type: '', instructions: '', reason: '', route: '',
  })
  const [review, setReview] = useState<InferredFields | null>(null)
  const [isFamily, setIsFamily] = useState(false)
  const [variations, setVariations] = useState<string[]>(['', ''])
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const categories = SPORT_CATEGORIES[entry.sport] ?? ['General']
  const showTypeChips = entry.sport === 'Run'

  async function handleEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setStep('loading')
    try {
      const res = await fetch('/api/workout/infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      if (!res.ok) throw new Error('Inference failed')
      const inferred: InferredFields = await res.json()
      setReview(inferred)
      setStep('review')
    } catch (err) {
      setError(`Could not infer fields: ${err instanceof Error ? err.message : String(err)}`)
      setStep('entry')
    }
  }

  function buildInput() {
    return {
      name: entry.name,
      sport: entry.sport,
      category: entry.category,
      type: entry.type,
      reason: entry.reason,
      instructions: entry.instructions,
      distTime: review!.distTime,
      lapStructure: review!.lapStructure,
      energySystem: review!.energySystem,
      hrZone: review!.hrZone,
      rpe: review!.rpe,
      coachingNotes: review!.coachingNotes,
      mapLink: entry.route,
      author: review!.author,
      raceTypes: review!.raceTypes,
      trainingPhases: review!.trainingPhases,
    }
  }

  function handleSave() {
    if (!review) return
    setError('')
    startTransition(async () => {
      try {
        const input = buildInput()
        if (isFamily) {
          const filled = variations.filter(v => v.trim())
          if (filled.length === 0) { setError('Add at least one variation description.'); return }
          await addLibraryWorkoutFamily(input, filled)
        } else {
          await addLibraryWorkout(input)
        }
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  function setVariation(i: number, val: string) {
    setVariations(vs => vs.map((v, idx) => idx === i ? val : v))
  }

  if (step === 'loading') {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
        <div className="bg-white w-full rounded-t-3xl p-6 pb-10 flex flex-col items-center gap-4 min-h-40">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mt-6" />
          <p className="text-sm text-gray-500">Analyzing workout...</p>
        </div>
      </div>
    )
  }

  if (step === 'review' && review) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
        <div className="bg-white w-full rounded-t-3xl pb-10 flex flex-col max-h-[92vh]">
          <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Review & Confirm</h2>
              <p className="text-xs text-gray-500 mt-0.5">AI pre-filled — adjust anything before saving.</p>
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 touch-manipulation"><X size={20} /></button>
          </div>

          <div className="overflow-y-auto px-6 flex-1">
            <div className="bg-gray-50 rounded-2xl p-4 mb-5 border border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Workout</p>
              <p className="font-semibold text-gray-900">{entry.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{entry.sport} · {entry.category} · {entry.type}</p>
            </div>

            <ReviewField label="Workout type">
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsFamily(false)}
                  className={`${chipBase} ${!isFamily ? chipDark : chipOff}`}>Standalone</button>
                <button type="button" onClick={() => setIsFamily(true)}
                  className={`${chipBase} ${isFamily ? chipBlue : chipOff}`}>Progression family</button>
              </div>
            </ReviewField>

            {isFamily && (
              <ReviewField label="Variations">
                <div className="flex flex-col gap-2">
                  {variations.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-600 w-6 shrink-0">P{i + 1}</span>
                      <input
                        value={v}
                        onChange={e => setVariation(i, e.target.value)}
                        placeholder="e.g. 3×1600m@5K, r2min"
                        className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                      />
                      {variations.length > 1 && (
                        <button type="button" onClick={() => setVariations(vs => vs.filter((_, idx) => idx !== i))}
                          className="text-gray-300 hover:text-gray-500 text-lg leading-none touch-manipulation">×</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setVariations(vs => [...vs, ''])}
                    className="text-sm text-blue-600 font-semibold text-left mt-1 touch-manipulation">
                    + Add variation
                  </button>
                </div>
              </ReviewField>
            )}

            <ReviewField label="Author / Source">
              <input value={review.author} onChange={e => setReview(r => r && ({ ...r, author: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
            </ReviewField>

            <ReviewField label="Distance / Time">
              <input value={review.distTime} onChange={e => setReview(r => r && ({ ...r, distTime: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-blue-400" />
            </ReviewField>

            <ReviewField label="Lap Structure">
              <input value={review.lapStructure} onChange={e => setReview(r => r && ({ ...r, lapStructure: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
                placeholder="e.g. 3×10min@tempo r2min jog" />
            </ReviewField>

            <ReviewField label="Energy System">
              <div className="flex flex-wrap gap-2">
                {['Aerobic', 'Lactate Threshold', 'Anaerobic', 'Mixed'].map(s => (
                  <button key={s} type="button" onClick={() => setReview(r => r && ({ ...r, energySystem: s }))}
                    className={`${chipBase} ${review.energySystem === s ? chipBlue : chipOff}`}>{s}</button>
                ))}
              </div>
            </ReviewField>

            <ReviewField label="HR Zone">
              <div className="flex flex-wrap gap-2">
                {['Z2-Z3', 'Z3-Z4', 'Z4-Z5', 'Z2-Z4', 'Z3-Z5', 'Z2-Z5'].map(z => (
                  <button key={z} type="button" onClick={() => setReview(r => r && ({ ...r, hrZone: z }))}
                    className={`${chipBase} ${review.hrZone === z ? chipBlue : chipOff}`}>{z}</button>
                ))}
              </div>
            </ReviewField>

            <ReviewField label="RPE">
              <div className="flex gap-2">
                {['5', '6', '7', '8', '9', '10'].map(n => (
                  <button key={n} type="button" onClick={() => setReview(r => r && ({ ...r, rpe: n }))}
                    className={`${chipBase} ${review.rpe === n ? chipBlue : chipOff}`}>{n}</button>
                ))}
              </div>
            </ReviewField>

            <ReviewField label="Best for race">
              <div className="flex flex-wrap gap-2">
                {RACE_TYPES.map(r => (
                  <button key={r} type="button"
                    onClick={() => setReview(rv => rv && ({ ...rv, raceTypes: toggle(rv.raceTypes, r) }))}
                    className={`${chipBase} ${review.raceTypes.includes(r) ? chipDark : chipOff}`}>{r}</button>
                ))}
              </div>
            </ReviewField>

            <ReviewField label="Training phase">
              <div className="flex flex-wrap gap-2">
                {TRAINING_PHASES.map(p => (
                  <button key={p} type="button"
                    onClick={() => setReview(rv => rv && ({ ...rv, trainingPhases: toggle(rv.trainingPhases, p) }))}
                    className={`${chipBase} ${review.trainingPhases.includes(p) ? chipDark : chipOff}`}>{p}</button>
                ))}
              </div>
            </ReviewField>

            <ReviewField label="Coach notes">
              <textarea value={review.coachingNotes}
                onChange={e => setReview(r => r && ({ ...r, coachingNotes: e.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Execution cues" />
            </ReviewField>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <div className="flex gap-3 pb-2">
              <button type="button" onClick={() => setStep('entry')}
                className="flex-1 py-4 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm touch-manipulation">
                Back
              </button>
              <button type="button" onClick={handleSave} disabled={isPending}
                className="flex-[2] py-4 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-40 transition-colors touch-manipulation">
                {isPending ? 'Saving...' : isFamily ? `Save ${variations.filter(v => v.trim()).length || ''} variations` : 'Save Workout'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
      <div className="bg-white w-full rounded-t-3xl pb-10 flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Workout</h2>
            <p className="text-xs text-gray-500 mt-0.5">Fill in the basics — AI will suggest the rest.</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 touch-manipulation"><X size={20} /></button>
        </div>

        <form onSubmit={handleEntry} className="overflow-y-auto px-6 flex-1">
          <ReviewField label="Workout Name">
            <input required value={entry.name} onChange={e => setEntry(v => ({ ...v, name: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
              placeholder="e.g. Hills 10 × 60s" />
          </ReviewField>

          <ReviewField label="Sport">
            <div className="flex gap-2">
              {SPORTS.map(s => (
                <button key={s} type="button" onClick={() => setEntry(v => ({
                  ...v, sport: s, category: SPORT_CATEGORIES[s]?.[0] ?? '', type: '',
                }))}
                  className={`${chipBase} ${entry.sport === s ? chipBlue : chipOff}`}>{s}</button>
              ))}
            </div>
          </ReviewField>

          <ReviewField label="Category">
            <div className="flex gap-2 flex-wrap">
              {categories.map(c => (
                <button key={c} type="button" onClick={() => setEntry(v => ({ ...v, category: c }))}
                  className={`${chipBase} ${entry.category === c ? chipDark : chipOff}`}>{c}</button>
              ))}
            </div>
          </ReviewField>

          <ReviewField label="Type">
            {showTypeChips ? (
              <div className="flex flex-wrap gap-2">
                {RUN_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => setEntry(v => ({ ...v, type: t }))}
                    className={`${chipBase} ${entry.type === t ? chipBlue : chipOff}`}>{t}</button>
                ))}
              </div>
            ) : (
              <input value={entry.type} onChange={e => setEntry(v => ({ ...v, type: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
                placeholder="e.g. Endurance, Recovery" />
            )}
          </ReviewField>

          <ReviewField label="Instructions">
            <textarea required value={entry.instructions} onChange={e => setEntry(v => ({ ...v, instructions: e.target.value }))}
              rows={4}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
              placeholder="WU: 15 min easy. Main: 10×60s@5K, r=jog down. CD: 10 min easy." />
          </ReviewField>

          <ReviewField label="Why this workout?">
            <textarea value={entry.reason} onChange={e => setEntry(v => ({ ...v, reason: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
              placeholder="Brief description of the purpose" />
          </ReviewField>

          <ReviewField label="Route (optional)">
            <input value={entry.route} onChange={e => setEntry(v => ({ ...v, route: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-blue-400"
              placeholder="e.g. strava.com/routes/..." />
          </ReviewField>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <button type="submit" disabled={!entry.category}
            className="w-full py-4 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-40 transition-colors touch-manipulation mb-2">
            Next →
          </button>
        </form>
      </div>
    </div>
  )
}

function ReviewField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function WorkoutCard({ w }: { w: LibraryWorkout }) {
  const [expanded, setExpanded] = useState(false)
  const [showCoach, setShowCoach] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-4 touch-manipulation">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-900 text-sm">{w.name}</div>
            <div className="flex gap-2 mt-1 flex-wrap items-center">
              {w.type && <span className="text-xs text-gray-400">{w.type}</span>}
              {w.distTime && <span className="text-xs text-gray-400">· {w.distTime}</span>}
              {w.hrZone && <span className="text-xs text-gray-400">· {w.hrZone}</span>}
              {w.rpe && <span className="text-xs text-gray-400">· RPE {w.rpe}</span>}
            </div>
            {w.raceTypes.length > 0 && (
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {w.raceTypes.map(r => (
                  <span key={r} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500 font-medium">{r}</span>
                ))}
              </div>
            )}
          </div>
          {expanded
            ? <ChevronUp size={16} className="text-gray-300 shrink-0 mt-0.5" />
            : <ChevronDown size={16} className="text-gray-300 shrink-0 mt-0.5" />}
        </div>
        {!expanded && w.reason && (
          <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-2">{w.reason}</p>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-gray-50 pt-3">
          {w.reason && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Purpose</div>
              <p className="text-sm text-gray-700 leading-relaxed">{w.reason}</p>
            </div>
          )}
          {w.instructions && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Instructions</div>
              <p className="text-sm text-gray-700 leading-relaxed">{w.instructions}</p>
            </div>
          )}
          {w.lapStructure && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Lap Structure</div>
              <p className="text-sm text-gray-700">{w.lapStructure}</p>
            </div>
          )}

          <div className="flex gap-4 flex-wrap">
            {w.energySystem && <div><span className="text-xs text-gray-400">Energy </span><span className="text-xs font-semibold text-gray-700">{w.energySystem}</span></div>}
            {w.rpe && <div><span className="text-xs text-gray-400">RPE </span><span className="text-xs font-semibold text-gray-700">{w.rpe}</span></div>}
            {w.hrZone && <div><span className="text-xs text-gray-400">HR </span><span className="text-xs font-semibold text-gray-700">{w.hrZone}</span></div>}
          </div>

          {w.trainingPhases.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {w.trainingPhases.map(p => (
                <span key={p} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${phaseColors[p] ?? 'bg-gray-100 text-gray-600'}`}>{p}</span>
              ))}
            </div>
          )}

          {w.mapLink && (
            <a href={w.mapLink} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 font-semibold">View Route →</a>
          )}

          {w.coachingNotes && (
            <div>
              <button onClick={() => setShowCoach(c => !c)}
                className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1 touch-manipulation">
                Coach notes {showCoach ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {showCoach && <p className="text-sm text-gray-600 leading-relaxed mt-1">{w.coachingNotes}</p>}
            </div>
          )}

          {w.author && (
            <p className="text-xs text-gray-400 italic">{w.author}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function LibraryClient({ library }: Props) {
  const [search, setSearch] = useState('')
  const [activeSport, setActiveSport] = useState('Run')
  const [activeCategory, setActiveCategory] = useState('All')
  const [activeRaceType, setActiveRaceType] = useState('All')
  const [showAbbrev, setShowAbbrev] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const categories = useMemo(() => {
    const base = activeSport === 'All'
      ? library
      : library.filter(w => w.sport === activeSport)
    return ['All', ...Array.from(new Set(base.map(w => w.category).filter(Boolean))).sort()]
  }, [library, activeSport])

  const filtered = useMemo(() => {
    return library.filter(w => {
      if (activeSport !== 'All' && w.sport !== activeSport) return false
      if (activeCategory !== 'All' && w.category !== activeCategory) return false
      if (activeRaceType !== 'All' && !w.raceTypes.includes(activeRaceType)) return false
      if (search) {
        const q = search.toLowerCase()
        if (!w.name.toLowerCase().includes(q) && !w.reason.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [library, activeSport, activeCategory, activeRaceType, search])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-10 pb-3 bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-gray-900">Library</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowAbbrev(s => !s)}
              className="p-2 text-gray-400 touch-manipulation">
              <HelpCircle size={18} />
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-blue-700 touch-manipulation">
              <Plus size={15} /> Add
            </button>
          </div>
        </div>

        {showAbbrev && (
          <div className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {ABBREVIATIONS.map(a => (
                <div key={a.abbr} className="flex gap-2 text-xs">
                  <span className="font-bold text-gray-700 shrink-0 w-14">{a.abbr}</span>
                  <span className="text-gray-500">{a.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search workouts..."
            className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-1 focus:ring-blue-300 transition-all"
          />
        </div>

        {/* Sport filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['All', ...SPORTS].map(s => (
            <button key={s} onClick={() => { setActiveSport(s); setActiveCategory('All') }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors touch-manipulation ${activeSport === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Category filter */}
        {categories.length > 2 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mt-2 scrollbar-none">
            {categories.map(c => (
              <button key={c} onClick={() => setActiveCategory(c)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors touch-manipulation ${activeCategory === c ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Race type filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 mt-2 scrollbar-none">
          {['All', ...RACE_TYPES].map(r => (
            <button key={r} onClick={() => setActiveRaceType(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors touch-manipulation ${activeRaceType === r ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {r === 'All' ? 'Any race' : r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 flex flex-col gap-2">
        {library.length === 0 ? (
          <div className="text-center text-gray-400 text-sm mt-16">
            <p className="font-semibold mb-1">Library not connected</p>
            <p>Add LIBRARY_SHEETS_URL to your environment variables.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-400 text-sm mt-16">No workouts match</div>
        ) : (
          filtered.map((w, i) => <WorkoutCard key={`${w.name}-${i}`} w={w} />)
        )}
        <p className="text-center text-xs text-gray-300 mt-2">{filtered.length} workout{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {showAdd && <AddWorkoutModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}

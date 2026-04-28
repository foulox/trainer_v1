'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import type { LibraryWorkout } from '@/lib/data'
import { addLibraryWorkout } from '@/app/actions'

type Props = { library: LibraryWorkout[] }

const SPORTS = ['Run', 'Bike', 'Supplementary']
const CATEGORIES: Record<string, string[]> = {
  Run: ['Easy', 'Long', 'Quality'],
  Bike: ['Easy', 'Quality'],
  Supplementary: ['Strength', 'Mobility', 'Cross-train'],
}

function AddWorkoutModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [sport, setSport] = useState('Run')
  const [form, setForm] = useState({ name: '', category: 'Easy', type: '', reason: '', instructions: '', distTime: '' })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const categories = CATEGORIES[sport] ?? ['General']

  function handleSave() {
    if (!form.name) return
    startTransition(async () => {
      await addLibraryWorkout({ sport, ...form })
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
      <div className="bg-white w-full rounded-t-3xl p-6 pb-10 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-gray-900">Add Workout</h2>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Workout Name</span>
          <input value={form.name} onChange={set('name')} placeholder="Easy Recovery Run"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
        </label>

        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sport</div>
          <div className="flex gap-2">
            {SPORTS.map(s => (
              <button key={s} onClick={() => { setSport(s); setForm(f => ({ ...f, category: CATEGORIES[s]?.[0] ?? '' })) }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${sport === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Category</div>
          <div className="flex gap-2 flex-wrap">
            {categories.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, category: c }))}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${form.category === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type <span className="text-gray-300 normal-case font-normal">e.g. Recovery, Tempo, Progression</span></span>
          <input value={form.type} onChange={set('type')} placeholder="Recovery"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dist / Time <span className="text-gray-300 normal-case font-normal">optional</span></span>
          <input value={form.distTime} onChange={set('distTime')} placeholder="30–60 min or 4–8 mi"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Purpose</span>
          <textarea value={form.reason} onChange={set('reason')} rows={2}
            placeholder="Why this workout — what it builds"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Instructions <span className="text-gray-300 normal-case font-normal">optional</span></span>
          <textarea value={form.instructions} onChange={set('instructions')} rows={2}
            placeholder="How to execute"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none" />
        </label>

        <button onClick={handleSave} disabled={isPending || !form.name}
          className="bg-blue-600 text-white rounded-2xl py-3 text-sm font-bold disabled:opacity-40 active:bg-blue-700">
          {isPending ? 'Saving…' : 'Add to Library'}
        </button>
      </div>
    </div>
  )
}

function WorkoutCard({ w }: { w: LibraryWorkout }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-900 text-sm">{w.name}</div>
            <div className="flex gap-2 mt-1 flex-wrap">
              {w.type && <span className="text-xs text-gray-400">{w.type}</span>}
              {w.distTime && <span className="text-xs text-gray-400">· {w.distTime}</span>}
              {w.hrZone && <span className="text-xs text-gray-400">· {w.hrZone}</span>}
            </div>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-300 shrink-0 mt-0.5" /> : <ChevronDown size={16} className="text-gray-300 shrink-0 mt-0.5" />}
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
          <div className="flex gap-4 flex-wrap">
            {w.energySystem && <div><span className="text-xs text-gray-400">Energy System </span><span className="text-xs font-semibold text-gray-700">{w.energySystem}</span></div>}
            {w.rpe && <div><span className="text-xs text-gray-400">RPE </span><span className="text-xs font-semibold text-gray-700">{w.rpe}</span></div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function LibraryClient({ library }: Props) {
  const [search, setSearch] = useState('')
  const [activeSport, setActiveSport] = useState('All')
  const [activeType, setActiveType] = useState('All')
  const [showAdd, setShowAdd] = useState(false)

  const sports = useMemo(() =>
    ['All', ...Array.from(new Set(library.map(w => w.sport).filter(Boolean))).sort()]
  , [library])

  const types = useMemo(() => {
    const filtered = activeSport === 'All' ? library : library.filter(w => w.sport === activeSport)
    return ['All', ...Array.from(new Set(filtered.map(w => w.type).filter(Boolean))).sort()]
  }, [library, activeSport])

  const filtered = useMemo(() => {
    return library.filter(w => {
      if (activeSport !== 'All' && w.sport !== activeSport) return false
      if (activeType !== 'All' && w.type !== activeType) return false
      if (search && !w.name.toLowerCase().includes(search.toLowerCase()) &&
          !w.reason.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [library, activeSport, activeType, search])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-10 pb-3 bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-gray-900">Library</h1>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl active:bg-blue-700">
            <Plus size={15} /> Add
          </button>
        </div>

        {/* Search */}
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
          {sports.map(s => (
            <button key={s} onClick={() => { setActiveSport(s); setActiveType('All') }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${activeSport === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Type filter */}
        {types.length > 2 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mt-2 scrollbar-none">
            {types.map(t => (
              <button key={t} onClick={() => setActiveType(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${activeType === t ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {t}
              </button>
            ))}
          </div>
        )}
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

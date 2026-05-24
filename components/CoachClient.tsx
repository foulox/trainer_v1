'use client'

import { useState, useTransition } from 'react'
import { Flag, X, Plus } from 'lucide-react'
import type { CoachProfile } from '@/lib/data'
import { saveCoachProfile } from '@/app/actions'
import FeedbackDrawer from './FeedbackDrawer'

const EMPTY_PROFILE: CoachProfile = {
  name: '',
  philosophy: '',
  influences: [],
  credentials: '',
  updatedAt: '',
}

export default function CoachClient({ initialProfile }: { initialProfile: CoachProfile | null }) {
  const [profile, setProfile] = useState<CoachProfile>(initialProfile ?? EMPTY_PROFILE)
  const [newInfluence, setNewInfluence] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  function addInfluence() {
    const name = newInfluence.trim()
    if (!name || profile.influences.includes(name)) return
    setProfile(p => ({ ...p, influences: [...p.influences, name] }))
    setNewInfluence('')
  }

  function removeInfluence(name: string) {
    setProfile(p => ({ ...p, influences: p.influences.filter(i => i !== name) }))
  }

  function handleSave() {
    setSaved(false)
    setError(null)
    startTransition(async () => {
      const result = await saveCoachProfile(profile)
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(result.error ?? 'Something went wrong')
      }
    })
  }

  return (
    <>
      <div className="px-4 pt-6 pb-8 space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Coach</h1>

        {/* Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={profile.name}
            onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
            placeholder="Your name"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Philosophy */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Your coaching philosophy</label>
          <textarea
            value={profile.philosophy}
            onChange={e => setProfile(p => ({ ...p, philosophy: e.target.value }))}
            placeholder="What do you believe about training?"
            rows={5}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none resize-none"
          />
        </div>

        {/* Influences */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Coaching influences</label>
          {profile.influences.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profile.influences.map(name => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
                >
                  {name}
                  <button
                    onClick={() => removeInfluence(name)}
                    className="text-blue-400 hover:text-blue-600 ml-0.5"
                    aria-label={`Remove ${name}`}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={newInfluence}
              onChange={e => setNewInfluence(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addInfluence()}
              placeholder="e.g. Jack Daniels"
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={addInfluence}
              disabled={!newInfluence.trim()}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              <Plus size={15} />
              Add
            </button>
          </div>
        </div>

        {/* Credentials */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Credentials</label>
          <input
            type="text"
            value={profile.credentials}
            onChange={e => setProfile(p => ({ ...p, credentials: e.target.value }))}
            placeholder="e.g. RRCA Level 1 Certified Running Coach"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save Profile'}
        </button>

        {error && (
          <p className="text-sm text-red-600 text-center">{error}</p>
        )}

        {/* Feedback */}
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={() => setFeedbackOpen(true)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600"
          >
            <Flag size={15} />
            Give feedback
          </button>
        </div>
      </div>

      <FeedbackDrawer open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  )
}

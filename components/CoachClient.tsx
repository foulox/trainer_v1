'use client'

import { useState, useTransition } from 'react'
import { Flag, X, Plus, Trash2 } from 'lucide-react'
import type { CoachProfile, PlaybookQuote } from '@/lib/data'
import { saveCoachProfile, removePlaybookQuote } from '@/app/actions'
import FeedbackDrawer from './FeedbackDrawer'
import PlaybookQuoteDrawer from './PlaybookQuoteDrawer'

const EMPTY_PROFILE: CoachProfile = {
  name: '',
  philosophy: '',
  influences: [],
  credentials: '',
  updatedAt: '',
}

type Tab = 'profile' | 'playbook'

type Props = {
  initialProfile: CoachProfile | null
  initialQuotes: PlaybookQuote[]
}

export default function CoachClient({ initialProfile, initialQuotes }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [profile, setProfile] = useState<CoachProfile>(initialProfile ?? EMPTY_PROFILE)
  const [newInfluence, setNewInfluence] = useState('')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [quoteDrawerOpen, setQuoteDrawerOpen] = useState(false)
  const [quotes, setQuotes] = useState<PlaybookQuote[]>(initialQuotes)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
    setSaveError(null)
    startTransition(async () => {
      const result = await saveCoachProfile(profile)
      if (result.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setSaveError(result.error ?? 'Something went wrong')
      }
    })
  }

  function handleQuoteSaved(quote: PlaybookQuote) {
    setQuotes(q => [quote, ...q])
  }

  function handleDeleteQuote(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      const result = await removePlaybookQuote(id)
      if (result.success) {
        setQuotes(q => q.filter(quote => quote.id !== id))
      }
      setDeletingId(null)
    })
  }

  return (
    <>
      <div className="px-4 pt-6 pb-8">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Coach</h1>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {(['profile', 'playbook'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
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

            <button
              onClick={handleSave}
              disabled={isPending}
              className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save Profile'}
            </button>

            {saveError && <p className="text-sm text-red-600 text-center">{saveError}</p>}

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
        )}

        {/* Playbook tab */}
        {activeTab === 'playbook' && (
          <div className="space-y-4">
            <button
              onClick={() => setQuoteDrawerOpen(true)}
              className="w-full rounded-lg border-2 border-dashed border-gray-200 py-3 text-sm font-medium text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
            >
              + Add Quote
            </button>

            {quotes.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-10">
                Your Playbook is empty. Add the first quote that shaped how you coach.
              </p>
            ) : (
              <div className="space-y-4">
                {quotes.map(q => (
                  <div key={q.id} className="rounded-xl bg-white border border-gray-100 p-4 shadow-sm space-y-2">
                    <p className="text-sm text-gray-800 italic leading-relaxed">
                      &ldquo;{q.quote}&rdquo;
                    </p>
                    <p className="text-xs text-gray-500 font-medium">
                      {q.author}; {q.source}
                    </p>
                    {q.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {q.tags.map(tag => (
                          <span
                            key={tag}
                            className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {q.note && (
                      <p className="text-xs text-gray-400 border-t border-gray-50 pt-2">{q.note}</p>
                    )}
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleDeleteQuote(q.id)}
                        disabled={deletingId === q.id}
                        className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40"
                        aria-label="Delete quote"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {quoteDrawerOpen && (
        <PlaybookQuoteDrawer
          onClose={() => setQuoteDrawerOpen(false)}
          onSaved={handleQuoteSaved}
        />
      )}

      <FeedbackDrawer open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  )
}

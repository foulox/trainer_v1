'use client'

import { useState, useTransition } from 'react'
import { X } from 'lucide-react'
import { PLAYBOOK_TAGS, type PlaybookQuote, type PlaybookTag } from '@/lib/data'
import { addPlaybookQuote } from '@/app/actions'

type Props = {
  onClose: () => void
  onSaved: (quote: PlaybookQuote) => void
}

const EMPTY = { quote: '', author: '', source: '', tags: [] as PlaybookTag[], note: '' }

export default function PlaybookQuoteDrawer({ onClose, onSaved }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleTag(tag: PlaybookTag) {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }))
  }

  function canSave() {
    return form.quote.trim() && form.author.trim() && form.source.trim()
  }

  function handleSave() {
    if (!canSave()) return
    setError(null)
    startTransition(async () => {
      const result = await addPlaybookQuote(form)
      if (result.success && result.quote) {
        onSaved(result.quote)
        onClose()
      } else {
        setError(result.error ?? 'Something went wrong')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-4 pt-3 pb-10 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Add to Playbook</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Quote */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Quote</label>
            <textarea
              value={form.quote}
              onChange={e => setForm(f => ({ ...f, quote: e.target.value }))}
              placeholder="Paste or type the quote..."
              rows={4}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Author */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Author</label>
            <input
              type="text"
              value={form.author}
              onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
              placeholder="e.g. Jack Daniels"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Source */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Source</label>
            <input
              type="text"
              value={form.source}
              onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              placeholder="e.g. Daniels Running Formula, 3rd Ed."
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Topic tags</label>
            <div className="flex flex-wrap gap-2">
              {PLAYBOOK_TAGS.map(tag => {
                const selected = form.tags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      selected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Your note</label>
            <textarea
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Why does this belong in your Playbook? What does it change about how you coach?"
              rows={3}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleSave}
            disabled={!canSave() || isPending}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-40 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save Quote'}
          </button>
        </div>
      </div>
    </div>
  )
}

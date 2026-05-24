'use client'

import { useState, useTransition, useRef } from 'react'
import { X, Camera } from 'lucide-react'
import { PLAYBOOK_TAGS, type PlaybookQuote, type PlaybookTag } from '@/lib/data'
import { addPlaybookQuote, extractQuoteFromImage } from '@/app/actions'

type Props = {
  onClose: () => void
  onSaved: (quote: PlaybookQuote) => void
}

const EMPTY = { quote: '', author: '', source: '', tags: [] as PlaybookTag[], note: '' }

async function resizeImage(file: File, maxPx = 1200): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' })
    }
    img.onerror = reject
    img.src = url
  })
}

export default function PlaybookQuoteDrawer({ onClose, onSaved }: Props) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toggleTag(tag: PlaybookTag) {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }))
  }

  function canSave() {
    return form.quote.trim() && form.author.trim() && form.source.trim()
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setExtracting(true)
    try {
      const { base64, mimeType } = await resizeImage(file)
      const result = await extractQuoteFromImage(base64, mimeType)
      if (result.text) {
        setForm(f => ({ ...f, quote: result.text! }))
      } else {
        setError(result.error ?? 'Could not extract text — try typing it manually')
      }
    } catch {
      setError('Could not read photo — try typing the quote manually')
    } finally {
      setExtracting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Quote</label>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-40"
              >
                <Camera size={14} />
                {extracting ? 'Reading photo…' : 'From photo'}
              </button>
            </div>
            <textarea
              value={form.quote}
              onChange={e => setForm(f => ({ ...f, quote: e.target.value }))}
              placeholder={extracting ? 'Reading your photo…' : 'Paste or type the quote...'}
              rows={4}
              disabled={extracting}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none resize-none disabled:bg-gray-50"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
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
            disabled={!canSave() || isPending || extracting}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white disabled:opacity-40 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save Quote'}
          </button>
        </div>
      </div>
    </div>
  )
}

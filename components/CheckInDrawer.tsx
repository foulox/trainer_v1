'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Send } from 'lucide-react'
import type { CheckInMessage, CheckIn, PlannedWorkout, HealthEntry, Phase, Race } from '@/lib/data'
import { sendCheckInAction } from '@/app/actions'

type Props = {
  date: string
  workout: PlannedWorkout | null
  health: HealthEntry | null
  phase: Phase | null
  race: Race | null
  initialCheckIn: CheckIn | null
  onClose: () => void
  onCoachingNoteUpdated?: () => void
}

function buildWorkoutSummary(
  workout: PlannedWorkout | null,
  health: HealthEntry | null,
  phase: Phase | null,
  race: Race | null,
): string {
  const lines = [
    workout
      ? `Planned workout: ${workout.workout ?? workout.runType ?? workout.dayType}${workout.distance ? ` — ${workout.distance} mi` : ''}${workout.hrZone ? ` Zone ${workout.hrZone}` : ''}`
      : 'No workout planned today.',
    workout?.reason ? `Purpose: ${workout.reason}` : '',
    phase ? `Current phase: ${phase.name} — ${phase.goal}` : '',
    race ? `Next race: ${race.name} on ${race.date}` : '',
    health
      ? `Health today: HRV ${health.hrv != null ? Math.round(health.hrv) : '—'} ms | Resting HR ${health.restingHr ?? '—'} bpm | Sleep ${health.sleepScore ?? '—'}/1000`
      : '',
  ]
  return lines.filter(Boolean).join('\n')
}

export default function CheckInDrawer({
  date, workout, health, phase, race, initialCheckIn, onClose,
}: Props) {
  const [messages, setMessages] = useState<CheckInMessage[]>(initialCheckIn?.messages ?? [])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const workoutContext = buildWorkoutSummary(workout, health, phase, race)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')

    const userMsg: CheckInMessage = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setSending(true)

    try {
      const result = await sendCheckInAction(date, next, workoutContext)
      if (result) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.reply }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40">
      <div className="bg-white rounded-t-3xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div>
            <div className="text-sm font-bold text-gray-900">Check In with Coach</div>
            <div className="text-xs text-gray-400 mt-0.5">Ask anything about today's training</div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={20} /></button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="text-xs text-gray-400 italic text-center pt-4">
              Ask the coach anything — should I run today, is my knee okay to push, planning a bike instead...
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-900 rounded-bl-sm'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-gray-400 italic">
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-8 pt-3 border-t border-gray-100 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              className="flex-1 border border-gray-200 rounded-2xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none leading-snug"
              placeholder="Type a message..."
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="p-2.5 bg-blue-600 text-white rounded-full disabled:opacity-40 shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

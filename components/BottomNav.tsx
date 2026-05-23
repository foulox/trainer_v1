'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sun, CalendarDays, BarChart2, BookOpen, Flag } from 'lucide-react'
import FeedbackDrawer from './FeedbackDrawer'

const tabs = [
  { href: '/',        label: 'Today',   icon: Sun },
  { href: '/week',    label: 'Week',    icon: BarChart2 },
  { href: '/plan',    label: 'Plan',    icon: CalendarDays },
  { href: '/library', label: 'Library', icon: BookOpen },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex safe-area-inset-bottom">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${active ? 'text-blue-600' : 'text-gray-400'}`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.75} />
              {label}
            </Link>
          )
        })}
        <button
          onClick={() => setFeedbackOpen(true)}
          className="flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium text-gray-400 transition-colors hover:text-gray-600"
        >
          <Flag size={22} strokeWidth={1.75} />
          Feedback
        </button>
      </nav>

      <FeedbackDrawer open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  )
}

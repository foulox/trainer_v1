import { NextResponse } from 'next/server'
import { syncStravaActivities } from '@/lib/strava'

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await syncStravaActivities()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('Strava sync error:', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const secret = process.env.HEALTH_SYNC_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: Record<string, unknown>
  try {
    const raw = await req.text()
    console.log('[health] headers:', Object.fromEntries(req.headers.entries()))
    console.log('[health] body:', raw)
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const date = typeof body.date === 'string' ? body.date : today

  const data: Record<string, unknown> = {
    'Date':                date,
    'Resting HR':          body.restingHr        ?? '',
    'HRV (ms)':            body.hrv              ?? '',
    'Respiratory Rate':    body.respiratoryRate  ?? '',
    'Sleep Hours':         body.sleepHours       ?? '',
    'Cardio Recovery':     body.cardioRecovery   ?? '',
    'VO2 Max':             body.vo2max           ?? '',
    'Weight (lbs)':        body.weight           ?? '',
    'Water (oz)':          body.water            ?? '',
  }

  try {
    const res = await fetch(process.env.DATA_SHEETS_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'appendHealth', data }),
      cache: 'no-store',
    })
    const result = await res.json() as { ok: boolean; error?: string }
    if (!result.ok) throw new Error(result.error ?? 'Sheet write failed')
    return NextResponse.json({ ok: true, date })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

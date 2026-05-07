import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

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

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const date = typeof body.date === 'string' ? body.date : today

  // Use || '' (not ??) for fields where 0 is never a valid reading —
  // the Shortcut sends 0 when no Health sample exists for that day.
  function val(v: unknown) { return v || '' }

  const data: Record<string, unknown> = {
    'Date':                date,
    'Resting HR':          val(body.restingHR  ?? body.restingHr),
    'HRV (ms)':            val(body.hrv),
    'Sleep Quality':       body.sleepScore     ?? body.sleep ?? '',
    'Respiratory Rate':    val(body.respiratoryRate),
    'Wrist Temp (°F)':     val(body.wristTemp),
    'Active Calories':     val(body.activeCalories),
    'Cardio Recovery':     val(body.cardioRecovery),
    'VO2 Max':             val(body.vo2max),
    'Weight (lbs)':        val(body.weight),
    'Water':               val(body.water),
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
    revalidatePath('/')
    return NextResponse.json({ ok: true, date })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

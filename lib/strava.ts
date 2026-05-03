import { fetchPlanData } from './sheets'

type StravaApiActivity = {
  id: number
  name: string
  sport_type: string
  type: string
  distance: number
  moving_time: number
  elapsed_time: number
  average_speed: number
  average_heartrate?: number
  max_heartrate?: number
  calories?: number
  total_elevation_gain: number
  start_date_local: string
  description?: string | null
  perceived_exertion?: number | null
}

function toPace(metersPerSec: number): string | null {
  if (!metersPerSec) return null
  const minPerMile = 1609.344 / metersPerSec / 60
  const mins = Math.floor(minPerMile)
  const secs = Math.round((minPerMile - mins) * 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

type ZoneBucket = { time: number }
type ZoneData = { type: string; distribution_buckets: ZoneBucket[] }

async function fetchZones(
  accessToken: string,
  activityId: number
): Promise<[number, number, number, number, number]> {
  try {
    const res = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/zones`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    )
    const data = await res.json() as ZoneData[]
    const hr = Array.isArray(data) ? data.find(z => z.type === 'heartrate') : null
    if (!hr?.distribution_buckets?.length) return [0, 0, 0, 0, 0]
    const mins = hr.distribution_buckets.map(b => Math.round(b.time / 60))
    while (mins.length < 5) mins.push(0)
    return [mins[0], mins[1], mins[2], mins[3], mins[4]]
  } catch {
    return [0, 0, 0, 0, 0]
  }
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: process.env.STRAVA_REFRESH_TOKEN,
    }),
    cache: 'no-store',
  })
  const data = await res.json() as { access_token?: string; message?: string }
  if (!data.access_token) throw new Error(`Strava auth failed: ${data.message ?? 'unknown'}`)
  return data.access_token
}

export type SyncResult = { added: number; updated: number; skipped: number; errors: number }

export async function syncStravaActivities(daysBack = 14): Promise<SyncResult> {
  const [accessToken, { plan }] = await Promise.all([
    getAccessToken(),
    fetchPlanData(),
  ])

  const planByDate = new Map(plan.map(p => [p.date, p]))

  const after = Math.floor(Date.now() / 1000) - daysBack * 24 * 60 * 60
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=50`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
  )
  const activities = await res.json() as StravaApiActivity[]

  if (!Array.isArray(activities)) {
    throw new Error('Unexpected Strava response: ' + JSON.stringify(activities).slice(0, 200))
  }

  let added = 0, updated = 0, skipped = 0, errors = 0

  for (const act of activities) {
    try {
      const date = act.start_date_local.slice(0, 10)
      const actType = act.sport_type || act.type
      const isRun = /run/i.test(actType)
      const distMi = Math.round((act.distance / 1609.344) * 100) / 100
      const movingMin = Math.round(act.moving_time / 60 * 10) / 10
      const elapsedMin = Math.round(act.elapsed_time / 60 * 10) / 10
      const elevFt = act.total_elevation_gain ? Math.round(act.total_elevation_gain * 3.28084) : null
      const pace = isRun && act.average_speed ? toPace(act.average_speed) : null

      const stravaRow = {
        'Activity ID': String(act.id),
        'Date': date,
        'Name': act.name,
        'Type': actType,
        'Distance (mi)': distMi,
        'Moving Time (min)': movingMin,
        'Elapsed Time (min)': elapsedMin,
        'Avg Pace (min/mi)': pace ?? '',
        'Avg HR': act.average_heartrate ?? '',
        'Max HR': act.max_heartrate ?? '',
        'Calories': act.calories ?? '',
        'Elevation (ft)': elevFt ?? '',
        'Start Time': act.start_date_local,
        'Description': act.description ?? '',
        'Strava URL': `https://www.strava.com/activities/${act.id}`,
      }

      const dataRes = await fetch(process.env.DATA_SHEETS_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'appendStrava', data: stravaRow }),
        cache: 'no-store',
      })
      const dataResult = await dataRes.json() as { ok: boolean; skipped?: boolean; updated?: boolean }

      if (dataResult.updated) {
        // Activity already logged — just sync description and RPE changes
        await fetch(process.env.LOG_SHEETS_URL!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'updateLog',
            data: {
              'Strava ID': String(act.id),
              'Post-Run Feel': act.description ?? '',
              'RPE': act.perceived_exertion ?? '',
            },
          }),
          cache: 'no-store',
        })
        updated++
        continue
      }

      if (dataResult.skipped) { skipped++; continue }

      const zones = act.average_heartrate
        ? await fetchZones(accessToken, act.id)
        : ([0, 0, 0, 0, 0] as [number, number, number, number, number])

      const planDay = planByDate.get(date)
      const logRow = {
        'Date': date,
        'Day': planDay?.day ?? '',
        'Week#': planDay?.week ?? '',
        'Phase': planDay?.phase ?? '',
        'Activity Type': actType,
        'Source': 'Strava',
        'Distance (mi)': distMi,
        'Duration (min)': movingMin,
        'Pace (min/mi)': pace ?? '',
        'Avg HR': act.average_heartrate ?? '',
        'Max HR': act.max_heartrate ?? '',
        'Elevation (ft)': elevFt ?? '',
        'RPE': act.perceived_exertion ?? '',
        'Effort Feel': '',
        'Post-Run Feel': act.description ?? '',
        'Strava ID': String(act.id),
        'Injury / Body Notes': '',
        'Notes': '',
        'Zone1 (min)': zones[0],
        'Zone2 (min)': zones[1],
        'Zone3 (min)': zones[2],
        'Zone4 (min)': zones[3],
        'Zone5 (min)': zones[4],
      }

      await fetch(process.env.LOG_SHEETS_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'appendLog', data: logRow }),
        cache: 'no-store',
      })

      added++
    } catch (e) {
      console.error('Error syncing activity', act.id, e)
      errors++
    }
  }

  return { added, updated, skipped, errors }
}

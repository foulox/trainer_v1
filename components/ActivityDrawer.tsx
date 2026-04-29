'use client'

import type { TrainingLogEntry, StravaActivity } from '@/lib/data'

const ZONES = [
  { label: 'Recovery',  bg: 'bg-gray-300',   bar: 'bg-gray-300' },
  { label: 'Endurance', bg: 'bg-blue-400',   bar: 'bg-blue-400' },
  { label: 'Aerobic',   bg: 'bg-green-400',  bar: 'bg-green-400' },
  { label: 'Threshold', bg: 'bg-amber-400',  bar: 'bg-amber-400' },
  { label: 'Anaerobic', bg: 'bg-red-400',    bar: 'bg-red-400' },
]

type Props = {
  log: TrainingLogEntry
  stravaActivities: StravaActivity[]
  onClose: () => void
}

export default function ActivityDrawer({ log, stravaActivities, onClose }: Props) {
  const act = log.stravaId ? stravaActivities.find(a => a.activityId === log.stravaId) : null
  const name = act?.name ?? log.activityType

  const zones = [log.zone1 ?? 0, log.zone2 ?? 0, log.zone3 ?? 0, log.zone4 ?? 0, log.zone5 ?? 0]
  const totalZoneMin = zones.reduce((s, v) => s + v, 0)
  const hasZones = totalZoneMin > 0

  const stats: { label: string; value: string | number }[] = []
  if (log.distance)   stats.push({ label: 'miles',   value: log.distance })
  if (log.duration)   stats.push({ label: 'min',      value: log.duration })
  if (log.pace)       stats.push({ label: '/mi',      value: log.pace })
  if (log.avgHr)      stats.push({ label: 'avg HR',   value: log.avgHr })
  if (log.maxHr)      stats.push({ label: 'max HR',   value: log.maxHr })
  if (log.elevation)  stats.push({ label: 'elev ft',  value: log.elevation })
  if (act?.calories)  stats.push({ label: 'cal',      value: act.calories })

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl px-4 pt-3 pb-10 shadow-xl max-h-[88vh] overflow-y-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        <div className="mb-5">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
            {log.activityType}
          </div>
          <div className="text-xl font-bold text-gray-900">{name}</div>
          <div className="text-sm text-gray-400">
            {new Date(log.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long', month: 'short', day: 'numeric',
            })}
          </div>
        </div>

        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            {stats.map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {hasZones && (
          <div className="mb-5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              HR Zones
            </div>
            <div className="flex h-2 rounded-full overflow-hidden gap-px mb-3">
              {zones.map((z, i) =>
                z > 0 ? (
                  <div
                    key={i}
                    className={ZONES[i].bg}
                    style={{ width: `${(z / totalZoneMin) * 100}%` }}
                  />
                ) : null
              )}
            </div>
            <div className="flex flex-col gap-2">
              {zones.map((z, i) =>
                z > 0 ? (
                  <div key={i} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${ZONES[i].bg}`} />
                    <div className="text-xs text-gray-500 w-20">Z{i + 1} {ZONES[i].label}</div>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`${ZONES[i].bar} h-full rounded-full`}
                        style={{ width: `${(z / totalZoneMin) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs font-semibold text-gray-700 w-10 text-right">
                      {z}m
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}

        {(log.postRunFeel || log.notes) && (
          <div className="mb-5">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</div>
            {log.postRunFeel && (
              <p className="text-sm text-gray-700 leading-relaxed">{log.postRunFeel}</p>
            )}
            {log.notes && (
              <p className="text-sm text-gray-500 leading-relaxed mt-1">{log.notes}</p>
            )}
          </div>
        )}

        {act?.stravaUrl && (
          <a
            href={act.stravaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm text-orange-500 font-semibold py-3 rounded-xl border border-orange-200 bg-orange-50"
          >
            View on Strava →
          </a>
        )}
      </div>
    </div>
  )
}

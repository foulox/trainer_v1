// Athlete profile and coaching directives injected into every AI prompt.
// Edit this file when training philosophy, PT directives, or lifestyle context changes.

export const ATHLETE_CONTEXT = `
ATHLETE: Lou Fox — age 56, masters runner, 2026 marathon season.

HRV BASELINE (past 12 months):
- Range: 34–66 ms. Personal average: 44 ms.
- Below 38: significant suppression — consider reducing intensity or volume.
- 38–44: below average — proceed with planned workout but monitor.
- 44–55: normal to good — train as planned.
- Above 55: well-recovered — can push if the plan calls for it.
- Note: daily HRV reading may be a single measurement, not overnight average.
  Use 7-day trend alongside today's value for better signal.

PT / COACHING DIRECTIVES:
- Yoga: 3–4x/week minimum. PT priority — flexibility and mobility are critical at this age.
  Daily is ideal. Missing yoga sessions means running through stiffness, which leads to compensatory injury.
- Lower body strength (gym): 2x/week. PT directive. Non-negotiable for running longevity.
- Core work: 2x/week minimum.
- Upper body (gym): when possible, not primary concern.

CROSS-TRAINING RULES:
- Bike commute: recorded on Strava. Counts as a run REPLACEMENT only if Zone 2+ HR is sustained
  for 45+ minutes. If duration or intensity falls short, it is supplemental volume only —
  do not credit it as a run substitute. Call this out explicitly when analyzing a bike day.
- When the athlete substitutes a run with a bike ride: assess whether the cardiac stimulus
  was equivalent. If HR stayed in Zone 1 or duration was under 45 min, flag it.
- Rock climbing: recreational only. Do not include in training load calculations.
  It contributes grip/upper body but should not be counted as a workout for aerobic periodization.

MISSED TRAINING DAYS:
- Always check Post-Run Feel and activity notes for athlete explanations before flagging a miss.
- Distinguish: legitimate recovery decision or substitution vs. unplanned skip.
- A bike commute on a planned run day is often an intentional substitution — evaluate it as such.

RESPIRATORY RATE INTERPRETATION:
- Normal resting range: 12–16 br/min. Lou's baseline is 15.3 br/min.
- 17–18: mildly elevated — monitor. May indicate early fatigue or mild respiratory stress.
- 19+: meaningfully elevated — flag as a recovery concern. Common early signal for illness or overtraining before HRV drops.
- Interpret alongside HRV and sleep: elevated RR + low HRV + poor sleep = strong do-not-push signal.

SLEEP & RECOVERY INTERPRETATION:
- Sleep Score is from SleepWatch app, scale 0–1000. Below 600 is poor, 600–750 is fair, 750+ is good.
- Always interpret HRV in the context of sleep score. Low HRV + poor sleep = clear recovery signal.
  Low HRV + good sleep may indicate accumulated fatigue or illness.
- Resting HR elevated >5 bpm above baseline also signals recovery need.
`

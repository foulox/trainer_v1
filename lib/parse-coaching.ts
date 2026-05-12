export type ParsedCoachingResponse = {
  verdict: string
  readinessSummary: string
  workoutSummary: string
  body: string
  readinessScore: number | undefined
  effortMode: 'rest' | 'easy' | 'moderate' | 'hard' | 'race' | undefined
  effortLabel: string | undefined
  effortReason: string | undefined
}

export function parseCoachingResponse(text: string): ParsedCoachingResponse {
  const verdictMatch = text.match(/^VERDICT:\s*(.+)/m)
  const verdict = verdictMatch ? verdictMatch[1].trim() : ''

  const readinessSummaryMatch = text.match(/## Readiness\nSUMMARY:\s*(.+)/m)
  const readinessSummary = readinessSummaryMatch ? readinessSummaryMatch[1].trim() : ''

  const workoutSummaryMatch = text.match(/## Today's Workout in Context\nSUMMARY:\s*(.+)/m)
  const workoutSummary = workoutSummaryMatch ? workoutSummaryMatch[1].trim() : ''

  // [^0-9]* skips any non-digit chars (asterisks, spaces) between the field name and the number
  const scoreMatch = text.match(/READINESS_SCORE:[^0-9]*(\d+)/m)
  const readinessScore = scoreMatch ? Math.min(10, Math.max(1, parseInt(scoreMatch[1]))) : undefined

  // [^a-zA-Z]* skips any non-letter chars between the field name and the mode word
  const modeMatch = text.match(/EFFORT_MODE:[^a-zA-Z]*([a-zA-Z]+)/m)
  const rawMode = modeMatch ? modeMatch[1].toLowerCase() : ''
  const effortMode = (['rest', 'easy', 'moderate', 'hard', 'race'] as const).includes(rawMode as never)
    ? rawMode as 'rest' | 'easy' | 'moderate' | 'hard' | 'race'
    : undefined

  // (?:\*+\s*)* skips any leading bold markers; replace strips any remaining asterisks from both ends
  const effortLabelMatch = text.match(/EFFORT_LABEL:\s*(?:\*+\s*)*(.+)/m)
  const effortLabel = effortLabelMatch ? effortLabelMatch[1].replace(/^\*+\s*/, '').replace(/\*+$/, '').trim() : undefined

  const effortReasonMatch = text.match(/EFFORT_REASON:\s*(?:\*+\s*)*(.+)/m)
  const effortReason = effortReasonMatch ? effortReasonMatch[1].replace(/^\*+\s*/, '').replace(/\*+$/, '').trim() : undefined

  const afterVerdict = text.replace(/^VERDICT:.+\n?/m, '').trim()
  const body = afterVerdict
    .replace(/^SUMMARY:.+\n?/gm, '')
    .replace(/^[\*_]*READINESS_SCORE:.+\n?/gm, '')
    .replace(/^[\*_]*EFFORT_MODE:.+\n?/gm, '')
    .replace(/^[\*_]*EFFORT_LABEL:.+\n?/gm, '')
    .replace(/^[\*_]*EFFORT_REASON:.+\n?/gm, '')
    .trim()

  return { verdict, readinessSummary, workoutSummary, body, readinessScore, effortMode, effortLabel, effortReason }
}

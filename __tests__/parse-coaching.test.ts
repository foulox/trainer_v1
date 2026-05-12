import { parseCoachingResponse } from '../lib/parse-coaching'

const CLEAN_RESPONSE = `VERDICT: HRV down 6ms from baseline — keep it easy today.

READINESS_SCORE: 6
EFFORT_MODE: easy
EFFORT_LABEL: Keep it conversational
EFFORT_REASON: HRV dip, 2-day leg heaviness

## Readiness
SUMMARY: HRV pulled back from weekly average, sleep solid — cautious day.
- HRV: 45ms vs 51ms avg — down 6ms

## Today's Workout in Context
SUMMARY: Week 3 of Base Building — aerobic mileage that future quality depends on.
- Keep effort truly easy`

// Exact format that broke production: **FIELD:** **value**
const BOLD_FIELD_AND_VALUE = `VERDICT: HRV at 45ms, easy day.

**READINESS_SCORE:** **6**
**EFFORT_MODE:** **easy**
**EFFORT_LABEL:** **Keep it conversational**
**EFFORT_REASON:** **HRV dip, leg heaviness**

## Readiness
SUMMARY: Cautious day.
- HRV suppressed

## Today's Workout in Context
SUMMARY: Base building aerobic work.
- Stay easy`

// Variation: plain field name, bold value
const BOLD_VALUE_ONLY = `VERDICT: HRV down, easy day.

READINESS_SCORE: **6**
EFFORT_MODE: **easy**
EFFORT_LABEL: **Keep it conversational**
EFFORT_REASON: **HRV dip**

## Readiness
SUMMARY: Cautious.
- HRV down

## Today's Workout in Context
SUMMARY: Aerobic base.
- Easy effort`

describe('parseCoachingResponse', () => {
  describe('clean format (no bold)', () => {
    const result = parseCoachingResponse(CLEAN_RESPONSE)

    it('parses verdict', () => {
      expect(result.verdict).toBe('HRV down 6ms from baseline — keep it easy today.')
    })

    it('parses readinessScore', () => {
      expect(result.readinessScore).toBe(6)
    })

    it('parses effortMode', () => {
      expect(result.effortMode).toBe('easy')
    })

    it('parses effortLabel', () => {
      expect(result.effortLabel).toBe('Keep it conversational')
    })

    it('parses effortReason', () => {
      expect(result.effortReason).toBe('HRV dip, 2-day leg heaviness')
    })

    it('parses readinessSummary', () => {
      expect(result.readinessSummary).toBe('HRV pulled back from weekly average, sleep solid — cautious day.')
    })

    it('parses workoutSummary', () => {
      expect(result.workoutSummary).toBe('Week 3 of Base Building — aerobic mileage that future quality depends on.')
    })

    it('strips structured fields from body', () => {
      expect(result.body).not.toMatch(/READINESS_SCORE/)
      expect(result.body).not.toMatch(/EFFORT_MODE/)
      expect(result.body).not.toMatch(/EFFORT_LABEL/)
      expect(result.body).not.toMatch(/EFFORT_REASON/)
    })
  })

  describe('bold field + bold value (**FIELD:** **value**) — the production bug', () => {
    const result = parseCoachingResponse(BOLD_FIELD_AND_VALUE)

    it('parses readinessScore', () => {
      expect(result.readinessScore).toBe(6)
    })

    it('parses effortMode', () => {
      expect(result.effortMode).toBe('easy')
    })

    it('parses effortLabel without trailing asterisks', () => {
      expect(result.effortLabel).toBe('Keep it conversational')
    })

    it('parses effortReason without trailing asterisks', () => {
      expect(result.effortReason).toBe('HRV dip, leg heaviness')
    })
  })

  describe('bold value only (FIELD: **value**)', () => {
    const result = parseCoachingResponse(BOLD_VALUE_ONLY)

    it('parses readinessScore', () => {
      expect(result.readinessScore).toBe(6)
    })

    it('parses effortMode', () => {
      expect(result.effortMode).toBe('easy')
    })
  })

  describe('edge cases', () => {
    it('clamps readinessScore below 1 up to 1', () => {
      const result = parseCoachingResponse('READINESS_SCORE: 0\nEFFORT_MODE: easy')
      expect(result.readinessScore).toBe(1)
    })

    it('clamps readinessScore above 10 down to 10', () => {
      const result = parseCoachingResponse('READINESS_SCORE: 11\nEFFORT_MODE: easy')
      expect(result.readinessScore).toBe(10)
    })

    it('returns undefined readinessScore when field is missing', () => {
      const result = parseCoachingResponse('VERDICT: something\nEFFORT_MODE: easy')
      expect(result.readinessScore).toBeUndefined()
    })

    it('returns undefined effortMode for unrecognised mode value', () => {
      const result = parseCoachingResponse('READINESS_SCORE: 5\nEFFORT_MODE: medium')
      expect(result.effortMode).toBeUndefined()
    })

    it('returns empty strings for missing verdict and summaries', () => {
      const result = parseCoachingResponse('READINESS_SCORE: 5\nEFFORT_MODE: easy')
      expect(result.verdict).toBe('')
      expect(result.readinessSummary).toBe('')
      expect(result.workoutSummary).toBe('')
    })

    it('handles all valid effort modes', () => {
      const modes = ['rest', 'easy', 'moderate', 'hard', 'race'] as const
      for (const mode of modes) {
        const result = parseCoachingResponse(`EFFORT_MODE: ${mode}`)
        expect(result.effortMode).toBe(mode)
      }
    })
  })
})

import { Split, Exercise, getRoutine } from './routines'
import { SessionRecord } from './notion'

function matchesExercise(notionName: string, routineName: string): boolean {
  return notionName === routineName
}

export interface CoachingFlag {
  exercise: string
  type: 'progress' | 'stall' | 'fatigue' | 'deload' | 'no-history' | 'recovery-hold'
  message: string
}

export interface CoachingContext {
  lastSessionDate: string | null
  lastSessionSummary: string
  trending: string[]
  watchFlags: CoachingFlag[]
  focusCue: string
  recoveryGap: number | null // days since last session
  deloadRecommended: boolean
}

export interface ExercisePlan {
  exercise: Exercise
  targetWeight: number | null
  coachingNote: string | null
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime()
  const b = new Date(dateB).getTime()
  return Math.abs(Math.round((a - b) / (1000 * 60 * 60 * 24)))
}


export function analyzeCoaching(
  split: Split,
  sessions: SessionRecord[],
  today: string
): { context: CoachingContext; plan: ExercisePlan[] } {
  const routine = getRoutine(split)
  const flags: CoachingFlag[] = []
  const trending: string[] = []
  let deloadRecommended = false

  // Recovery gap check
  let recoveryGap: number | null = null
  const lastSession = sessions[0]
  if (lastSession) {
    recoveryGap = daysBetween(today, lastSession.date)
  }

  const plan: ExercisePlan[] = routine.map(exercise => {
    const exerciseName = exercise.name

    // Gather per-exercise history across sessions
    const exerciseSessions: { date: string; sets: { weight: number; reps: number }[] }[] = []
    for (const session of sessions) {
      const match = Object.entries(session.exercises).find(([name]) =>
        matchesExercise(name, exerciseName)
      )
      if (match) {
        exerciseSessions.push({ date: session.date, sets: match[1].sets })
      }
    }

    // No history
    if (exerciseSessions.length === 0) {
      flags.push({ exercise: exerciseName, type: 'no-history', message: 'No weight logged — set your working weight today' })
      return {
        exercise: { ...exercise, name: exerciseName },
        targetWeight: null,
        coachingNote: 'No weight logged — set your working weight today',
      }
    }

    const latest = exerciseSessions[0]
    const latestWeight = latest.sets[0]?.weight ?? 0
    const latestMaxWeight = Math.max(...latest.sets.map(s => s.weight))

    // Fatigue signal: reps drop significantly within one session
    if (latest.sets.length >= 3) {
      const reps = latest.sets.map(s => s.reps).filter(r => r > 0)
      if (reps.length >= 3 && reps[0] > 0) {
        const dropRatio = reps[reps.length - 1] / reps[0]
        if (dropRatio < 0.75) {
          flags.push({
            exercise: exerciseName,
            type: 'fatigue',
            message: `Reps dropped significantly last session (${reps.join(', ')}) — possible fatigue`,
          })
        }
      }
    }

    // Check progression eligibility
    const topOfRange = exercise.repRange[1]
    let consecutiveFullSessions = 0
    for (const es of exerciseSessions) {
      const allHitTop = es.sets.every(s => s.reps >= topOfRange)
      if (allHitTop) consecutiveFullSessions++
      else break
    }

    const shouldProgress = consecutiveFullSessions >= 2
    const recoveryHold = recoveryGap !== null && recoveryGap < 3

    // Stall check: no progression in 3+ sessions
    const noProgressCount = exerciseSessions.filter(es => es.sets[0]?.weight === latestWeight).length
    if (noProgressCount >= 3 && !shouldProgress) {
      const strategies = ['Try a drop set', 'Add pause reps', 'Change grip angle', 'Consider a deload']
      const suggestion = strategies[noProgressCount % strategies.length]
      flags.push({
        exercise: exerciseName,
        type: 'stall',
        message: `Stalled for ${noProgressCount} sessions — ${suggestion}`,
      })
    }

    // Deload trigger: 4+ sessions no progression
    if (noProgressCount >= 4) {
      deloadRecommended = true
    }

    // Determine increment size for this exercise
    const increment = exercise.weightUnit === 'pins' ? 1
      : exercise.availableWeights && exercise.availableWeights.length > 0 ? null // handled per-case below
      : exerciseName.toLowerCase().includes('dumbbell') ||
        exerciseName.toLowerCase().includes('cable') ? 2.5 : 5

    // Check fatigue flag for this exercise
    const hasFatigue = flags.some(f => f.exercise === exerciseName && f.type === 'fatigue')

    let targetWeight = latestMaxWeight
    let coachingNote: string | null = null

    if (hasFatigue) {
      // Step weight down one increment — fatigue takes priority over progression
      let reducedWeight: number
      if (exercise.availableWeights && exercise.availableWeights.length > 0) {
        const prevAvailable = [...exercise.availableWeights].reverse().find(w => w < latestMaxWeight)
        reducedWeight = prevAvailable ?? latestMaxWeight
      } else {
        reducedWeight = latestMaxWeight - (increment ?? 5)
      }
      targetWeight = Math.max(reducedWeight, 0)
      coachingNote = `Reps dropped last session — reducing to ${targetWeight} lbs to recover form`
    } else if (shouldProgress && !recoveryHold) {
      // Suggest weight increase — snap to next available weight if defined, else +increment
      let nextWeight: number
      if (exercise.availableWeights && exercise.availableWeights.length > 0) {
        const nextAvailable = exercise.availableWeights.find(w => w > latestMaxWeight)
        nextWeight = nextAvailable ?? latestMaxWeight
      } else {
        nextWeight = latestMaxWeight + (increment ?? 5)
      }
      targetWeight = nextWeight
      trending.push(`${exerciseName}: ready to increase (${latestMaxWeight} → ${targetWeight} lbs)`)
      coachingNote = `Hit ${topOfRange} reps all sets × 2 sessions — increase to ${targetWeight} lbs`
    } else if (shouldProgress && recoveryHold) {
      coachingNote = `Ready to progress but recovery gap is only ${recoveryGap}d — holding weight`
      flags.push({
        exercise: exerciseName,
        type: 'recovery-hold',
        message: `Ready to progress but last session was ${recoveryGap}d ago — holding`,
      })
    }

    return {
      exercise: { ...exercise, name: exerciseName },
      targetWeight,
      coachingNote,
    }
  })

  // Build coaching context summary
  let lastSessionSummary = 'No previous session found'
  let lastSessionDate: string | null = null
  if (lastSession) {
    lastSessionDate = lastSession.date
    const exerciseCount = Object.keys(lastSession.exercises).length
    lastSessionSummary = `${exerciseCount} exercises`
  }

  // Generate focus cue
  let focusCue = 'Execute clean sets. Log everything.'
  if (deloadRecommended) {
    focusCue = 'Deload week recommended — reduce weight 40%, focus on form and range of motion'
  } else if (trending.length > 0) {
    focusCue = `Push for progression on ${trending[0].split(':')[0]}`
  } else if (flags.some(f => f.type === 'stall')) {
    const stalledEx = flags.find(f => f.type === 'stall')?.exercise
    focusCue = `Address stall on ${stalledEx} — try a technique variation`
  } else if (flags.some(f => f.type === 'fatigue')) {
    focusCue = 'Monitor fatigue — prioritize form over weight today'
  }

  const context: CoachingContext = {
    lastSessionDate,
    lastSessionSummary,
    trending,
    watchFlags: flags,
    focusCue,
    recoveryGap,
    deloadRecommended,
  }

  return { context, plan }
}

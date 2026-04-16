import { Split, Exercise, getRoutine } from './routines'
import { SessionRecord } from './notion'

// Maps canonical routine names → all known Notion aliases (case-insensitive)
const EXERCISE_ALIASES: Record<string, string[]> = {
  'Cable Pulldown (bar)': ['pulldown bar cable', 'cable pulldown', 'pulldown cable', 'lat pulldown', 'mts front pulldown'],
  'Cable Row (wide grip)': ['row cable wide grip', 'cable row wide', 'wide grip row', 'cable row wide grip'],
  'Cable Row (close grip)': ['row cable close grip', 'cable row close', 'close grip row', 'cable row close grip'],
  'Cable Curl (EZ bar)': ['cable curl (ez bar) — wide grip', 'cable curl (ez bar) — close grip', 'bicep ez bar', 'ez bar curl', 'cable curl ez bar', 'bicep curl ez bar'],
  'Rope Iso Curl From Below (single arm)': ['rope iso curl from below', 'rope iso curl', 'iso curl from below'],
  'Single-Arm Preacher Hammer Curl': ['single-arm preacher hammer curl', 'preacher hammer curl'],
  'Forearm Behind Back': ['forearm behind back'],
  'Bench Press': ['bench press', 'barbell bench press'],
  'Incline Dumbbell Press': ['incline dumbbell press', 'dumbbell incline press'],
  'Seated Cable Fly': ['seated cable fly', 'cable fly'],
  'Shoulder Press': ['shoulder press', 'overhead press', 'barbell shoulder press'],
  'Lateral Raise': ['lateral raise', 'side lateral raise'],
  'Facepull': ['facepull', 'face pull'],
  'Tricep Pushdown (rope)': ['tricep pushdown (rope)', 'tricep rope pushdown', 'rope pushdown'],
  'Single-Arm Overhead Tricep Extension (cable)': ['single-arm overhead tricep extension', 'overhead tricep extension', 'cable overhead tricep'],
  'Linear Hack Press or Squat': ['linear hack press', 'hack press', 'hack squat', 'squat'],
  'Leg Press Pendular': ['leg press', 'pendular leg press', 'leg press pendular'],
  'Leg Extension': ['leg extension'],
  'Seated Leg Curl': ['seated leg curl', 'leg curl', 'lying leg curl'],
  'Romanian Deadlift': ['romanian deadlift', 'rdl', 'dumbbell rdl'],
  'Standing Calf Raise': ['standing calf raise', 'calf raise'],
}

function normalizeExerciseName(name: string): string {
  return name.toLowerCase().trim()
}

function matchesExercise(notionName: string, routineName: string): boolean {
  const normalized = normalizeExerciseName(notionName)
  const routineNorm = normalizeExerciseName(routineName)

  // Exact match
  if (normalized === routineNorm) return true

  // Check alias map
  const aliases = EXERCISE_ALIASES[routineName]
  if (aliases) {
    for (const alias of aliases) {
      if (normalized === alias.toLowerCase() || normalized.includes(alias.toLowerCase())) return true
    }
  }

  // Fallback: routine name words all present in notion name
  const routineWords = routineNorm.replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 2)
  const matchCount = routineWords.filter(w => normalized.includes(w)).length
  return matchCount >= Math.ceil(routineWords.length * 0.7)
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
  cableRowVariant: 'wide grip' | 'close grip'
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

function totalVolume(session: SessionRecord): number {
  let vol = 0
  for (const ex of Object.values(session.exercises)) {
    for (const s of ex.sets) {
      vol += s.weight * s.reps
    }
  }
  return vol
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
  let cableRowVariant: 'wide grip' | 'close grip' = 'wide grip'

  // Recovery gap check
  let recoveryGap: number | null = null
  const lastSession = sessions[0]
  if (lastSession) {
    recoveryGap = daysBetween(today, lastSession.date)
  }

  // Pull day: Cable Row alternation
  if (split === 'Pull') {
    for (const session of sessions) {
      const keys = Object.keys(session.exercises)
      const wideFound = keys.find(k =>
        matchesExercise(k, 'Cable Row (wide grip)') && !matchesExercise(k, 'Cable Row (close grip)')
      )
      const closeFound = keys.find(k =>
        matchesExercise(k, 'Cable Row (close grip)') && !matchesExercise(k, 'Cable Row (wide grip)')
      )
      if (wideFound) { cableRowVariant = 'close grip'; break }
      if (closeFound) { cableRowVariant = 'wide grip'; break }
    }
  }

  // Volume comparison
  let volumeFlag = ''
  if (sessions.length >= 2) {
    const vol0 = totalVolume(sessions[0])
    const vol1 = totalVolume(sessions[1])
    if (vol0 < vol1 * 0.9) {
      volumeFlag = `Volume dropped vs last session (${vol0} vs ${vol1} total lbs·reps)`
    }
  }

  const plan: ExercisePlan[] = routine.map(exercise => {
    // Handle Pull day cable row swap
    let exerciseName = exercise.name
    if (split === 'Pull' && exercise.name === 'Cable Row (wide grip)') {
      exerciseName = `Cable Row (${cableRowVariant})`
    }

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

    let targetWeight = latestMaxWeight
    let coachingNote: string | null = null

    if (shouldProgress && !recoveryHold) {
      // Suggest weight increase (conservative: +5 lbs for barbells, +2.5 for dumbbells/cables)
      const increment = exerciseName.toLowerCase().includes('dumbbell') ||
                        exerciseName.toLowerCase().includes('cable') ? 2.5 : 5
      targetWeight = latestMaxWeight + increment
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
    const vol = totalVolume(lastSession)
    lastSessionSummary = `${exerciseCount} exercises · ${vol.toLocaleString()} lbs total volume`
    if (volumeFlag) {
      flags.push({ exercise: 'Session Volume', type: 'fatigue', message: volumeFlag })
    }
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
    cableRowVariant,
  }

  return { context, plan }
}

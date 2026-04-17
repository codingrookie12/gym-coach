'use client'

import { useState, useCallback } from 'react'
import HomeScreen from '@/components/screens/HomeScreen'
import CoachingContextScreen from '@/components/screens/CoachingContextScreen'
import WorkoutOverviewScreen from '@/components/screens/WorkoutOverviewScreen'
import ActiveSessionScreen from '@/components/screens/ActiveSessionScreen'
import PreSaveSummaryScreen from '@/components/screens/PreSaveSummaryScreen'
import SessionSummaryScreen from '@/components/screens/SessionSummaryScreen'
import ManageWeightsScreen from '@/components/screens/ManageWeightsScreen'
import { Split } from '@/lib/routines'
import { CoachingContext, ExercisePlan } from '@/lib/coaching'
import { SessionRecord } from '@/lib/notion'
import { ExerciseLog, SavedSnapshot } from '@/lib/store'

export type Screen =
  | 'home'
  | 'coaching-context'
  | 'workout-overview'
  | 'active-session'
  | 'pre-save'
  | 'session-summary'
  | 'manage-weights'

export interface AppState {
  split: Split | null
  coachingContext: CoachingContext | null
  plan: ExercisePlan[] | null
  sessions: SessionRecord[] | null
  exerciseLogs: ExerciseLog[]
  savedLogs: ExerciseLog[] | null
  savedExIdx: number
  savedSnapshot: SavedSnapshot
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [appState, setAppState] = useState<AppState>({
    split: null,
    coachingContext: null,
    plan: null,
    sessions: null,
    exerciseLogs: [],
    savedLogs: null,
    savedExIdx: 0,
    savedSnapshot: {},
  })

  const navigate = useCallback((to: Screen) => setScreen(to), [])

  const updateState = useCallback((partial: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...partial }))
  }, [])

  const goHome = useCallback(() => {
    setAppState({
      split: null, coachingContext: null, plan: null, sessions: null,
      exerciseLogs: [], savedLogs: null, savedExIdx: 0, savedSnapshot: {},
    })
    setScreen('home')
  }, [])

  const handleSessionBack = useCallback((
    logs: ExerciseLog[], exIdx: number, snapshot: SavedSnapshot
  ) => {
    updateState({ savedLogs: logs, savedExIdx: exIdx, savedSnapshot: snapshot })
    navigate('workout-overview')
  }, [updateState, navigate])

  const handleSessionFinish = useCallback((logs: ExerciseLog[], snapshot: SavedSnapshot) => {
    updateState({ exerciseLogs: logs, savedSnapshot: snapshot })
    navigate('pre-save')
  }, [updateState, navigate])

  // Diff-and-sync: compare confirmed logs against auto-save snapshot.
  // Changed sets → PATCH. New sets (not in snapshot) → POST. Unchanged → no-op.
  async function handleSaveSession(logs: ExerciseLog[]) {
    const today = new Date().toISOString().split('T')[0]
    const snapshot = appState.savedSnapshot

    const patchPromises: Promise<any>[] = []
    const newEntries: any[] = []

    for (const exLog of logs) {
      for (let si = 0; si < exLog.sets.length; si++) {
        const set = exLog.sets[si]
        if (!set.completed) continue

        const key = `${exLog.notionName}:${si + 1}`
        const prior = snapshot[key]

        if (prior) {
          // Check if anything changed
          const weightChanged = set.weight !== prior.weight
          const repsChanged = set.reps !== prior.reps
          const notesChanged = (exLog.notes ?? '') !== prior.notes

          if (weightChanged || repsChanged || notesChanged) {
            const changes: { weight?: number; reps?: number; notes?: string } = {}
            if (weightChanged) changes.weight = set.weight
            if (repsChanged) changes.reps = set.reps
            if (notesChanged) changes.notes = exLog.notes ?? ''

            patchPromises.push(
              fetch('/api/session/update', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageId: prior.pageId, changes }),
              })
            )
          }
          // If nothing changed — no-op, row already exists in Notion
        } else {
          // Set was added after auto-save (e.g. user added extra set in pre-save)
          newEntries.push({
            exercise: exLog.notionName,
            date: today,
            split: appState.split,
            weight: set.weight,
            set: si + 1,
            reps: set.reps,
            entry: `${exLog.notionName} — Set ${si + 1}`,
            notes: exLog.notes || undefined,
          })
        }
      }
    }

    try {
      const ops: Promise<any>[] = [...patchPromises]
      if (newEntries.length > 0) {
        ops.push(
          fetch('/api/session/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries: newEntries }),
          })
        )
      }
      await Promise.all(ops)
    } catch (e) {
      console.error('Save failed:', e)
    }

    updateState({ exerciseLogs: logs, savedLogs: null, savedExIdx: 0, savedSnapshot: {} })
    navigate('session-summary')
  }

  return (
    <div style={{ background: 'var(--bg)', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {screen === 'home' && (
        <HomeScreen
          onSelectSplit={(split) => { updateState({ split, savedLogs: null, savedExIdx: 0, savedSnapshot: {} }); navigate('coaching-context') }}
          onSettings={() => navigate('manage-weights')}
        />
      )}
      {screen === 'coaching-context' && appState.split && (
        <CoachingContextScreen
          split={appState.split}
          onDataLoaded={(context, plan, sessions) => updateState({ coachingContext: context, plan, sessions })}
          coachingContext={appState.coachingContext}
          plan={appState.plan}
          onViewPlan={() => navigate('workout-overview')}
          onBack={goHome}
        />
      )}
      {screen === 'workout-overview' && appState.plan && appState.split && (
        <WorkoutOverviewScreen
          split={appState.split}
          plan={appState.plan}
          hasResumable={!!appState.savedLogs}
          onBegin={() => { updateState({ savedLogs: null, savedExIdx: 0, savedSnapshot: {} }); navigate('active-session') }}
          onResume={() => navigate('active-session')}
          onBack={() => navigate('coaching-context')}
        />
      )}
      {screen === 'active-session' && appState.plan && appState.split && (
        <ActiveSessionScreen
          split={appState.split}
          plan={appState.plan}
          initialLogs={appState.savedLogs ?? undefined}
          initialExIdx={appState.savedExIdx}
          initialSnapshot={appState.savedSnapshot}
          onFinish={handleSessionFinish}
          onBack={handleSessionBack}
        />
      )}
      {screen === 'pre-save' && appState.plan && appState.split && (
        <PreSaveSummaryScreen
          split={appState.split}
          plan={appState.plan}
          logs={appState.exerciseLogs}
          onSave={handleSaveSession}
          onBack={() => navigate('active-session')}
        />
      )}
      {screen === 'session-summary' && appState.exerciseLogs && appState.split && appState.sessions && appState.plan && (
        <SessionSummaryScreen
          split={appState.split}
          exerciseLogs={appState.exerciseLogs}
          plan={appState.plan}
          previousSessions={appState.sessions}
          onDone={goHome}
        />
      )}
      {screen === 'manage-weights' && (
        <ManageWeightsScreen onBack={goHome} />
      )}
    </div>
  )
}

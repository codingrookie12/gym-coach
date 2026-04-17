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
import { ExerciseLog } from '@/lib/store'

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
  })

  const navigate = useCallback((to: Screen) => setScreen(to), [])

  const updateState = useCallback((partial: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...partial }))
  }, [])

  const goHome = useCallback(() => {
    setAppState({ split: null, coachingContext: null, plan: null, sessions: null, exerciseLogs: [], savedLogs: null, savedExIdx: 0 })
    setScreen('home')
  }, [])

  const handleSessionBack = useCallback((logs: ExerciseLog[], exIdx: number) => {
    updateState({ savedLogs: logs, savedExIdx: exIdx })
    navigate('workout-overview')
  }, [updateState, navigate])

  // Write to Notion and advance to summary
  async function handleSaveSession(logs: ExerciseLog[]) {
    const today = new Date().toISOString().split('T')[0]
    const entries: any[] = []
    for (const exLog of logs) {
      for (let si = 0; si < exLog.sets.length; si++) {
        const set = exLog.sets[si]
        if (!set.completed) continue
        entries.push({
          exercise: exLog.notionName,
          date: today,
          split: appState.split,
          weight: set.weight,
          set: si + 1,
          reps: set.reps,
          entry: `${exLog.notionName} — Set ${si + 1}`,
        })
      }
    }
    try {
      await fetch('/api/session/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })
    } catch (e) {
      console.error('Write failed:', e)
    }
    updateState({ exerciseLogs: logs, savedLogs: null, savedExIdx: 0 })
    navigate('session-summary')
  }

  return (
    <div style={{ background: 'var(--bg)', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {screen === 'home' && (
        <HomeScreen
          onSelectSplit={(split) => { updateState({ split, savedLogs: null, savedExIdx: 0 }); navigate('coaching-context') }}
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
          onBegin={() => { updateState({ savedLogs: null, savedExIdx: 0 }); navigate('active-session') }}
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
          onFinish={(logs) => { updateState({ exerciseLogs: logs }); navigate('pre-save') }}
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

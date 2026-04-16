'use client'

import { useState, useCallback } from 'react'
import HomeScreen from '@/components/screens/HomeScreen'
import CoachingContextScreen from '@/components/screens/CoachingContextScreen'
import WorkoutOverviewScreen from '@/components/screens/WorkoutOverviewScreen'
import ActiveSessionScreen from '@/components/screens/ActiveSessionScreen'
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
  | 'session-summary'
  | 'manage-weights'

export interface AppState {
  split: Split | null
  coachingContext: CoachingContext | null
  plan: ExercisePlan[] | null
  sessions: SessionRecord[] | null
  exerciseLogs: ExerciseLog[]
  // Persisted mid-session state for resume
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

  const navigate = useCallback((to: Screen) => {
    setScreen(to)
  }, [])

  const updateState = useCallback((partial: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...partial }))
  }, [])

  const goHome = useCallback(() => {
    setAppState({
      split: null,
      coachingContext: null,
      plan: null,
      sessions: null,
      exerciseLogs: [],
      savedLogs: null,
      savedExIdx: 0,
    })
    setScreen('home')
  }, [])

  // Called when user presses back mid-session — saves progress, goes to overview
  const handleSessionBack = useCallback((logs: ExerciseLog[], exIdx: number) => {
    updateState({ savedLogs: logs, savedExIdx: exIdx })
    navigate('workout-overview')
  }, [updateState, navigate])

  return (
    <div
      style={{
        background: 'var(--bg)',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {screen === 'home' && (
        <HomeScreen
          onSelectSplit={(split) => {
            updateState({ split, savedLogs: null, savedExIdx: 0 })
            navigate('coaching-context')
          }}
          onSettings={() => navigate('manage-weights')}
        />
      )}
      {screen === 'coaching-context' && appState.split && (
        <CoachingContextScreen
          split={appState.split}
          onDataLoaded={(context, plan, sessions) => {
            updateState({ coachingContext: context, plan, sessions })
          }}
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
          onBegin={() => {
            // Clear saved progress when starting fresh from overview
            updateState({ savedLogs: null, savedExIdx: 0 })
            navigate('active-session')
          }}
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
          onFinish={(logs) => {
            updateState({ exerciseLogs: logs, savedLogs: null, savedExIdx: 0 })
            navigate('session-summary')
          }}
          onBack={handleSessionBack}
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

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
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [appState, setAppState] = useState<AppState>({
    split: null,
    coachingContext: null,
    plan: null,
    sessions: null,
    exerciseLogs: [],
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
    })
    setScreen('home')
  }, [])

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
            updateState({ split })
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
          onBegin={() => navigate('active-session')}
          onBack={() => navigate('coaching-context')}
        />
      )}
      {screen === 'active-session' && appState.plan && appState.split && (
        <ActiveSessionScreen
          split={appState.split}
          plan={appState.plan}
          onFinish={(logs) => {
            updateState({ exerciseLogs: logs })
            navigate('session-summary')
          }}
          onBack={() => navigate('workout-overview')}
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

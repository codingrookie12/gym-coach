'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PreSessionScreen from '@/components/screens/PreSessionScreen'
import ResumePromptScreen from '@/components/screens/ResumePromptScreen'
import CoachingContextScreen from '@/components/screens/CoachingContextScreen'
import WorkoutOverviewScreen from '@/components/screens/WorkoutOverviewScreen'
import ActiveSessionScreen from '@/components/screens/ActiveSessionScreen'
import PreSaveSummaryScreen from '@/components/screens/PreSaveSummaryScreen'
import SessionSummaryScreen from '@/components/screens/SessionSummaryScreen'
import ManageWeightsScreen from '@/components/screens/ManageWeightsScreen'
import ExerciseLibraryScreen from '@/components/screens/ExerciseLibraryScreen'
import MeScreen from '@/components/screens/MeScreen'
import LoadingScreen from '@/components/LoadingScreen'
import BottomTabBar, { ActiveTab } from '@/components/BottomTabBar'
import { Split, getNextSplit } from '@/lib/routines'
import { CoachingContext, ExercisePlan } from '@/lib/coaching'
import { SessionRecord } from '@/lib/notion'
import { ExerciseLog, SavedSnapshot } from '@/lib/store'
import {
  loadSessionFromStorage,
  clearSessionFromStorage,
  PersistedSession,
} from '@/lib/sessionStorage'
import {
  getExerciseAvailability,
  getUnavailableExercises,
} from '@/lib/exerciseAvailability'
import { getIncompletePendingExercises, savePendingExercise } from '@/lib/customExercises'
import { ExerciseDefinition } from '@/lib/exerciseLibrary'
import ExerciseAvailabilityPanel from '@/components/ExerciseAvailabilityPanel'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export type Screen =
  | 'detecting'          // checking localStorage + Notion on first load
  | 'resume-prompt'      // found unfinished session → ask resume or fresh
  | 'home'
  | 'coaching-context'
  | 'workout-overview'
  | 'active-session'
  | 'pre-save'
  | 'session-summary'
  | 'manage-weights'

export interface AppState {
  user: User | null
  split: Split | null
  coachingContext: CoachingContext | null
  plan: ExercisePlan[] | null
  sessions: SessionRecord[] | null
  exerciseLogs: ExerciseLog[]
  savedLogs: ExerciseLog[] | null
  savedExIdx: number
  savedSnapshot: SavedSnapshot
  // From resume detection
  detectedSession: PersistedSession | null
  detectedSplit: Split | null  // from Notion fallback (no full log data)
  lastSplit: Split | null      // most recently completed split (for carousel default)
}

export default function App() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('detecting')
  const [activeTab, setActiveTab] = useState<ActiveTab>('train')
  const [showEquipmentPanel, setShowEquipmentPanel] = useState(false)
  const [exerciseAvailability, setExerciseAvailability] = useState<Record<string, boolean>>({})
  const [pendingCustomCount, setPendingCustomCount] = useState(0)
  const [appState, setAppState] = useState<AppState>({
    user: null,
    split: null,
    coachingContext: null,
    plan: null,
    sessions: null,
    exerciseLogs: [],
    savedLogs: null,
    savedExIdx: 0,
    savedSnapshot: {},
    detectedSession: null,
    detectedSplit: null,
    lastSplit: null,
  })

  const navigate = useCallback((to: Screen) => setScreen(to), [])

  const updateState = useCallback((partial: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...partial }))
  }, [])

  const goHome = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      split: null, coachingContext: null, plan: null, sessions: null,
      exerciseLogs: [], savedLogs: null, savedExIdx: 0, savedSnapshot: {},
      detectedSession: null, detectedSplit: null,
    }))
    setPendingCustomCount(getIncompletePendingExercises().length)
    setScreen('home')
    setActiveTab('train')
  }, [])

  // On mount: load equipment availability + pending custom exercise count
  useEffect(() => {
    setExerciseAvailability(getExerciseAvailability())
    setPendingCustomCount(getIncompletePendingExercises().length)
  }, [])

  // On mount: check localStorage → then Notion fallback
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    async function detect() {
      // 0. Auth — middleware guarantees we're authenticated, but store user for Supabase writes
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setAppState(prev => ({ ...prev, user }))

      // 1. localStorage — fast, full data
      const stored = loadSessionFromStorage()
      if (stored) {
        setAppState(prev => ({ ...prev, detectedSession: stored }))
        setScreen('resume-prompt')
        return
      }

      // 2. Notion fallback — slower, only tells us split + that entries exist
      try {
        const res = await fetch('/api/session/today')
        const data = await res.json()
        if (data.found) {
          setAppState(prev => ({ ...prev, detectedSplit: data.split }))
          setScreen('resume-prompt')
          return
        }
      } catch {
        // Notion unreachable — proceed normally
      }

      // 3. Fetch last completed split to pre-select the carousel default
      try {
        const res = await fetch('/api/session/last-split')
        const data = await res.json()
        if (data.split) setAppState(prev => ({ ...prev, lastSplit: data.split }))
      } catch {
        // Non-blocking — defaults to Push
      }

      setScreen('home')
    }
    detect()
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

  async function handleSaveSession(logs: ExerciseLog[]) {
    const today = new Date().toISOString().split('T')[0]
    const snapshot = appState.savedSnapshot

    const patchPromises: Promise<any>[] = []
    const newEntries: any[] = []

    for (const exLog of logs) {
      for (let si = 0; si < exLog.sets.length; si++) {
        const set = exLog.sets[si]
        if (!set.completed) continue

        const key = `${exLog.exerciseName}:${si + 1}`
        const prior = snapshot[key]

        if (prior) {
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
        } else {
          const planItem = appState.plan?.find(p => p.exercise.name === exLog.exerciseName)
          newEntries.push({
            exercise: exLog.exerciseName,
            date: today,
            split: appState.split,
            weight: set.weight,
            set: si + 1,
            reps: set.reps,
            entry: `${exLog.exerciseName} — Set ${si + 1}`,
            notes: exLog.notes || undefined,
            unit: (planItem?.exercise.weightUnit === 'pins' ? 'Pins' : 'Lbs') as 'Lbs' | 'Pins',
          })
        }
      }
    }

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

    clearSessionFromStorage()
    updateState({ exerciseLogs: logs, savedLogs: null, savedExIdx: 0, savedSnapshot: {}, lastSplit: appState.split })
    navigate('session-summary')
  }

  // Resume a detected localStorage session
  function handleResume() {
    const s = appState.detectedSession
    if (!s) return
    updateState({
      split: s.split,
      savedLogs: s.logs,
      savedExIdx: s.exIdx,
      savedSnapshot: s.snapshot,
    })
    // Need coaching context + plan — go through coaching screen first
    navigate('coaching-context')
  }

  // Start fresh — clear stored session, go to split selection
  function handleStartFresh() {
    clearSessionFromStorage()
    updateState({ detectedSession: null, detectedSplit: null })
    navigate('home')
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Tab bar is visible on primary screens; hidden during workout flow
  const showTabBar = activeTab !== 'train' || screen === 'home'

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>

      {/* Tab content area — all panels stay mounted; display toggles preserve DOM scroll */}
      <div style={{ flex: 1, minHeight: 0 }}>

        {/* Train tab */}
        <div style={{ height: '100%', display: activeTab === 'train' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>

          {screen === 'detecting' && (
            <LoadingScreen message="Checking today's session..." />
          )}

          {screen === 'resume-prompt' && (
            <ResumePromptScreen
              detectedSession={appState.detectedSession}
              detectedSplit={appState.detectedSplit}
              onResume={handleResume}
              onFresh={handleStartFresh}
              onSettings={() => navigate('manage-weights')}
            />
          )}

          {screen === 'home' && (
            <PreSessionScreen
              initialSplit={getNextSplit(appState.lastSplit)}
              onSelectSplit={(split) => { updateState({ split, savedLogs: null, savedExIdx: 0, savedSnapshot: {} }); navigate('coaching-context') }}
              onSettings={() => navigate('manage-weights')}
              onEquipment={() => setShowEquipmentPanel(true)}
              unavailableCount={getUnavailableExercises(exerciseAvailability).length}
              pendingCustomCount={pendingCustomCount}
            />
          )}

          {screen === 'coaching-context' && appState.split && (
            <CoachingContextScreen
              split={appState.split}
              unavailableExercises={getUnavailableExercises(exerciseAvailability)}
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
              onAddExercise={(name: string, matched: ExerciseDefinition | null, prefillWeight: number | null, prefillReps: number | null) => {
                const currentPlan = appState.plan!
                const avgSets = currentPlan.length > 0
                  ? Math.max(1, Math.round(currentPlan.reduce((s, p) => s + p.exercise.sets, 0) / currentPlan.length))
                  : 3
                const newEntry: ExercisePlan = {
                  exercise: {
                    name,
                    notionName: name,
                    sets: avgSets,
                    repRange: [8, 12],
                    backup: null,
                    split: appState.split!,
                  },
                  targetWeight: prefillWeight,
                  coachingNote: null,
                }
                updateState({ plan: [...currentPlan, newEntry] })
                if (!matched) savePendingExercise(name)
              }}
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

        {/* Library tab */}
        <div style={{ height: '100%', display: activeTab === 'library' ? 'flex' : 'none', flexDirection: 'column' }}>
          <ExerciseLibraryScreen lastSplit={appState.lastSplit} />
        </div>

        {/* Me tab */}
        <div style={{ height: '100%', display: activeTab === 'me' ? 'flex' : 'none', flexDirection: 'column' }}>
          <MeScreen user={appState.user} onLogout={handleLogout} />
        </div>

      </div>

      {showTabBar && (
        <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} libraryBadge={pendingCustomCount} />
      )}

      {showEquipmentPanel && (
        <ExerciseAvailabilityPanel
          availability={exerciseAvailability}
          onToggle={(name, available) => {
            setExerciseAvailability(prev => {
              const next = { ...prev }
              if (available) delete next[name]
              else next[name] = false
              return next
            })
            // Clear cached plan so it rebuilds with updated availability on next navigation
            updateState({ coachingContext: null, plan: null })
          }}
          onReset={() => {
            setExerciseAvailability({})
            updateState({ coachingContext: null, plan: null })
          }}
          onClose={() => setShowEquipmentPanel(false)}
        />
      )}
    </div>
  )
}

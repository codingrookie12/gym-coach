'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import PreSessionScreen from '@/components/screens/PreSessionScreen'
import ResumePromptScreen from '@/components/screens/ResumePromptScreen'
import CoachingContextScreen from '@/components/screens/CoachingContextScreen'
import WorkoutOverviewScreen from '@/components/screens/WorkoutOverviewScreen'
import ActiveSessionScreen from '@/components/screens/ActiveSessionScreen'
import PreSaveSummaryScreen from '@/components/screens/PreSaveSummaryScreen'
import SessionSummaryScreen from '@/components/screens/SessionSummaryScreen'
import ManageWeightsScreen from '@/components/screens/ManageWeightsScreen'
import RoutineEditorScreen from '@/components/screens/RoutineEditorScreen'
import ExerciseLibraryScreen from '@/components/screens/ExerciseLibraryScreen'
import ProgressHistoryScreen from '@/components/screens/ProgressHistoryScreen'
import ExerciseBrowserScreen from '@/components/screens/ExerciseBrowserScreen'
import MeScreen from '@/components/screens/MeScreen'
import ReportsLandingScreen from '@/components/screens/ReportsLandingScreen'
import LoadingScreen from '@/components/LoadingScreen'
import BottomTabBar, { ActiveTab } from '@/components/BottomTabBar'
import { CoachingContext, ExercisePlan } from '@/lib/coaching'
import { type Program } from '@/lib/programs'
import ProgramLibraryScreen from '@/components/screens/ProgramLibraryScreen'
import CustomProgramBuilderScreen from '@/components/screens/CustomProgramBuilderScreen'
import { permanentlySwapExercise, retryFailedSyncs } from '@/lib/supabase.queries'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { removeExerciseFromRoutine } from '@/lib/userRoutine'
import { SessionRecord } from '@/lib/supabase.queries'
import { ExerciseLog, SavedSnapshot } from '@/lib/store'
import Toast from '@/components/ui/Toast'
import {
  loadSessionFromStorage,
  clearSessionFromStorage,
  PersistedSession,
  readOutbox,
  removeFromOutbox,
  enqueueOutbox,
} from '@/lib/sessionStorage'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import OfflineIndicator from '@/components/OfflineIndicator'
import { getIncompletePendingExercises, savePendingExercise, migrateLegacyLocalStorage } from '@/lib/customExercises'
import { ExerciseDefinition } from '@/lib/exerciseLibrary'
import type { User } from '@supabase/supabase-js'

export type Screen =
  | 'detecting'          // checking localStorage + Supabase on first load
  | 'onboarding'         // new user: pick a program before first session
  | 'resume-prompt'      // found unfinished session → ask resume or fresh
  | 'home'
  | 'coaching-context'
  | 'workout-overview'
  | 'active-session'
  | 'pre-save'
  | 'session-summary'
  | 'manage-weights'
  | 'routine-editor'
  | 'program-builder'
  | 'program-editor'

export interface SessionSwap { oldName: string; newName: string }

export interface AppState {
  user: User | null
  programId: string
  userProgramId: string | null
  activeProgram: Program | null
  userProgramSplitId: string | null
  split: string | null
  coachingContext: CoachingContext | null
  plan: ExercisePlan[] | null
  sessions: SessionRecord[] | null
  exerciseLogs: ExerciseLog[]
  savedLogs: ExerciseLog[] | null
  savedExIdx: number
  savedSnapshot: SavedSnapshot
  sessionSwaps: SessionSwap[]
  sessionSyncStatus: 'confirmed' | 'partial' | 'queued' | null
  workoutStartedAt: string | null
  detectedSession: PersistedSession | null
  detectedSplit: string | null
  lastSplit: string | null
  showStartFreshConfirm: boolean
}

function computeNextSplit(splits: string[], lastSplit: string | null): string {
  if (!splits.length) return ''
  if (!lastSplit) return splits[0]
  const idx = splits.indexOf(lastSplit)
  if (idx === -1) return splits[0]
  return splits[(idx + 1) % splits.length]
}

async function resolveSplitIdByName(userProgramId: string | null, splitName: string): Promise<string | null> {
  if (!userProgramId) return null
  try {
    const res = await fetch(`/api/user/programs/${userProgramId}`)
    const data = await res.json()
    const split = data.program?.splits?.find((s: any) => s.name === splitName && !s.archivedAt)
    return split?.id ?? null
  } catch {
    return null
  }
}

export default function App() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('detecting')
  const [activeTab, setActiveTab] = useState<ActiveTab>('train')
  const [showProgramLibrary, setShowProgramLibrary] = useState(false)
  const [programLibraryInitialMode, setProgramLibraryInitialMode] = useState<'explorer' | 'builder' | undefined>(undefined)
  const [showProgressHistory, setShowProgressHistory] = useState(false)
  const [showExerciseBrowser, setShowExerciseBrowser] = useState(false)
  const [exerciseBrowserPreselected, setExerciseBrowserPreselected] = useState<string | null>(null)
  const [exerciseBrowserDefaultTab, setExerciseBrowserDefaultTab] = useState<'browse' | 'custom'>('browse')
  const [pendingCustomCount, setPendingCustomCount] = useState(0)
  const [programSplits, setProgramSplits] = useState<{ id: string; name: string }[]>([])
  const [appState, setAppState] = useState<AppState>({
    user: null,
    programId: 'ppl-default',
    userProgramId: null,
    activeProgram: null,
    userProgramSplitId: null,
    split: null,
    coachingContext: null,
    plan: null,
    sessions: null,
    exerciseLogs: [],
    savedLogs: null,
    savedExIdx: 0,
    savedSnapshot: {},
    sessionSwaps: [],
    sessionSyncStatus: null,
    workoutStartedAt: null,
    detectedSession: null,
    detectedSplit: null,
    lastSplit: null,
    showStartFreshConfirm: false,
  })

  const navigate = useCallback((to: Screen) => setScreen(to), [])

  const updateState = useCallback((partial: Partial<AppState>) => {
    setAppState(prev => ({ ...prev, ...partial }))
  }, [])

  const online = useOnlineStatus()
  const [outboxCount, setOutboxCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  // Drain the offline finish-session outbox. Safe to call any time.
  const drainOutbox = useCallback(async (userId: string) => {
    const pending = readOutbox(userId)
    if (!pending.length) return
    setIsSyncing(true)
    for (const entry of pending) {
      try {
        const res = await fetch('/api/session/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry.body),
        })
        if (res.ok) {
          removeFromOutbox(userId, entry.id)
          setOutboxCount(readOutbox(userId).length)
        } else if (res.status >= 400 && res.status < 500) {
          // 4xx — malformed payload; drop to avoid infinite retry
          console.warn('[GYM-49] Outbox entry rejected by server, dropping:', entry.id, res.status)
          removeFromOutbox(userId, entry.id)
          setOutboxCount(readOutbox(userId).length)
        }
        // 5xx or network error: leave in outbox, retry next time
      } catch {
        // Network error — leave in outbox
        break
      }
    }
    setIsSyncing(false)
  }, [])

  // Drain on reconnect
  useEffect(() => {
    const userId = appState.user?.id
    if (online && userId) {
      setOutboxCount(readOutbox(userId).length)
      drainOutbox(userId)
    }
  }, [online, appState.user?.id, drainOutbox])

  // GYM-95: pending in-memory plan op (add or remove) with 3s Undo window.
  // Mirrors GYM-94's PendingOp pattern but for `appState.plan` instead of
  // `user_routine_exercises`. `flush` is a no-op for in-memory ops and a
  // deferred DB delete for the "remove from routine" branch.
  interface PendingPlanOp {
    message: string
    flush: () => Promise<void>
    undo: () => void
    timeoutId: ReturnType<typeof setTimeout>
  }
  const [pendingPlanOp, setPendingPlanOp] = useState<PendingPlanOp | null>(null)
  const pendingPlanOpRef = useRef<PendingPlanOp | null>(null)
  const supabaseRef = useRef(createSupabaseBrowserClient())

  useEffect(() => { pendingPlanOpRef.current = pendingPlanOp }, [pendingPlanOp])

  const flushPlanOp = useCallback(async () => {
    const op = pendingPlanOpRef.current
    if (!op) return
    clearTimeout(op.timeoutId)
    setPendingPlanOp(null)
    pendingPlanOpRef.current = null
    try { await op.flush() } catch {}
  }, [])

  const startPlanOp = useCallback((op: PendingPlanOp) => {
    const prev = pendingPlanOpRef.current
    if (prev) {
      clearTimeout(prev.timeoutId)
      prev.flush().catch(() => {})
    }
    setPendingPlanOp(op)
    pendingPlanOpRef.current = op
  }, [])

  const handleUndoPlanOp = useCallback(() => {
    const op = pendingPlanOpRef.current
    if (!op) return
    clearTimeout(op.timeoutId)
    op.undo()
    setPendingPlanOp(null)
    pendingPlanOpRef.current = null
  }, [])

  const goHome = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      split: null, coachingContext: null, plan: null, sessions: null,
      exerciseLogs: [], savedLogs: null, savedExIdx: 0, savedSnapshot: {},
      sessionSwaps: [], sessionSyncStatus: null,
      detectedSession: null, detectedSplit: null,
      // programId preserved intentionally
    }))
    if (appState.user) {
      const uid = appState.user.id
      getIncompletePendingExercises(uid).then(arr => setPendingCustomCount(arr.length))
    }
    setScreen('home')
    setActiveTab('train')
  }, [appState.user])

  function handleSessionSwap(oldName: string, newName: string) {
    setAppState(prev => ({
      ...prev,
      sessionSwaps: [...prev.sessionSwaps, { oldName, newName }],
      plan: prev.plan
        ? prev.plan.map(p =>
            p.exercise.name === oldName
              ? {
                  ...p,
                  exercise: { ...p.exercise, name: newName, canonicalName: newName },
                  targetWeight: null,
                  coachingNote: null,
                }
              : p
          )
        : null,
    }))
  }

  // On mount: discard any legacy global-keyed localStorage from pre-GYM-89 builds.
  // Delete-first migration — we do not move that data into the current user's slot
  // because the device may be shared.
  useEffect(() => {
    try {
      localStorage.removeItem('gym_coach_session')
      localStorage.removeItem('gym_coach_custom_exercises')
    } catch {}
  }, [])

  // On mount: check localStorage → then Supabase fallback
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    async function detect() {
      // 0. Auth — middleware guarantees we're authenticated, but store user for Supabase writes
      const { data: { user } } = await supabase.auth.getUser()

      // Resolve program: server API returns both legacy programId and new userProgramId
      let resolvedProgramId: string | null = null
      let resolvedUserProgramId: string | null = null
      let resolvedProgram: Program | null = null

      try {
        const res = await fetch('/api/user/program')
        const data = await res.json()
        resolvedProgramId = data.programId ?? null
        resolvedUserProgramId = data.userProgramId ?? null
      } catch {}

      // Resolve the active program via async hydration
      if (resolvedUserProgramId) {
        try {
          const res = await fetch(`/api/user/programs/${resolvedUserProgramId}`)
          const data = await res.json()
          if (data.program) {
            const p = data.program
            const activeSplits = (p.splits ?? []).filter((s: any) => !s.archivedAt)
            setProgramSplits(activeSplits.map((s: any) => ({ id: s.id, name: s.name })))
            resolvedProgram = {
              id: p.id,
              name: p.name,
              shortName: p.name.slice(0, 8).toUpperCase(),
              splits: activeSplits.map((s: any) => s.name),
              splitMuscles: {},
              tier: 1,
              style: 'hypertrophy',
              level: 'intermediate',
              daysPerWeek: activeSplits.length,
              source: p.sourceTemplateId ? 'curated' : 'user-created',
              presentation: { tagline: '', overview: '', whatToExpect: [], daysLabel: '', sessionLength: '', periodization: '', attribution: null },
            } as Program
          }
        } catch {}
      }

      if (user) {
        setAppState(prev => ({
          ...prev,
          user,
          programId: resolvedProgramId ?? prev.programId,
          userProgramId: resolvedUserProgramId,
          activeProgram: resolvedProgram,
        }))

        // Per-user state hydration. Fire-and-forget: the home screen renders
        // while these resolve; badges update when they land.
        migrateLegacyLocalStorage(user.id)
          .then(() => getIncompletePendingExercises(user.id))
          .then(arr => setPendingCustomCount(arr.length))

        // Check onboarding status — new users pick a program before first session
        try {
          const obRes = await fetch('/api/user/onboarding')
          const obData = await obRes.json()
          if (!obData.onboardingCompleted) {
            setScreen('onboarding')
            return
          }
        } catch {}

        // If no active program after onboarding, route to onboarding
        if (!resolvedUserProgramId) {
          setScreen('onboarding')
          return
        }

        // Silently retry any partial syncs from previous sessions
        const { data: pending } = await supabase
          .from('failed_syncs')
          .select('id, payload, retry_count')
          .eq('user_id', user.id)
          .is('resolved_at', null)
          .lte('retry_count', 3)
          .order('created_at', { ascending: true })
          .limit(10)
        if (pending?.length) {
          retryFailedSyncs(supabase, user.id, pending).catch(() => {})
        }

        // Drain any offline-finish outbox entries queued while offline (GYM-49)
        const outboxPending = readOutbox(user.id)
        setOutboxCount(outboxPending.length)
        if (outboxPending.length) {
          drainOutbox(user.id)
        }
      }

      const activeSplits = resolvedProgram?.splits ?? []

      // 1. localStorage — fast, full data (per-user keyed)
      const stored = user ? loadSessionFromStorage(user.id) : null
      if (stored && activeSplits.includes(stored.split)) {
        const splitId = await resolveSplitIdByName(resolvedUserProgramId, stored.split)
        setAppState(prev => ({ ...prev, detectedSession: stored, userProgramSplitId: splitId }))
        setScreen('resume-prompt')
        return
      }
      if (stored && user) clearSessionFromStorage(user.id)

      // 2. DB fallback — check for today's workout in the active program
      try {
        const res = await fetch('/api/session/today')
        const data = await res.json()
        if (data.found && activeSplits.includes(data.split)) {
          setAppState(prev => ({ ...prev, detectedSplit: data.split, userProgramSplitId: data.userProgramSplitId ?? null }))
          setScreen('resume-prompt')
          return
        }
      } catch {}

      // 3. Fetch last completed split to pre-select the carousel default
      try {
        const res = await fetch('/api/session/last-split')
        const data = await res.json()
        if (data.split) setAppState(prev => ({ ...prev, lastSplit: data.split, userProgramSplitId: data.userProgramSplitId ?? prev.userProgramSplitId }))
      } catch {}

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
            userProgramSplitId: appState.userProgramSplitId ?? undefined,
          })
        }
      }
    }

    // If offline (or write fails with a network error), queue and clear the
    // in-progress session — it belongs to the outbox now.
    const writeBody = newEntries.length > 0
      ? { entries: newEntries, ...(appState.workoutStartedAt ? { startedAt: appState.workoutStartedAt } : {}) }
      : null

    let syncStatus: 'confirmed' | 'partial' | 'queued' = 'confirmed'

    if (writeBody && !navigator.onLine) {
      // Definitely offline — skip the fetch entirely and queue
      if (appState.user) enqueueOutbox(appState.user.id, writeBody)
      setOutboxCount(appState.user ? readOutbox(appState.user.id).length : 1)
      if (appState.user) clearSessionFromStorage(appState.user.id)
      updateState({
        exerciseLogs: logs, savedLogs: null, savedExIdx: 0, savedSnapshot: {},
        sessionSwaps: [], sessionSyncStatus: 'queued', workoutStartedAt: null,
      })
      navigate('session-summary')
      return
    }

    let writeResponse: Response | null = null
    try {
      const [, wr] = await Promise.all([
        Promise.all(patchPromises),
        writeBody
          ? fetch('/api/session/write', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(writeBody),
            })
          : Promise.resolve(null),
      ])
      writeResponse = wr
    } catch {
      // Network error mid-session (went offline after check) — queue
      if (writeBody && appState.user) {
        enqueueOutbox(appState.user.id, writeBody)
        setOutboxCount(readOutbox(appState.user.id).length)
      }
      if (appState.user) clearSessionFromStorage(appState.user.id)
      updateState({
        exerciseLogs: logs, savedLogs: null, savedExIdx: 0, savedSnapshot: {},
        sessionSwaps: [], sessionSyncStatus: 'queued', workoutStartedAt: null,
      })
      navigate('session-summary')
      return
    }

    if (writeResponse) {
      const data = await writeResponse.json()
      if (!data.success) throw new Error(data.error ?? 'Save failed')
      syncStatus = data.skipped?.length > 0 ? 'partial' : 'confirmed'
    }

    if (syncStatus === 'confirmed' && appState.user) clearSessionFromStorage(appState.user.id)

    fetch('/api/session/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, userProgramSplitId: appState.userProgramSplitId }),
    }).catch(() => {})

    updateState({
      exerciseLogs: logs, savedLogs: null, savedExIdx: 0, savedSnapshot: {},
      lastSplit: appState.split, sessionSyncStatus: syncStatus, workoutStartedAt: null,
    })
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
      workoutStartedAt: s.startedAt ?? null,
    })
    // Need coaching context + plan — go through coaching screen first
    navigate('coaching-context')
  }

  // Start fresh — if today has DB-saved exercises, prompt for confirmation
  function handleStartFresh() {
    if (appState.userProgramSplitId) {
      updateState({ showStartFreshConfirm: true })
      return
    }
    if (appState.user) clearSessionFromStorage(appState.user.id)
    updateState({ detectedSession: null, detectedSplit: null })
    navigate('home')
  }

  async function confirmStartFresh() {
    const splitId = appState.userProgramSplitId
    if (splitId) {
      try {
        await fetch(`/api/session/today?userProgramSplitId=${encodeURIComponent(splitId)}`, { method: 'DELETE' })
      } catch (err) {
        console.error('Failed to discard today on Start Fresh:', err)
      }
    }
    if (appState.user) clearSessionFromStorage(appState.user.id)
    updateState({ detectedSession: null, detectedSplit: null, showStartFreshConfirm: false })
    navigate('home')
  }

  function cancelStartFresh() {
    updateState({ showStartFreshConfirm: false })
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // Tab bar is visible on primary screens; hidden during workout flow and onboarding
  const showTabBar = screen !== 'onboarding' && (activeTab !== 'train' || screen === 'home')

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>

      {/* Tab content area — all panels stay mounted; display toggles preserve DOM scroll */}
      <div style={{ flex: 1, minHeight: 0 }}>

        {/* Train tab */}
        <div style={{ height: '100%', display: activeTab === 'train' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>

          {screen === 'detecting' && (
            <LoadingScreen message="Checking today's session..." />
          )}

          {screen === 'onboarding' && (
            <ProgramLibraryScreen
              userId={appState.user?.id}
              onSelect={async (userProgramId) => {
                updateState({ userProgramId })
                await fetch('/api/user/program', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userProgramId }),
                })
                await fetch('/api/user/onboarding', { method: 'POST' })
                // Reload to re-resolve the program
                window.location.reload()
              }}
            />
          )}

          {screen === 'resume-prompt' && (
            <ResumePromptScreen
              detectedSession={appState.detectedSession}
              detectedSplit={appState.detectedSplit}
              onResume={handleResume}
              onFresh={handleStartFresh}
              onSettings={() => navigate('manage-weights')}
              showStartFreshConfirm={appState.showStartFreshConfirm}
              onConfirmStartFresh={confirmStartFresh}
              onCancelStartFresh={cancelStartFresh}
            />
          )}

          {screen === 'home' && appState.activeProgram && (
            <PreSessionScreen
              initialSplit={computeNextSplit(appState.activeProgram.splits, appState.lastSplit)}
              activeProgram={appState.activeProgram}
              onSelectSplit={async (splitName) => {
                // Resolve the split's UUID from the hydrated program
                const splitId = await resolveSplitIdByName(appState.userProgramId, splitName)
                updateState({ split: splitName, userProgramSplitId: splitId, savedLogs: null, savedExIdx: 0, savedSnapshot: {} })
                navigate('coaching-context')
              }}
              onSettings={() => navigate('manage-weights')}
              pendingCustomCount={pendingCustomCount}
            />
          )}
          {screen === 'home' && !appState.activeProgram && (
            <LoadingScreen message="Loading program..." />
          )}

          {screen === 'coaching-context' && appState.split && (
            <CoachingContextScreen
              split={appState.split}
              programId={appState.programId}
              userProgramSplitId={appState.userProgramSplitId ?? undefined}
              onDataLoaded={(context, plan, sessions) => updateState({ coachingContext: context, plan, sessions })}
              coachingContext={appState.coachingContext}
              plan={appState.plan}
              onWeightDecision={(exerciseName, accepted) => {
                if (accepted || !appState.plan) return
                const flag = appState.coachingContext?.watchFlags.find(
                  f => f.exercise === exerciseName && f.type === 'weight-too-heavy'
                )
                if (!flag?.originalWeight) return
                const updatedPlan = appState.plan.map(p =>
                  p.exercise.name === exerciseName
                    ? { ...p, targetWeight: flag.originalWeight!, coachingNote: null }
                    : p
                )
                updateState({ plan: updatedPlan })
              }}
              onViewPlan={() => navigate('workout-overview')}
              onBack={goHome}
            />
          )}

          {screen === 'workout-overview' && appState.plan && appState.split && (
            <WorkoutOverviewScreen
              split={appState.split}
              plan={appState.plan}
              hasResumable={!!appState.savedLogs}
              onBegin={async () => {
                await flushPlanOp()
                updateState({ savedLogs: null, savedExIdx: 0, savedSnapshot: {}, workoutStartedAt: new Date().toISOString() })
                navigate('active-session')
              }}
              onResume={async () => { await flushPlanOp(); navigate('active-session') }}
              onBack={async () => { await flushPlanOp(); navigate('coaching-context') }}
              onAddExercise={(name: string, matched: ExerciseDefinition | null, prefillWeight: number | null, prefillReps: number | null) => {
                const currentPlan = appState.plan!
                const avgSets = currentPlan.length > 0
                  ? Math.max(1, Math.round(currentPlan.reduce((s, p) => s + p.exercise.sets, 0) / currentPlan.length))
                  : 3
                const newEntry: ExercisePlan = {
                  exercise: {
                    name,
                    canonicalName: name,
                    sets: avgSets,
                    repRange: [8, 12],
                    backup: null,
                    split: appState.split!,
                  },
                  targetWeight: prefillWeight,
                  coachingNote: null,
                }
                updateState({ plan: [...currentPlan, newEntry] })
                if (!matched && appState.user) savePendingExercise(appState.user.id, name)

                const undo = () => {
                  setAppState(prev => prev.plan
                    ? { ...prev, plan: prev.plan.filter(p => p !== newEntry) }
                    : prev
                  )
                }
                const timeoutId = setTimeout(() => {
                  setPendingPlanOp(null)
                  pendingPlanOpRef.current = null
                }, 3000)
                startPlanOp({ message: `${name} added`, flush: async () => {}, undo, timeoutId })
              }}
              onRemoveFromSessionOnly={(entry, index) => {
                setAppState(prev => prev.plan
                  ? { ...prev, plan: prev.plan.filter(p => p !== entry) }
                  : prev
                )
                const undo = () => {
                  setAppState(prev => {
                    if (!prev.plan) return prev
                    const next = [...prev.plan]
                    next.splice(index, 0, entry)
                    return { ...prev, plan: next }
                  })
                }
                const timeoutId = setTimeout(() => {
                  setPendingPlanOp(null)
                  pendingPlanOpRef.current = null
                }, 3000)
                startPlanOp({ message: `${entry.exercise.name} removed for today`, flush: async () => {}, undo, timeoutId })
              }}
              onRemoveFromRoutine={(entry, index) => {
                const splitId = appState.userProgramSplitId
                const userId = appState.user?.id
                setAppState(prev => prev.plan
                  ? { ...prev, plan: prev.plan.filter(p => p !== entry) }
                  : prev
                )
                const flush = async () => {
                  if (!splitId || !userId) return
                  try {
                    await removeExerciseFromRoutine(supabaseRef.current, userId, splitId, entry.exercise.canonicalName)
                  } catch (err) {
                    console.error('removeExerciseFromRoutine failed:', err)
                    // DB delete failed — restore the entry so plan reflects reality
                    setAppState(prev => {
                      if (!prev.plan) return prev
                      const next = [...prev.plan]
                      next.splice(index, 0, entry)
                      return { ...prev, plan: next }
                    })
                  }
                }
                const undo = () => {
                  setAppState(prev => {
                    if (!prev.plan) return prev
                    const next = [...prev.plan]
                    next.splice(index, 0, entry)
                    return { ...prev, plan: next }
                  })
                }
                const timeoutId = setTimeout(() => {
                  flush()
                  setPendingPlanOp(null)
                  pendingPlanOpRef.current = null
                }, 3000)
                startPlanOp({ message: `${entry.exercise.name} removed from routine`, flush, undo, timeoutId })
              }}
              onSessionSwap={handleSessionSwap}
            />
          )}

          {screen === 'active-session' && appState.plan && appState.split && appState.user && (
            <ActiveSessionScreen
              userId={appState.user.id}
              split={appState.split}
              plan={appState.plan}
              initialLogs={appState.savedLogs ?? undefined}
              initialExIdx={appState.savedExIdx}
              initialSnapshot={appState.savedSnapshot}
              startedAt={appState.workoutStartedAt ?? undefined}
              onFinish={handleSessionFinish}
              onBack={handleSessionBack}
              onSessionSwap={handleSessionSwap}
            />
          )}

          {screen === 'pre-save' && appState.plan && appState.split && (
            <PreSaveSummaryScreen
              split={appState.split}
              plan={appState.plan}
              logs={appState.exerciseLogs}
              sessionSwaps={appState.sessionSwaps}
              onSave={handleSaveSession}
              onBack={() => navigate('active-session')}
              onSetDefault={appState.user && appState.userProgramSplitId ? async (oldName, newName) => {
                const supabase = createSupabaseBrowserClient()
                await permanentlySwapExercise(supabase, appState.user!.id, appState.userProgramSplitId!, oldName, newName).catch(() => {})
              } : undefined}
            />
          )}

          {screen === 'session-summary' && appState.user && appState.exerciseLogs && appState.split && appState.sessions && appState.plan && (
            <SessionSummaryScreen
              userId={appState.user.id}
              split={appState.split}
              exerciseLogs={appState.exerciseLogs}
              plan={appState.plan}
              previousSessions={appState.sessions}
              syncStatus={appState.sessionSyncStatus ?? undefined}
              onDone={goHome}
            />
          )}

          {screen === 'manage-weights' && (
            <ManageWeightsScreen onBack={goHome} />
          )}


        </div>

        {/* Library tab */}
        <div style={{ height: '100%', display: activeTab === 'library' ? 'flex' : 'none', flexDirection: 'column' }}>
          {showProgramLibrary ? (
            <ProgramLibraryScreen
              selectedId={appState.userProgramId ?? appState.programId}
              userId={appState.user?.id}
              activeSession={appState.split !== null}
              initialMode={programLibraryInitialMode}
              onBack={() => { setShowProgramLibrary(false); setProgramLibraryInitialMode(undefined) }}
              onSelect={async (userProgramId) => {
                if (appState.user) clearSessionFromStorage(appState.user.id)
                setShowProgramLibrary(false)
                setProgramLibraryInitialMode(undefined)
                window.location.reload()
              }}
            />
          ) : showProgressHistory ? (
            <ProgressHistoryScreen onBack={() => setShowProgressHistory(false)} />
          ) : showExerciseBrowser && appState.user ? (
            <ExerciseBrowserScreen
              userId={appState.user.id}
              activeProgramId={appState.userProgramId ?? appState.programId}
              preselectedExerciseName={exerciseBrowserPreselected}
              defaultTab={exerciseBrowserDefaultTab}
              onBack={() => { setShowExerciseBrowser(false); setExerciseBrowserPreselected(null); setExerciseBrowserDefaultTab('browse') }}
            />
          ) : (
            <ExerciseLibraryScreen
              lastSplit={appState.lastSplit}
              activeProgramId={appState.userProgramId ?? appState.programId}
              activeProgram={appState.activeProgram}
              pendingCustomCount={pendingCustomCount}
              onSelectProgram={() => { if (appState.user) clearSessionFromStorage(appState.user.id); window.location.reload() }}
              onOpenMyPrograms={() => { setProgramLibraryInitialMode(undefined); setShowProgramLibrary(true) }}
              onOpenExplorer={() => { setProgramLibraryInitialMode('explorer'); setShowProgramLibrary(true) }}
              onOpenBuilder={() => { setProgramLibraryInitialMode('builder'); setShowProgramLibrary(true) }}
              onEditRoutine={() => setScreen('routine-editor')}
              onOpenHistory={() => setShowProgressHistory(true)}
              onOpenExercises={(preselectedName) => { setExerciseBrowserPreselected(preselectedName ?? null); setExerciseBrowserDefaultTab('browse'); setShowExerciseBrowser(true) }}
              onOpenCustomExercises={() => { setExerciseBrowserPreselected(null); setExerciseBrowserDefaultTab('custom'); setShowExerciseBrowser(true) }}
            />
          )}
        </div>

        {/* Reports tab — GYM-19/Section 6: standalone 4th tab, landing stub only (Phase 4 rebuilds ProgressHistoryScreen here) */}
        <div style={{ height: '100%', display: activeTab === 'reports' ? 'flex' : 'none', flexDirection: 'column' }}>
          <ReportsLandingScreen />
        </div>

        {/* Me tab */}
        <div style={{ height: '100%', display: activeTab === 'me' ? 'flex' : 'none', flexDirection: 'column' }}>
          <MeScreen user={appState.user} onLogout={handleLogout} />
        </div>

      </div>

      {showTabBar && (
        <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} libraryBadge={pendingCustomCount} />
      )}

      {screen === 'routine-editor' && appState.user && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'var(--bg)' }}>
          <RoutineEditorScreen
            splits={programSplits}
            userId={appState.user.id}
            onBack={goHome}
          />
        </div>
      )}

      {pendingPlanOp && (
        <Toast
          message={pendingPlanOp.message}
          onUndo={handleUndoPlanOp}
          onTimeout={() => {
            // Timer fires inside Toast; the op's own timeoutId already
            // triggered flush+state-clear, so this is a defensive no-op for
            // the case where state hasn't yet caught up.
            setPendingPlanOp(null)
            pendingPlanOpRef.current = null
          }}
        />
      )}

      <OfflineIndicator
        hasPendingOutbox={outboxCount > 0}
        isSyncing={isSyncing}
      />

    </div>
  )
}

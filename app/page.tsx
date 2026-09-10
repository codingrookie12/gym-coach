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
import LoadingScreen from '@/components/LoadingScreen'
import BottomTabBar, { ActiveTab } from '@/components/BottomTabBar'
// NOTE: the old lib/coaching.ts (which used to shadow this directory on a
// bare '@/lib/coaching' import — Node/webpack resolves a same-named .ts file
// before a directory index) was deleted in GYM-97 fix #9 once every call
// site had migrated to the new engine. Imports still use the explicit
// '/index' path for clarity, though it's no longer load-bearing.
import { CoachingContext, unresolvedExerciseId } from '@/lib/coaching/index'
import { SessionExercisePlan } from '@/lib/sessionPlan'
import { type Program } from '@/lib/programs'
import ProgramLibraryScreen from '@/components/screens/ProgramLibraryScreen'
import CustomProgramBuilderScreen from '@/components/screens/CustomProgramBuilderScreen'
import { permanentlySwapExercise, retryFailedSyncs } from '@/lib/supabase.queries'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { removeExerciseFromRoutine } from '@/lib/userRoutine'
import { ExerciseLog, SavedSnapshot } from '@/lib/store'
import { buildResumeStateFromDb, shouldResumeFromLocal, shouldResumeFromDb } from '@/lib/sessionResume'
import { computeFinishSaveChanges } from '@/lib/finishSaveDiff'
import { mergeSessionSwap } from '@/lib/sessionSwaps'
import { drainOutbox as drainOutboxQueue } from '@/lib/outboxDrain'
import { drainPendingFinishes as drainPendingFinishesQueue } from '@/lib/finishDrain'
import Toast from '@/components/ui/Toast'
import {
  loadSessionFromStorage,
  clearSessionFromStorage,
  PersistedSession,
  readOutbox,
  enqueueOutbox,
  readPendingFinishes,
  enqueuePendingFinish,
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
  plan: SessionExercisePlan[] | null
  exerciseLogs: ExerciseLog[]
  savedLogs: ExerciseLog[] | null
  savedExIdx: number
  savedSnapshot: SavedSnapshot
  sessionSwaps: SessionSwap[]
  sessionSyncStatus: 'confirmed' | 'partial' | 'queued' | null
  workoutStartedAt: string | null
  /** GYM-97 fix #2: lifted out of CoachingContextScreen's local state so an
   *  ACCEPT/KEEP WEIGHT decision survives navigating away and back —
   *  previously a remount reset it to {}, letting a re-tap of KEEP WEIGHT
   *  silently revert an already-accepted recalibration. */
  weightDecisions: Record<string, boolean>
  /** GYM-97 fix #7: lifted out of PreSaveSummaryScreen's local state so
   *  going back to fix a set and returning doesn't silently drop the
   *  session RPE (a real input to Phase 2's fatigue-deload signal). */
  sessionRpe: number | null
  detectedSession: PersistedSession | null
  detectedSplit: string | null
  // GYM-XX: true from the moment handleResume() takes the DB-fallback branch
  // (detectedSplit set, no localStorage) until the resulting plan load's
  // onDataLoaded has fetched + merged the real completed-set data. Gates
  // that merge so it never fires on an unrelated fresh-session plan load
  // that happens to still carry a stale detectedSplit from initial detect().
  pendingDbResume: boolean
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
    exerciseLogs: [],
    savedLogs: null,
    savedExIdx: 0,
    savedSnapshot: {},
    sessionSwaps: [],
    sessionSyncStatus: null,
    workoutStartedAt: null,
    weightDecisions: {},
    sessionRpe: null,
    detectedSession: null,
    detectedSplit: null,
    pendingDbResume: false,
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

  // Drain the offline finish-session outbox. Safe to call any time — the
  // reentrancy guard in lib/outboxDrain.ts makes concurrent calls for the
  // same user a no-op past the first, since this is invoked from two
  // independent triggers below (mount-time detect() and the online-status
  // effect) that can both fire in the same tick.
  const drainOutbox = useCallback(async (userId: string) => {
    if (!readOutbox(userId).length) return
    setIsSyncing(true)
    const result = await drainOutboxQueue(userId, {
      fetchWrite: async (body) => {
        const res = await fetch('/api/session/write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        return { ok: res.ok, status: res.status }
      },
    })
    if (result) setOutboxCount(result.remaining)
    setIsSyncing(false)
  }, [])

  // Drain the pending-finish queue (see lib/sessionStorage.ts's
  // "Pending-finish queue" docstring for the bug this closes). Gated on the
  // write outbox being empty first — a finish attempted before its
  // session's own sets have actually synced would just no-op against a
  // `workouts` row that doesn't exist yet (matches zero rows, no error),
  // getting removed from the queue as if it succeeded while never actually
  // setting `finished_at`.
  const drainFinishes = useCallback(async (userId: string) => {
    if (!readPendingFinishes(userId).length) return
    await drainPendingFinishesQueue(userId, {
      fetchFinish: async (body) => {
        const res = await fetch('/api/session/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        return { ok: res.ok, status: res.status }
      },
    })
  }, [])

  const drainOutboxThenFinishes = useCallback(async (userId: string) => {
    await drainOutbox(userId)
    if (readOutbox(userId).length === 0) {
      await drainFinishes(userId)
    }
  }, [drainOutbox, drainFinishes])

  // Drain on reconnect
  useEffect(() => {
    const userId = appState.user?.id
    if (online && userId) {
      setOutboxCount(readOutbox(userId).length)
      drainOutboxThenFinishes(userId)
    }
  }, [online, appState.user?.id, drainOutboxThenFinishes])

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
      split: null, coachingContext: null, plan: null,
      exerciseLogs: [], savedLogs: null, savedExIdx: 0, savedSnapshot: {},
      sessionSwaps: [], sessionSyncStatus: null,
      weightDecisions: {}, sessionRpe: null,
      detectedSession: null, detectedSplit: null, pendingDbResume: false,
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
      sessionSwaps: mergeSessionSwap(prev.sessionSwaps, oldName, newName),
      plan: prev.plan
        ? prev.plan.map(p =>
            p.exercise.name === oldName
              ? {
                  ...p,
                  exercise: { ...p.exercise, name: newName, canonicalName: newName },
                  // Swapped-in exercise has a different identity than the
                  // one the coaching engine analyzed — clear its
                  // engine-derived state rather than carry stale flags
                  // forward under the wrong exerciseId. Recomputed next
                  // time CoachingContextScreen loads.
                  // GYM-97 fix #3: salted per swap instance so two
                  // independently swapped-in exercises sharing a name never
                  // collide on exerciseId (React keys, weightDecisions map).
                  exerciseId: unresolvedExerciseId(newName, crypto.randomUUID()),
                  targetWeight: null,
                  targetWeightOrigin: null,
                  flags: [],
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

        // Drain any offline-finish outbox entries queued while offline
        // (GYM-49), and any pending /api/session/finish calls that couldn't
        // be confirmed (offline, or a transient failure — see
        // lib/sessionStorage.ts's "Pending-finish queue" docstring).
        // Awaited here — unlike the online-status effect's fire-and-forget
        // drain above — specifically to close the race where an
        // already-fully-logged-but-not-yet-finished workout would otherwise
        // get offered as "resume" by the DB-fallback check just below,
        // since `/api/session/today` treats any `finished_at IS NULL` row
        // as an in-progress session (see lib/sessionResume.ts's invariant
        // comment on shouldResumeFromDb).
        const outboxPending = readOutbox(user.id)
        const finishPending = readPendingFinishes(user.id)
        setOutboxCount(outboxPending.length)
        if (outboxPending.length || finishPending.length) {
          await drainOutboxThenFinishes(user.id)
        }
      }

      const activeSplits = resolvedProgram?.splits ?? []

      // 1. localStorage — fast, full data (per-user keyed)
      const stored = user ? loadSessionFromStorage(user.id) : null
      if (shouldResumeFromLocal(stored, activeSplits)) {
        const splitId = await resolveSplitIdByName(resolvedUserProgramId, stored!.split)
        setAppState(prev => ({ ...prev, detectedSession: stored, userProgramSplitId: splitId }))
        setScreen('resume-prompt')
        return
      }
      if (stored && user) clearSessionFromStorage(user.id)

      // 2. DB fallback — check for today's workout in the active program
      try {
        const res = await fetch('/api/session/today')
        const data = await res.json()
        if (shouldResumeFromDb(data, activeSplits)) {
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
    // GYM-97 fix #7: sessionRpe now lives in appState (see PreSaveSummaryScreen
    // prop wiring below), not a parameter — lifting it there is what makes it
    // survive a remount of PreSaveSummaryScreen.
    const sessionRpe = appState.sessionRpe
    const today = new Date().toISOString().split('T')[0]
    const snapshot = appState.savedSnapshot

    // Built once, reused by every branch below that needs to queue a durable
    // retry for /api/session/finish (see lib/sessionStorage.ts's
    // "Pending-finish queue" docstring for the bug this closes). `null` when
    // there's no split id to finish against — matches the pre-existing
    // behavior of that case (finish would 400 either way; nothing to
    // usefully retry).
    const finishPayload = appState.userProgramSplitId
      ? { date: today, userProgramSplitId: appState.userProgramSplitId, sessionRpe }
      : null

    const patchPromises: Promise<any>[] = []
    const newEntries: any[] = []

    for (const exLog of logs) {
      for (let si = 0; si < exLog.sets.length; si++) {
        const set = exLog.sets[si]
        if (!set.completed) continue

        const key = `${exLog.exerciseName}:${si + 1}`
        const prior = snapshot[key]

        if (prior) {
          const changes = computeFinishSaveChanges(set, exLog, prior)

          if (changes) {
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
            // Prefer the log's own already-resolved unit (set by
            // ActiveSessionScreen's kg/lbs toggle — see lib/store.ts's
            // ExerciseLog.unit docstring) so an in-session unit override
            // reaches the DB even for a set saved via this Finish-time path
            // rather than mid-session autosave. Falls back to the routine's
            // static default exactly as before for any log that never set it.
            unit: exLog.unit ?? ((planItem?.exercise.weightUnit === 'pins' ? 'Pins' : 'Lbs') as 'Lbs' | 'Pins'),
            userProgramSplitId: appState.userProgramSplitId ?? undefined,
            rir: set.rir ?? undefined,
            ...(exLog.equipmentInstanceId ? { equipmentInstanceId: exLog.equipmentInstanceId } : {}),
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
      // Definitely offline — skip the fetch entirely and queue. The finish
      // call would fail exactly the same way (no network), so queue it too
      // rather than attempting and silently dropping it as the pre-fix code
      // did — see lib/sessionStorage.ts's "Pending-finish queue" docstring.
      if (appState.user) {
        enqueueOutbox(appState.user.id, writeBody)
        if (finishPayload) enqueuePendingFinish(appState.user.id, finishPayload)
      }
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
      // Network error mid-session (went offline after check) — queue.
      // Finish would fail the same way, so it's queued unconditionally here
      // (not just when there were new entries) — see lib/sessionStorage.ts's
      // "Pending-finish queue" docstring.
      if (writeBody && appState.user) {
        enqueueOutbox(appState.user.id, writeBody)
        setOutboxCount(readOutbox(appState.user.id).length)
      }
      if (finishPayload && appState.user) enqueuePendingFinish(appState.user.id, finishPayload)
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

    // Fire-and-forget, but no longer silently: a non-2xx response or a
    // thrown network error queues a durable retry instead of leaving
    // `finished_at` permanently NULL — see lib/sessionStorage.ts's
    // "Pending-finish queue" docstring for the resume/Start-Fresh
    // cascade-delete this was previously exposed to.
    if (finishPayload) {
      const userId = appState.user?.id
      fetch('/api/session/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finishPayload),
      })
        .then(res => {
          if (!res.ok && userId) enqueuePendingFinish(userId, finishPayload)
        })
        .catch(() => {
          if (userId) enqueuePendingFinish(userId, finishPayload)
        })
    }

    updateState({
      exerciseLogs: logs, savedLogs: null, savedExIdx: 0, savedSnapshot: {},
      lastSplit: appState.split, sessionSyncStatus: syncStatus, workoutStartedAt: null,
    })
    navigate('session-summary')
  }

  // Resume a detected session — either the fast localStorage path (full
  // data already in memory) or the DB-fallback path (only the split name is
  // known yet; the real completed-set data is fetched and merged once the
  // plan resolves, in the CoachingContextScreen onDataLoaded handler below).
  function handleResume() {
    const s = appState.detectedSession
    if (s) {
      updateState({
        split: s.split,
        savedLogs: s.logs,
        savedExIdx: s.exIdx,
        savedSnapshot: s.snapshot,
        workoutStartedAt: s.startedAt ?? null,
      })
      navigate('coaching-context')
      return
    }

    // No localStorage session — fall back to the DB-detected split
    // (detectedSplit). This is the case a fresh device/cleared storage
    // produces: ResumePromptScreen rendered off detectedSplit alone, and
    // "Continue Today" must actually resume, not no-op and strand the user
    // on a screen whose only other button (Start Fresh) deletes real data.
    const split = appState.detectedSplit
    if (!split) return
    updateState({ split, pendingDbResume: true })
    navigate('coaching-context')
  }

  // Start fresh — if today has DB-saved exercises, prompt for confirmation
  function handleStartFresh() {
    if (appState.userProgramSplitId) {
      updateState({ showStartFreshConfirm: true })
      return
    }
    if (appState.user) clearSessionFromStorage(appState.user.id)
    updateState({ detectedSession: null, detectedSplit: null, pendingDbResume: false })
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
    updateState({ detectedSession: null, detectedSplit: null, pendingDbResume: false, showStartFreshConfirm: false })
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
                updateState({ split: splitName, userProgramSplitId: splitId, savedLogs: null, savedExIdx: 0, savedSnapshot: {}, pendingDbResume: false })
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
              userProgramSplitId={appState.userProgramSplitId ?? undefined}
              onDataLoaded={async (context, plan) => {
                // DB-fallback resume in flight (see handleResume): the plan
                // just resolved for the first time, so this is the one
                // moment to fetch the real completed-set data and merge it
                // in — never leave the user on a blank/default plan when
                // Supabase actually has their logged sets for today.
                if (appState.pendingDbResume && appState.userProgramSplitId) {
                  try {
                    const res = await fetch(
                      `/api/session/today/details?userProgramSplitId=${encodeURIComponent(appState.userProgramSplitId)}`
                    )
                    const data = await res.json()
                    if (data.found) {
                      const { logs, exIdx, snapshot } = buildResumeStateFromDb(plan, data.exercises ?? [])
                      updateState({
                        coachingContext: context, plan,
                        savedLogs: logs, savedExIdx: exIdx, savedSnapshot: snapshot,
                        workoutStartedAt: data.startedAt ?? null,
                        pendingDbResume: false, detectedSplit: null,
                      })
                      return
                    }
                  } catch (err) {
                    console.error('Failed to hydrate DB-fallback resume:', err)
                  }
                  // Fetch failed or nothing found server-side after all —
                  // still proceed with the plan (never strand the user),
                  // just without resumable progress to merge in.
                  updateState({ coachingContext: context, plan, pendingDbResume: false, detectedSplit: null })
                  return
                }
                updateState({ coachingContext: context, plan })
              }}
              coachingContext={appState.coachingContext}
              plan={appState.plan}
              weightDecisions={appState.weightDecisions}
              onWeightDecision={(exerciseId, accepted) => {
                // GYM-97 fix #2: the decision itself now lives in appState
                // (survives remounting this screen), not just the plan
                // mutation that "keep weight" (accepted=false) performs.
                setAppState(prev => {
                  const weightDecisions = { ...prev.weightDecisions, [exerciseId]: accepted }
                  if (accepted || !prev.plan) return { ...prev, weightDecisions }
                  const item = prev.plan.find(p => p.exerciseId === exerciseId)
                  const flag = item?.flags.find(f => f.kind === 'weight-too-heavy')
                  const originalWeight = flag?.params.weight
                  if (typeof originalWeight !== 'number') return { ...prev, weightDecisions }
                  const updatedPlan = prev.plan.map(p =>
                    p.exerciseId === exerciseId
                      ? { ...p, targetWeight: originalWeight, targetWeightOrigin: 'structural' as const }
                      : p
                  )
                  return { ...prev, weightDecisions, plan: updatedPlan }
                })
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
              userId={appState.user?.id}
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
                const newEntry: SessionExercisePlan = {
                  exercise: {
                    name,
                    canonicalName: name,
                    sets: avgSets,
                    repRange: [8, 12],
                    backup: null,
                    split: appState.split!,
                  },
                  // Mid-session add — not resolved through the coaching
                  // engine's routine-wiring pass, so no real DB exerciseId
                  // yet (matched.id from the client-bundled catalog isn't
                  // the DB UUID either — see lib/coaching/matching.ts). The
                  // unresolved-id sentinel makes this loudly non-matching
                  // rather than silently colliding with a real id.
                  // GYM-97 fix #3: salted per add instance so two
                  // independently added exercises sharing a name never
                  // collide on exerciseId (React keys, weightDecisions map).
                  exerciseId: unresolvedExerciseId(name, crypto.randomUUID()),
                  targetWeight: prefillWeight,
                  targetWeightOrigin: null,
                  flags: [],
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
              userProgramSplitId={appState.userProgramSplitId ?? undefined}
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
              sessionRpe={appState.sessionRpe}
              onSessionRpeChange={(v) => updateState({ sessionRpe: v })}
              onSave={handleSaveSession}
              onBack={() => navigate('active-session')}
              onSetDefault={appState.user && appState.userProgramSplitId ? async (oldName, newName) => {
                const supabase = createSupabaseBrowserClient()
                await permanentlySwapExercise(supabase, appState.user!.id, appState.userProgramSplitId!, oldName, newName).catch(() => {})
              } : undefined}
            />
          )}

          {screen === 'session-summary' && appState.user && appState.exerciseLogs && appState.split && appState.plan && (
            <SessionSummaryScreen
              userId={appState.user.id}
              split={appState.split}
              exerciseLogs={appState.exerciseLogs}
              plan={appState.plan}
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
            <ProgressHistoryScreen
              onBack={() => setShowProgressHistory(false)}
              userId={appState.user?.id}
              userProgramSplitId={appState.userProgramSplitId ?? undefined}
            />
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

        {/* Reports tab — GYM-19/Section 6 + Phase 4: ProgressHistoryScreen is
            now the real landing screen (no back arrow — a top-level tab, not
            an overlay). It stays reachable from Library → History too (the
            `showProgressHistory` branch above) — that entry point still
            works and wasn't removed, just no longer the only way in. */}
        <div style={{ height: '100%', display: activeTab === 'reports' ? 'flex' : 'none', flexDirection: 'column' }}>
          <ProgressHistoryScreen
            userId={appState.user?.id}
            userProgramSplitId={appState.userProgramSplitId ?? undefined}
            isActive={activeTab === 'reports'}
          />
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

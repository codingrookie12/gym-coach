/**
 * Regression coverage for the GYM-94 deferred-write + Undo controller
 * (lib/pendingSplitOp.ts) that CustomProgramBuilderScreen's edit-mode
 * handleAddExercise/handleRemoveExercise use to close the compliance gap
 * flagged in the audit: those two handlers used to write to
 * `user_routine_exercises` immediately on tap, with no Undo toast at all.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  createPendingOpController,
  restoreExerciseSorted,
  replaceExercise,
  dropExercise,
  type PendingOp,
} from './pendingSplitOp'
import type { RoutineExerciseRow } from './userRoutine'

function makeOp(overrides?: Partial<PendingOp>): PendingOp {
  return {
    splitId: 'split-a',
    message: 'Bench Press added to Push',
    flush: vi.fn().mockResolvedValue(undefined),
    undo: vi.fn(),
    ...overrides,
  }
}

function makeRow(overrides?: Partial<RoutineExerciseRow>): RoutineExerciseRow {
  return {
    id: 'row-1',
    exercise_name: 'Bench Press',
    canonical_name: 'Bench Press',
    sets: 3,
    rep_range_min: 8,
    rep_range_max: 12,
    backup_name: null,
    weight_unit: 'lbs',
    weight_convention: null,
    sort_order: 0,
    equipment: null,
    ...overrides,
  }
}

describe('createPendingOpController — add-then-undo (no persist)', () => {
  it('undo cancels the pending op and never calls flush', () => {
    const onChange = vi.fn()
    const controller = createPendingOpController(onChange)
    const op = makeOp()

    controller.start(op)
    expect(controller.current).toBe(op)
    expect(onChange).toHaveBeenLastCalledWith(op)

    controller.undo()

    expect(op.undo).toHaveBeenCalledOnce()
    expect(op.flush).not.toHaveBeenCalled()
    expect(controller.current).toBeNull()
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('undo is a no-op when nothing is pending', () => {
    const controller = createPendingOpController(vi.fn())
    expect(() => controller.undo()).not.toThrow()
    expect(controller.current).toBeNull()
  })
})

describe('createPendingOpController — add-then-timeout (persists)', () => {
  it('flush (simulating the toast timing out) commits exactly once and never calls undo', async () => {
    const onChange = vi.fn()
    const controller = createPendingOpController(onChange)
    const op = makeOp()

    controller.start(op)
    await controller.flush()

    expect(op.flush).toHaveBeenCalledOnce()
    expect(op.undo).not.toHaveBeenCalled()
    expect(controller.current).toBeNull()
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('flush is a no-op when nothing is pending', async () => {
    const controller = createPendingOpController(vi.fn())
    await expect(controller.flush()).resolves.toBeUndefined()
  })

  it('a flush that throws still clears the pending state (op.flush owns its own rollback)', async () => {
    const controller = createPendingOpController(vi.fn())
    const op = makeOp({ flush: vi.fn().mockRejectedValue(new Error('insert failed')) })
    controller.start(op)

    await expect(controller.flush()).resolves.toBeUndefined()
    expect(controller.current).toBeNull()
  })
})

describe('createPendingOpController — remove-then-undo restores the exercise', () => {
  it('undo() invokes the remove op\'s undo, which the caller wires to restoreExerciseSorted', () => {
    const exercises = [makeRow({ id: 'a', sort_order: 0 }), makeRow({ id: 'c', sort_order: 2, exercise_name: 'Squat' })]
    const removed = makeRow({ id: 'b', sort_order: 1, exercise_name: 'Row' })
    let current = exercises

    const controller = createPendingOpController(vi.fn())
    controller.start(makeOp({
      splitId: 'split-a',
      message: 'Row removed',
      flush: vi.fn().mockResolvedValue(undefined),
      undo: () => { current = restoreExerciseSorted(current, removed) },
    }))

    controller.undo()

    expect(current.map(e => e.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('createPendingOpController — a second op (even on a different split) flushes the first', () => {
  it('starting opB while opA is pending commits opA and stages opB', () => {
    const onChange = vi.fn()
    const controller = createPendingOpController(onChange)
    const opA = makeOp({ splitId: 'split-a', message: 'A added' })
    const opB = makeOp({ splitId: 'split-b', message: 'B added' })

    controller.start(opA)
    controller.start(opB)

    expect(opA.flush).toHaveBeenCalledOnce()
    expect(opA.undo).not.toHaveBeenCalled()
    expect(controller.current).toBe(opB)
    expect(onChange).toHaveBeenLastCalledWith(opB)
  })

  it('opB can still be undone independently after opA auto-committed', () => {
    const controller = createPendingOpController(vi.fn())
    const opA = makeOp({ splitId: 'split-a' })
    const opB = makeOp({ splitId: 'split-b' })

    controller.start(opA)
    controller.start(opB)
    controller.undo()

    expect(opB.undo).toHaveBeenCalledOnce()
    expect(opA.flush).toHaveBeenCalledOnce() // from being displaced, not from opB's undo
    expect(controller.current).toBeNull()
  })
})

describe('createPendingOpController — discard (split deleted out from under a pending op)', () => {
  it('drops the op for the matching splitId without flushing or undoing', () => {
    const onChange = vi.fn()
    const controller = createPendingOpController(onChange)
    const op = makeOp({ splitId: 'split-a' })
    controller.start(op)

    controller.discard(o => o.splitId === 'split-a')

    expect(op.flush).not.toHaveBeenCalled()
    expect(op.undo).not.toHaveBeenCalled()
    expect(controller.current).toBeNull()
    expect(onChange).toHaveBeenLastCalledWith(null)
  })

  it('leaves a pending op for a different splitId untouched', () => {
    const controller = createPendingOpController(vi.fn())
    const op = makeOp({ splitId: 'split-b' })
    controller.start(op)

    controller.discard(o => o.splitId === 'split-a')

    expect(controller.current).toBe(op)
    expect(op.flush).not.toHaveBeenCalled()
    expect(op.undo).not.toHaveBeenCalled()
  })

  it('discard with no predicate drops unconditionally', () => {
    const controller = createPendingOpController(vi.fn())
    const op = makeOp()
    controller.start(op)

    controller.discard()

    expect(controller.current).toBeNull()
    expect(op.flush).not.toHaveBeenCalled()
    expect(op.undo).not.toHaveBeenCalled()
  })

  it('is a no-op when nothing is pending', () => {
    const controller = createPendingOpController(vi.fn())
    expect(() => controller.discard()).not.toThrow()
  })
})

describe('array-transform helpers', () => {
  it('restoreExerciseSorted re-inserts at the correct sort_order position, not just appended', () => {
    const exercises = [makeRow({ id: 'a', sort_order: 0 }), makeRow({ id: 'c', sort_order: 2 })]
    const removed = makeRow({ id: 'b', sort_order: 1 })

    const result = restoreExerciseSorted(exercises, removed)

    expect(result.map(e => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('replaceExercise swaps the temp row for the real row by id', () => {
    const temp = makeRow({ id: 'temp-1' })
    const real = makeRow({ id: 'real-1' })
    const exercises = [makeRow({ id: 'other' }), temp]

    const result = replaceExercise(exercises, 'temp-1', real)

    expect(result).toEqual([makeRow({ id: 'other' }), real])
  })

  it('dropExercise removes only the matching temp row', () => {
    const exercises = [makeRow({ id: 'keep' }), makeRow({ id: 'temp-1' })]

    const result = dropExercise(exercises, 'temp-1')

    expect(result.map(e => e.id)).toEqual(['keep'])
  })
})

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface DragState {
  id: string
  fromIndex: number
  startY: number
  pointerY: number
  rowHeights: number[]
  rowMidpoints: number[]
}

interface UsePointerReorderOptions<T> {
  items: T[]
  getId: (item: T) => string
  onReorder: (newOrder: T[]) => void
  disabled?: boolean
}

interface UsePointerReorderResult {
  dragId: string | null
  fromIndex: number | null
  targetIndex: number | null
  pointerDelta: number
  registerRow: (id: string) => (el: HTMLElement | null) => void
  handlePointerDown: (id: string) => (e: React.PointerEvent) => void
  getRowOffset: (index: number) => number
}

export function usePointerReorder<T>({
  items,
  getId,
  onReorder,
  disabled,
}: UsePointerReorderOptions<T>): UsePointerReorderResult {
  const [drag, setDrag] = useState<DragState | null>(null)
  const rowEls = useRef<Map<string, HTMLElement>>(new Map())
  const itemsRef = useRef(items)
  itemsRef.current = items

  const registerRow = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) rowEls.current.set(id, el)
    else rowEls.current.delete(id)
  }, [])

  const handlePointerDown = useCallback((id: string) => (e: React.PointerEvent) => {
    if (disabled) return
    if (e.button !== undefined && e.button !== 0) return
    const fromIndex = itemsRef.current.findIndex(item => getId(item) === id)
    if (fromIndex < 0) return

    const heights: number[] = []
    const midpoints: number[] = []
    itemsRef.current.forEach(item => {
      const el = rowEls.current.get(getId(item))
      if (!el) {
        heights.push(0)
        midpoints.push(0)
        return
      }
      const rect = el.getBoundingClientRect()
      heights.push(rect.height)
      midpoints.push(rect.top + rect.height / 2)
    })

    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)

    console.log('[drag-start]', { id, fromIndex, startY: e.clientY })

    setDrag({
      id,
      fromIndex,
      startY: e.clientY,
      pointerY: e.clientY,
      rowHeights: heights,
      rowMidpoints: midpoints,
    })
  }, [disabled, getId])

  const targetIndex = drag ? computeTargetIndex(drag) : null

  useEffect(() => {
    if (!drag) return

    function onMove(e: PointerEvent) {
      setDrag(prev => (prev && prev.id === drag!.id ? { ...prev, pointerY: e.clientY } : prev))
    }

    function onEnd() {
      const finalTarget = drag ? computeTargetIndex(drag) : null
      console.log('[drag-end]', {
        fromIndex: drag?.fromIndex,
        finalTarget,
        pointerDelta: drag ? drag.pointerY - drag.startY : null,
      })
      setDrag(null)
      if (finalTarget !== null && drag && finalTarget !== drag.fromIndex) {
        const next = itemsRef.current.slice()
        const [moved] = next.splice(drag.fromIndex, 1)
        next.splice(finalTarget, 0, moved)
        onReorder(next)
      }
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
    }
  }, [drag, onReorder])

  const pointerDelta = drag ? drag.pointerY - drag.startY : 0
  const fromIndex = drag?.fromIndex ?? null
  const avgRowHeight = drag && drag.rowHeights.length
    ? drag.rowHeights.reduce((a, b) => a + b, 0) / drag.rowHeights.length
    : 0

  const getRowOffset = useCallback(
    (index: number) => {
      if (!drag || targetIndex === null) return 0
      return reorderDragOffset(index, drag.fromIndex, targetIndex, pointerDelta, avgRowHeight)
    },
    [drag, targetIndex, pointerDelta, avgRowHeight]
  )

  return {
    dragId: drag?.id ?? null,
    fromIndex,
    targetIndex,
    pointerDelta,
    registerRow,
    handlePointerDown,
    getRowOffset,
  }
}

function computeTargetIndex(drag: DragState): number {
  const draggedMid = drag.rowMidpoints[drag.fromIndex] + (drag.pointerY - drag.startY)
  let target = drag.fromIndex
  for (let i = 0; i < drag.rowMidpoints.length; i++) {
    if (i === drag.fromIndex) continue
    if (draggedMid < drag.rowMidpoints[i] && i < drag.fromIndex) {
      target = Math.min(target, i)
    } else if (draggedMid > drag.rowMidpoints[i] && i > drag.fromIndex) {
      target = Math.max(target, i)
    }
  }
  return target
}

export function reorderDragOffset(
  index: number,
  fromIndex: number,
  toIndex: number,
  pointerDelta: number,
  rowHeight: number
): number {
  if (index === fromIndex) return pointerDelta
  if (toIndex > fromIndex && index > fromIndex && index <= toIndex) return -rowHeight
  if (toIndex < fromIndex && index < fromIndex && index >= toIndex) return rowHeight
  return 0
}

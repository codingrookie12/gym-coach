'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Split, SPLIT_ORDER } from '@/lib/routines'

interface PreSessionScreenProps {
  initialSplit: Split
  onSelectSplit: (split: Split) => void
  onSettings: () => void
  onEquipment: () => void
  unavailableCount: number
  pendingCustomCount?: number
}

const SPLIT_DATA: { label: Split; muscles: string[]; index: string }[] = [
  { label: 'Push', muscles: ['Chest', 'Shoulders', 'Triceps'], index: '01' },
  { label: 'Pull', muscles: ['Back', 'Biceps', 'Forearms'], index: '02' },
  { label: 'Legs', muscles: ['Quads', 'Hams', 'Glutes', 'Calves'], index: '03' },
]

const CARD_WIDTH_RATIO = 0.78  // 78% of container width
const CARD_GAP = 12
const SWIPE_THRESHOLD = 40

export default function PreSessionScreen({
  initialSplit,
  onSelectSplit,
  onSettings,
  onEquipment,
  unavailableCount,
  pendingCustomCount = 0,
}: PreSessionScreenProps) {
  const [selectedIdx, setSelectedIdx] = useState(() => SPLIT_ORDER.indexOf(initialSplit))
  const [hasSwiped, setHasSwiped] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Drag state
  const dragStartX = useRef<number | null>(null)
  const dragCurrentX = useRef<number>(0)
  const isDragging = useRef(false)

  const getOffset = useCallback((idx: number, liveOffset = 0) => {
    const container = containerRef.current
    if (!container) return 0
    const containerWidth = container.offsetWidth
    const cardWidth = containerWidth * CARD_WIDTH_RATIO
    const trackWidth = SPLIT_DATA.length * cardWidth + (SPLIT_DATA.length - 1) * CARD_GAP
    const centerOffset = (containerWidth - cardWidth) / 2
    return -(idx * (cardWidth + CARD_GAP)) + centerOffset + liveOffset
  }, [])

  const setTrackTransform = useCallback((offset: number, animated: boolean) => {
    const track = trackRef.current
    if (!track) return
    track.style.transition = animated ? 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
    track.style.transform = `translateX(${offset}px)`
  }, [])

  // Initial position: set before paint to avoid flash
  useLayoutEffect(() => {
    setTrackTransform(getOffset(selectedIdx), false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally runs once on mount only

  // Subsequent selectedIdx changes: animate
  useEffect(() => {
    setTrackTransform(getOffset(selectedIdx), true)
  }, [selectedIdx, getOffset, setTrackTransform])

  // Recalculate on resize
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setTrackTransform(getOffset(selectedIdx), false)
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [selectedIdx, getOffset, setTrackTransform])

  const handleDragStart = useCallback((clientX: number) => {
    dragStartX.current = clientX
    dragCurrentX.current = 0
    isDragging.current = true
    const track = trackRef.current
    if (track) track.style.transition = 'none'
  }, [])

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging.current || dragStartX.current === null) return
    const delta = clientX - dragStartX.current
    dragCurrentX.current = delta
    setTrackTransform(getOffset(selectedIdx, delta), false)
  }, [selectedIdx, getOffset, setTrackTransform])

  const handleDragEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    const delta = dragCurrentX.current

    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      const direction = delta < 0 ? 1 : -1
      const nextIdx = Math.max(0, Math.min(SPLIT_DATA.length - 1, selectedIdx + direction))
      setSelectedIdx(nextIdx)
      if (!hasSwiped) setHasSwiped(true)
    } else {
      // Snap back
      setTrackTransform(getOffset(selectedIdx), true)
    }

    dragStartX.current = null
    dragCurrentX.current = 0
  }, [selectedIdx, hasSwiped, getOffset, setTrackTransform])

  // Touch handlers
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX)
  }, [handleDragStart])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX)
  }, [handleDragMove])

  const onTouchEnd = useCallback(() => {
    handleDragEnd()
  }, [handleDragEnd])

  // Mouse handlers
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    handleDragStart(e.clientX)
  }, [handleDragStart])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    handleDragMove(e.clientX)
  }, [handleDragMove])

  const onMouseUp = useCallback(() => {
    handleDragEnd()
  }, [handleDragEnd])

  const onMouseLeave = useCallback(() => {
    if (isDragging.current) handleDragEnd()
  }, [handleDragEnd])

  // Keyboard navigation
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setSelectedIdx(i => Math.max(0, i - 1))
      setHasSwiped(true)
    } else if (e.key === 'ArrowRight') {
      setSelectedIdx(i => Math.min(SPLIT_DATA.length - 1, i + 1))
      setHasSwiped(true)
    } else if (e.key === 'Enter' || e.key === ' ') {
      onSelectSplit(SPLIT_ORDER[selectedIdx])
    }
  }, [selectedIdx, onSelectSplit])

  const selectedSplit = SPLIT_ORDER[selectedIdx]

  return (
    <div
      className="screen-enter flex flex-col"
      style={{ height: '100%', background: 'var(--bg)' }}
    >
      {/* Header */}
      <div
        className="safe-top flex items-center justify-between px-5"
        style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <span className="font-display" style={{ fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '0.08em' }}>
            GYM COACH
          </span>
          <span className="font-mono" style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
            v5.1
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onEquipment}
            style={{
              background: 'none',
              border: `1px solid ${unavailableCount > 0 ? 'var(--rust)' : 'var(--border-2)'}`,
              borderRadius: '2px',
              padding: '7px 12px',
              color: unavailableCount > 0 ? 'var(--rust)' : 'var(--text-mid)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: '0.95rem',
              letterSpacing: '0.1em',
              transition: 'border-color 0.12s, color 0.12s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="7" width="3" height="10" rx="1" />
              <rect x="19" y="7" width="3" height="10" rx="1" />
              <rect x="6" y="10" width="12" height="4" rx="1" />
            </svg>
            EQUIP{unavailableCount > 0 && <span style={{ marginLeft: '2px' }}>({unavailableCount})</span>}
          </button>
          <button
            onClick={onSettings}
            style={{
              background: 'none',
              border: '1px solid var(--border-2)',
              borderRadius: '2px',
              padding: '7px 12px',
              color: 'var(--text-mid)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'Bebas Neue, sans-serif',
              fontSize: '0.95rem',
              letterSpacing: '0.1em',
              transition: 'border-color 0.12s, color 0.12s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            WEIGHTS
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div
        ref={containerRef}
        className="flex-1"
        style={{ overflow: 'hidden', cursor: 'grab', userSelect: 'none', position: 'relative', minHeight: 0 }}
        tabIndex={0}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onKeyDown={onKeyDown}
      >
        <div
          ref={trackRef}
          style={{
            display: 'flex',
            gap: `${CARD_GAP}px`,
            height: '100%',
            alignItems: 'center',
            willChange: 'transform',
          }}
        >
          {SPLIT_DATA.map((s, i) => {
            const isSelected = i === selectedIdx
            return (
              <div
                key={s.label}
                onClick={() => {
                  if (i === selectedIdx) return
                  setSelectedIdx(i)
                  setHasSwiped(true)
                }}
                style={{
                  flexShrink: 0,
                  width: `calc(${CARD_WIDTH_RATIO * 100}vw)`,
                  height: '72%',
                  border: `1px solid ${isSelected ? 'var(--accent-border)' : 'var(--border)'}`,
                  borderRadius: '2px',
                  background: isSelected ? 'var(--surface)' : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '16px',
                  position: 'relative',
                  transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.2s, background 0.2s',
                  transform: isSelected ? 'scale(1)' : 'scale(0.92)',
                  cursor: isSelected ? 'default' : 'pointer',
                }}
              >
                {/* Index */}
                <span
                  className="font-mono"
                  style={{
                    position: 'absolute',
                    top: '16px',
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontSize: '0.55rem',
                    color: isSelected ? 'var(--text-secondary)' : 'var(--border-2)',
                    letterSpacing: '0.1em',
                    transition: 'color 0.2s',
                  }}
                >
                  {s.index}
                </span>

                {/* Split name */}
                <span
                  className="font-display"
                  style={{
                    fontSize: 'clamp(3.5rem, 16vw, 5rem)',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    lineHeight: 1,
                    letterSpacing: '0.04em',
                    transition: 'color 0.2s',
                  }}
                >
                  {s.label.toUpperCase()}
                </span>

                {/* Accent bar */}
                <div
                  style={{
                    width: '24px',
                    height: '2px',
                    background: 'var(--accent)',
                    opacity: isSelected ? 1 : 0.15,
                    transition: 'opacity 0.2s',
                  }}
                />

                {/* Muscles */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  {s.muscles.map((m) => (
                    <span
                      key={m}
                      className="font-mono"
                      style={{
                        fontSize: '0.55rem',
                        color: isSelected ? 'var(--text-secondary)' : 'var(--border-2)',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        transition: 'color 0.2s',
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div
        className="safe-bottom"
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <button
          className="btn-primary"
          onClick={() => onSelectSplit(selectedSplit)}
        >
          START {selectedSplit.toUpperCase()}
        </button>
        {!hasSwiped && (
          <span
            className="font-mono"
            style={{
              fontSize: '0.55rem',
              color: 'var(--text-secondary)',
              letterSpacing: '0.12em',
              textAlign: 'center',
            }}
          >
            SWIPE TO CHANGE DAY
          </span>
        )}
      </div>
    </div>
  )
}

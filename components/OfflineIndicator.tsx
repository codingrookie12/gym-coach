'use client'

import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface OfflineIndicatorProps {
  hasPendingOutbox: boolean
  isSyncing: boolean
}

export default function OfflineIndicator({ hasPendingOutbox, isSyncing }: OfflineIndicatorProps) {
  const online = useOnlineStatus()
  const visible = !online || hasPendingOutbox

  if (!visible) return null

  let message: string
  if (isSyncing) {
    message = 'Syncing your last session…'
  } else if (!online) {
    message = hasPendingOutbox
      ? 'Offline — session saved on this device, will sync when back online.'
      : 'Offline — your workout is saved on this device.'
  } else {
    // online but outbox non-empty (about to drain)
    message = 'Back online — syncing your last session…'
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '72px',     // above the tab bar
        left: '12px',
        right: '12px',
        zIndex: 100,
        background: 'var(--surface)',
        border: '1px solid var(--border-2)',
        borderRadius: '2px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      {/* Status dot */}
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        flexShrink: 0,
        background: isSyncing || (online && hasPendingOutbox)
          ? 'var(--accent)'
          : 'var(--rust)',
      }} />
      <span
        className="font-mono"
        style={{ fontSize: '0.6rem', color: 'var(--text-mid)', letterSpacing: '0.06em', lineHeight: 1.4 }}
      >
        {message}
      </span>
    </div>
  )
}

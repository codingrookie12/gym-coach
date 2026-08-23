'use client'

import { useTranslations } from 'next-intl'

export type ActiveTab = 'train' | 'library' | 'reports' | 'me'

interface BottomTabBarProps {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  libraryBadge?: number
}

interface TabConfig {
  id: ActiveTab
  label: string
  icon: React.ReactNode
}

function TrainIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--accent)' : 'var(--text-secondary)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="3" height="10" rx="1" />
      <rect x="19" y="7" width="3" height="10" rx="1" />
      <rect x="6" y="10" width="12" height="4" rx="1" />
    </svg>
  )
}

function LibraryIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--accent)' : 'var(--text-secondary)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

// GYM-19/Section 6: Reports becomes its own standalone 4th bottom tab
// (Train / Library / Reports / Me), not merged into Library — ratified
// 2026-08-21, overriding the planner's original merged-tab proposal.
function ReportsIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--accent)' : 'var(--text-secondary)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <rect x="7" y="13" width="3" height="5" rx="0.5" />
      <rect x="12" y="9" width="3" height="9" rx="0.5" />
      <rect x="17" y="5" width="3" height="13" rx="0.5" />
    </svg>
  )
}

function MeIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--accent)' : 'var(--text-secondary)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

export default function BottomTabBar({ activeTab, onTabChange, libraryBadge = 0 }: BottomTabBarProps) {
  const t = useTranslations('tabs')

  const tabs: TabConfig[] = [
    { id: 'train', label: t('train'), icon: <TrainIcon active={activeTab === 'train'} /> },
    { id: 'library', label: t('library'), icon: <LibraryIcon active={activeTab === 'library'} /> },
    { id: 'reports', label: t('reports'), icon: <ReportsIcon active={activeTab === 'reports'} /> },
    { id: 'me', label: t('me'), icon: <MeIcon active={activeTab === 'me'} /> },
  ]

  return (
    <div
      className="safe-bottom"
      style={{
        display: 'flex',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)',
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id
        const showBadge = tab.id === 'library' && libraryBadge > 0

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              minHeight: '44px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '10px 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              {tab.icon}
              {showBadge && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-4px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                  }}
                />
              )}
            </div>
            <span
              className="font-mono"
              style={{
                fontSize: '0.5rem',
                letterSpacing: '0.1em',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                transition: 'color 0.12s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

'use client'

interface LoadingScreenProps {
  message?: string
}

export default function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="spinner" />
      <p className="font-mono-display text-sm" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
    </div>
  )
}

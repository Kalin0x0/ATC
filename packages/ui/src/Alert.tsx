import React from 'react'

export type AlertVariant = 'success' | 'warning' | 'danger' | 'info'

export interface AlertProps {
  variant?: AlertVariant
  title?: string
  children: React.ReactNode
  onDismiss?: () => void
}

const STYLES: Record<AlertVariant, { container: string; icon: string }> = {
  success: {
    container: 'bg-[#52c05215] border-[#52c05240] text-[#52c052]',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  warning: {
    container: 'bg-[#e0a05215] border-[#e0a05240] text-[#e0a052]',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  danger: {
    container: 'bg-[#e0525215] border-[#e0525240] text-[#e05252]',
    icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  info: {
    container: 'bg-[#5288e015] border-[#5288e040] text-[#5288e0]',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
}

export function Alert({ variant = 'info', title, children, onDismiss }: AlertProps) {
  const { container, icon } = STYLES[variant]
  return (
    <div className={`flex gap-3 px-4 py-3 rounded-lg border ${container}`} role="alert">
      <svg
        className="w-5 h-5 shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
      </svg>
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-sm">{title}</p>}
        <div className="text-sm opacity-90 mt-0.5">{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

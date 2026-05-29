import React from 'react'

export type DotStatus = 'online' | 'offline' | 'warning' | 'error'

export interface StatusDotProps {
  status: DotStatus
  label?: string
  className?: string
}

const STATUS_STYLES: Record<DotStatus, string> = {
  online:  'bg-[#52c052] shadow-[0_0_6px_#52c05280]',
  offline: 'bg-[#8888aa]',
  warning: 'bg-[#e0a052] shadow-[0_0_6px_#e0a05280]',
  error:   'bg-[#e05252] shadow-[0_0_6px_#e0525280]',
}

const LABEL_STYLES: Record<DotStatus, string> = {
  online:  'text-[#52c052]',
  offline: 'text-[#8888aa]',
  warning: 'text-[#e0a052]',
  error:   'text-[#e05252]',
}

export function StatusDot({ status, label, className = '' }: StatusDotProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${STATUS_STYLES[status]}`} />
      {label && (
        <span className={`text-sm ${LABEL_STYLES[status]}`}>{label}</span>
      )}
    </span>
  )
}

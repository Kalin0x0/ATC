import React from 'react'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'muted'

export interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-[#52c05220] text-[#52c052] border border-[#52c05240]',
  warning: 'bg-[#e0a05220] text-[#e0a052] border border-[#e0a05240]',
  danger:  'bg-[#e0525220] text-[#e05252] border border-[#e0525240]',
  info:    'bg-[#5288e020] text-[#5288e0] border border-[#5288e040]',
  muted:   'bg-[#8888aa18] text-[#8888aa] border border-[#8888aa30]',
}

export function Badge({ variant = 'muted', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium leading-none ${VARIANT_STYLES[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

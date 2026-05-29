import React from 'react'

export interface CardProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}

export function Card({ title, subtitle, actions, className = '', children }: CardProps) {
  const hasHeader = title != null || subtitle != null || actions != null
  return (
    <div
      className={`bg-[#1a1a2e] rounded-lg overflow-hidden border border-[#ffffff0a] ${className}`}
    >
      {hasHeader && (
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#d4af3730]">
          <div className="min-w-0">
            {title && (
              <h3 className="text-[#e8e8f0] font-semibold text-base leading-tight truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-[#8888aa] text-sm mt-0.5 leading-snug">{subtitle}</p>
            )}
          </div>
          {actions && <div className="ml-4 shrink-0">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  disabled?: boolean
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

const BASE =
  'inline-flex items-center justify-center font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0d0d1a] rounded select-none disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[#d4af37] text-[#0d0d1a] hover:bg-[#e8c547] focus:ring-[#d4af37] font-semibold',
  secondary:
    'border border-[#d4af37] text-[#d4af37] bg-transparent hover:bg-[#d4af3714] focus:ring-[#d4af37]',
  danger:
    'bg-[#e05252] text-white hover:bg-[#c94444] focus:ring-[#e05252]',
  ghost:
    'text-[#8888aa] bg-transparent hover:text-[#e8e8f0] hover:bg-[#ffffff0a] focus:ring-[#8888aa]',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5',
  md: 'text-sm px-4 py-2 gap-2',
  lg: 'text-base px-6 py-2.5 gap-2',
}

const SPINNER_SIZES: Record<ButtonSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  children,
  type = 'button',
  className = '',
}: ButtonProps) {
  const spinnerSize = SPINNER_SIZES[size]
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={disabled || loading}
      onClick={loading ? undefined : onClick}
    >
      {loading && (
        <svg
          className={`${spinnerSize} animate-spin shrink-0`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}

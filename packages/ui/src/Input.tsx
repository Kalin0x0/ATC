import React from 'react'

export interface InputProps {
  label?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  type?: React.HTMLInputTypeAttribute
  error?: string
  disabled?: boolean
  id?: string
  className?: string
}

export function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  error,
  disabled = false,
  id,
  className = '',
}: InputProps) {
  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-[#8888aa]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`
          w-full bg-[#16213e] border rounded px-3 py-2 text-sm text-[#e8e8f0]
          placeholder-[#8888aa60] transition-all duration-150 outline-none
          focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-[#e05252] focus:ring-[#e05252]' : 'border-[#ffffff15]'}
        `}
      />
      {error && <p className="text-xs text-[#e05252]">{error}</p>}
    </div>
  )
}

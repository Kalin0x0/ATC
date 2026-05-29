import React from 'react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  error?: string
  disabled?: boolean
  id?: string
  className?: string
  placeholder?: string
}

export function Select({
  label,
  value,
  onChange,
  options,
  error,
  disabled = false,
  id,
  className = '',
  placeholder,
}: SelectProps) {
  const selectId = id ?? (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined)
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-[#8888aa]"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`
          w-full bg-[#16213e] border rounded px-3 py-2 text-sm text-[#e8e8f0]
          transition-all duration-150 outline-none cursor-pointer appearance-none
          focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-[#e05252] focus:ring-[#e05252]' : 'border-[#ffffff15]'}
        `}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-[#e05252]">{error}</p>}
    </div>
  )
}

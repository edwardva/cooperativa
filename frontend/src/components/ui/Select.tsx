import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
}

/**
 * Envoltorio de un <select> nativo con el mismo lenguaje visual que Input.
 * Se mantiene nativo (no Radix) a propósito: conserva el picker accesible del
 * sistema operativo/navegador y el contrato value/onChange que ya usan las
 * páginas, sin requerir adaptar cada call site.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, className, disabled, required, children, ...props }, ref) => {
    const selectId = props.id || props.name || `select-${Math.random().toString(36).substr(2, 9)}`

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-neutral-700 mb-1.5">
            {label}
            {required && <span className="text-error-600 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            className={clsx(
              'w-full appearance-none px-3 py-2 pr-9 text-sm text-neutral-900',
              'bg-white border rounded-lg transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-1',
              'disabled:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-500',
              error
                ? 'border-error-500 focus:border-error-600 focus:ring-error-500'
                : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-500',
              className
            )}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        </div>

        {error && (
          <p id={`${selectId}-error`} className="mt-1.5 text-sm text-error-600" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${selectId}-helper`} className="mt-1.5 text-sm text-neutral-500">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Select.displayName = 'Select'

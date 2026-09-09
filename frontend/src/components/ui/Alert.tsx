import type { HTMLAttributes } from 'react'
import { clsx } from 'clsx'

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'error' | 'info' | 'success'
}

const variantStyles: Record<NonNullable<AlertProps['variant']>, string> = {
  error: 'bg-rose-50 border-rose-200 text-rose-700',
  info: 'bg-sky-50 border-sky-200 text-sky-700',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
}

export const Alert = ({ variant = 'error', className, children, ...props }: AlertProps) => {
  return (
    <div
      role={variant === 'error' ? 'alert' : undefined}
      className={clsx('rounded-lg border px-4 py-2 text-sm', variantStyles[variant], className)}
      {...props}
    >
      {children}
    </div>
  )
}

import type { HTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'neutral' | 'info' | 'purple'
  icon?: ReactNode
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
}

export const Badge = ({ variant = 'neutral', icon, className, children, ...props }: BadgeProps) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  )
}

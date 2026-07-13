import type { HTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export const Card = ({ 
  glass = false,
  hover = false,
  padding = 'md',
  className,
  children,
  ...props 
}: CardProps) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  }

  return (
    <div
      className={clsx(
        'rounded-xl border transition-all duration-200',
        glass 
          ? 'bg-white/80 backdrop-blur-sm border-white/20 shadow-glass' 
          : 'bg-white border-neutral-200 shadow-sm',
        hover && 'hover:shadow-lg hover:scale-[1.01] cursor-pointer',
        paddingStyles[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  action?: ReactNode
}

export const CardHeader = ({ 
  title, 
  description, 
  action,
  className,
  children,
  ...props 
}: CardHeaderProps) => {
  return (
    <div 
      className={clsx('flex items-start justify-between gap-4 mb-4', className)}
      {...props}
    >
      <div className="flex-1 min-w-0">
        {title && (
          <h3 className="text-lg font-semibold text-neutral-900 truncate">
            {title}
          </h3>
        )}
        {description && (
          <p className="mt-1 text-sm text-neutral-600">
            {description}
          </p>
        )}
        {children}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}

export const CardContent = ({ className, children, ...props }: CardContentProps) => {
  return (
    <div className={clsx('text-neutral-700', className)} {...props}>
      {children}
    </div>
  )
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

export const CardFooter = ({ className, children, ...props }: CardFooterProps) => {
  return (
    <div 
      className={clsx('mt-4 pt-4 border-t border-neutral-200', className)} 
      {...props}
    >
      {children}
    </div>
  )
}

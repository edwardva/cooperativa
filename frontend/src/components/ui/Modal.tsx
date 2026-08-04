import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'
import { Card } from './Card'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: ReactNode
  footer?: ReactNode
}

const sizeStyles: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
}

export const Modal = ({ open, onClose, title, description, size = 'md', children, footer }: ModalProps) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm">
      <Card
        className={clsx('max-h-[92vh] w-full overflow-y-auto border-neutral-200', sizeStyles[size])}
      >
        {(title || description) && (
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              {title && <h2 className="text-2xl font-semibold text-neutral-900">{title}</h2>}
              {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition hover:bg-neutral-50"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {children}

        {footer && <div className="mt-6 flex justify-end gap-3 border-t border-neutral-200 pt-4">{footer}</div>}
      </Card>
    </div>
  )
}

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  width?: 'md' | 'lg' | 'xl'
  children: ReactNode
  footer?: ReactNode
}

const widthStyles: Record<NonNullable<DrawerProps['width']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
}

export const Drawer = ({ open, onClose, title, description, width = 'lg', children, footer }: DrawerProps) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={clsx(
          'relative flex h-full w-full flex-col bg-white shadow-xl',
          'animate-in slide-in-from-right duration-200',
          widthStyles[width]
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-6 py-5">
            <div className="min-w-0">
              {title && <h2 className="truncate text-xl font-semibold text-neutral-900">{title}</h2>}
              {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 rounded-lg border border-neutral-200 p-1.5 text-neutral-500 transition hover:bg-neutral-50"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex flex-wrap justify-end gap-3 border-t border-neutral-200 bg-neutral-50/60 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

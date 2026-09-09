import type { ReactNode } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { clsx } from 'clsx'

export interface ActionMenuItem {
  key: string
  label: string
  icon?: ReactNode
  onSelect: () => void
  tone?: 'default' | 'danger' | 'success' | 'warning'
  disabled?: boolean
}

export interface ActionMenuProps {
  /** Elemento disparador (debe ser un único elemento enfocable, ej. <button>). */
  trigger: ReactNode
  /** Ítems agrupados; cada grupo se separa del siguiente con una línea divisoria. */
  groups: ActionMenuItem[][]
  align?: 'start' | 'end'
}

const toneStyles: Record<NonNullable<ActionMenuItem['tone']>, string> = {
  default: 'text-neutral-700 data-[highlighted]:bg-neutral-50 data-[highlighted]:text-neutral-900',
  danger: 'text-rose-700 data-[highlighted]:bg-rose-50',
  success: 'text-emerald-700 data-[highlighted]:bg-emerald-50',
  warning: 'text-amber-700 data-[highlighted]:bg-amber-50',
}

/**
 * Menú de acciones flotante (kebab / overflow) construido sobre
 * @radix-ui/react-dropdown-menu: maneja posicionamiento con detección de
 * colisión, cierre por click-afuera/Escape y navegación por teclado sin
 * matemática manual (a diferencia del portal + useLayoutEffect que reemplaza).
 */
export const ActionMenu = ({ trigger, groups, align = 'end' }: ActionMenuProps) => {
  const visibleGroups = groups.filter((group) => group.length > 0)
  if (visibleGroups.length === 0) return null

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={4}
          collisionPadding={8}
          className="z-50 w-56 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg"
        >
          {visibleGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {groupIndex > 0 && <DropdownMenu.Separator className="my-1 border-t border-neutral-200" />}
              {group.map((item) => (
                <DropdownMenu.Item
                  key={item.key}
                  disabled={item.disabled}
                  onSelect={item.onSelect}
                  className={clsx(
                    'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition',
                    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
                    toneStyles[item.tone || 'default']
                  )}
                >
                  {item.icon}
                  {item.label}
                </DropdownMenu.Item>
              ))}
            </div>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

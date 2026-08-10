import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

interface SortableHeaderProps {
  label: string
  field: string
  currentSortField?: string
  currentSortOrder?: 'asc' | 'desc'
  onSort: (field: string) => void
  className?: string
  align?: 'left' | 'center' | 'right'
}

/**
 * Componente de encabezado de tabla ordenable
 * Al hacer clic, ordena por ese campo (alterna entre asc/desc)
 */
export const SortableHeader = ({
  label,
  field,
  currentSortField,
  currentSortOrder,
  onSort,
  className = '',
  align = 'left',
}: SortableHeaderProps) => {
  const isActive = currentSortField === field
  
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align]

  return (
    <th
      className={`px-4 py-3 ${alignClass} ${className} cursor-pointer select-none transition-colors hover:bg-gray-100 group`}
      onClick={() => onSort(field)}
    >
      <div className={`inline-flex items-center gap-1.5 ${alignClass === 'text-right' ? 'flex-row-reverse' : ''}`}>
        <span>{label}</span>
        <div className="w-4 h-4 flex items-center justify-center">
          {!isActive && (
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          {isActive && currentSortOrder === 'asc' && (
            <ArrowUp className="w-3.5 h-3.5 text-primary-600" />
          )}
          {isActive && currentSortOrder === 'desc' && (
            <ArrowDown className="w-3.5 h-3.5 text-primary-600" />
          )}
        </div>
      </div>
    </th>
  )
}

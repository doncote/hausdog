import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { STATUS_OPTIONS } from '../types'

interface InboxHeaderProps {
  assigneeFilter: string
  statusFilter: string[]
  onAssigneeChange: (value: string) => void
  onStatusToggle: (status: string) => void
  onClearFilters: () => void
}

const ASSIGNEE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
] as const

export function InboxHeader({
  assigneeFilter,
  statusFilter,
  onAssigneeChange,
  onStatusToggle,
  onClearFilters,
}: InboxHeaderProps) {
  const hasActiveFilters = assigneeFilter !== 'all' || statusFilter.length > 0

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Work</h1>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={assigneeFilter} onValueChange={onAssigneeChange}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            {ASSIGNEE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => {
            const active = statusFilter.includes(opt.value)
            return (
              <Badge
                key={opt.value}
                variant={active ? 'default' : 'outline'}
                className="cursor-pointer select-none"
                onClick={() => onStatusToggle(opt.value)}
              >
                {opt.label}
              </Badge>
            )
          })}
        </div>
      </div>
    </div>
  )
}

import { Briefcase } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkIssues } from '../queries'
import type { WorkFilters } from '../types'
import { EpicCard } from './EpicCard'
import { InboxHeader } from './InboxHeader'
import { IssueRow } from './IssueRow'

interface WorkInboxProps {
  filters: WorkFilters
  onFiltersChange: (filters: WorkFilters) => void
}

export function WorkInbox({ filters, onFiltersChange }: WorkInboxProps) {
  const { data, isPending, isError } = useWorkIssues({
    assignee: filters.assignee,
    status: (filters.status ?? []) as never,
    priority: filters.priority as never,
    team: filters.team,
    limit: filters.limit ?? 100,
  })

  const assigneeFilter = filters.assignee ?? 'all'
  const statusFilter = filters.status ?? []

  function handleAssigneeChange(value: string) {
    onFiltersChange({ ...filters, assignee: value === 'all' ? undefined : value })
  }

  function handleStatusToggle(status: string) {
    const current = statusFilter
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]
    onFiltersChange({ ...filters, status: next.length > 0 ? next : undefined })
  }

  function handleClearFilters() {
    onFiltersChange({})
  }

  const issues = data?.issues ?? []
  const epics = issues.filter((i) => i.issue_type === 'epic')
  const nonEpics = issues.filter((i) => i.issue_type !== 'epic')

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <InboxHeader
        assigneeFilter={assigneeFilter}
        statusFilter={statusFilter}
        onAssigneeChange={handleAssigneeChange}
        onStatusToggle={handleStatusToggle}
        onClearFilters={handleClearFilters}
      />

      {isPending && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">
            Failed to load issues. Make sure LATTICE_API_URL and LATTICE_API_KEY are configured.
          </p>
        </div>
      )}

      {!isPending && !isError && issues.length === 0 && (
        <EmptyState />
      )}

      {!isPending && !isError && issues.length > 0 && (
        <div className="space-y-4">
          {epics.length > 0 && (
            <section>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Epics
              </p>
              <div className="space-y-2">
                {epics.map((epic) => (
                  <EpicCard key={epic.id} epic={epic} />
                ))}
              </div>
            </section>
          )}

          {nonEpics.length > 0 && (
            <section>
              {epics.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Issues
                </p>
              )}
              <div className="space-y-0.5 border rounded-lg overflow-hidden">
                {nonEpics.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} />
                ))}
              </div>
            </section>
          )}

          <p className="text-xs text-muted-foreground text-right pt-2">
            {data?.count ?? issues.length} issues
          </p>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Briefcase className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-lg font-medium mb-1">No issues found</p>
      <p className="text-sm text-muted-foreground">
        Try adjusting your filters or check back later.
      </p>
    </div>
  )
}

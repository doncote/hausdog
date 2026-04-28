import { createFileRoute } from '@tanstack/react-router'
import { WorkInbox } from '@/features/work-inbox'
import type { WorkFilters } from '@/features/work-inbox'

export const Route = createFileRoute('/_authenticated/work')({
  validateSearch: (search: Record<string, unknown>): WorkFilters => ({
    assignee: (search.assignee as string) || undefined,
    status: Array.isArray(search.status)
      ? (search.status as string[])
      : search.status
        ? [search.status as string]
        : undefined,
    priority: search.priority !== undefined ? Number(search.priority) : undefined,
    team: (search.team as string) || undefined,
  }),
  component: WorkPage,
})

function WorkPage() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()

  const filters: WorkFilters = {
    assignee: search.assignee,
    status: search.status,
    priority: search.priority,
    team: search.team,
  }

  function handleFiltersChange(next: WorkFilters) {
    navigate({
      search: {
        assignee: next.assignee,
        status: next.status && next.status.length > 0 ? next.status : undefined,
        priority: next.priority,
        team: next.team,
      },
      replace: true,
    })
  }

  return <WorkInbox filters={filters} onFiltersChange={handleFiltersChange} />
}

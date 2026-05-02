import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { fetchEpicChildren } from '../api'
import type { LatticeIssue } from '../types'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../types'
import { IssueRow } from './IssueRow'

interface EpicCardProps {
  epic: LatticeIssue
}

export function EpicCard({ epic }: EpicCardProps) {
  const [expanded, setExpanded] = useState(false)

  const { data: children, isFetching } = useQuery({
    queryKey: ['epic-children', epic.id],
    queryFn: () => fetchEpicChildren({ data: { epicId: epic.id } }),
    enabled: expanded,
    staleTime: 60_000,
  })

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-3 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}

        <span className="text-xs text-muted-foreground flex-shrink-0" aria-hidden>
          ⬟
        </span>

        <span className="flex-1 text-sm font-semibold truncate min-w-0">{epic.title}</span>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge
            variant="secondary"
            className={`text-xs px-1.5 py-0 ${PRIORITY_COLORS[epic.priority] ?? ''}`}
          >
            {PRIORITY_LABELS[epic.priority] ?? `P${epic.priority}`}
          </Badge>
          <Badge variant="outline" className="text-xs px-1.5 py-0 capitalize">
            epic
          </Badge>
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-muted/20 px-1 py-1">
          {isFetching ? (
            <div className="space-y-1 p-2">
              <div className="h-7 bg-muted animate-pulse rounded" />
              <div className="h-7 bg-muted animate-pulse rounded" />
            </div>
          ) : !children || children.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-2">No child issues</p>
          ) : (
            <>
              <div className="space-y-0.5">
                {children.map((child) => (
                  <IssueRow key={child.id} issue={child} nested />
                ))}
              </div>
              <div className="px-4 pt-2 pb-1">
                <ProgressBar issues={children} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ProgressBar({ issues }: { issues: LatticeIssue[] }) {
  const closed = issues.filter((i) => i.status === 'closed').length
  const total = issues.length
  if (total === 0) return null
  const pct = Math.round((closed / total) * 100)

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {closed} / {total} closed
      </span>
    </div>
  )
}

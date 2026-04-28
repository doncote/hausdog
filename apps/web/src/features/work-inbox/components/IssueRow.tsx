import { Badge } from '@/components/ui/badge'
import type { LatticeIssue } from '../types'
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS } from '../types'

interface IssueRowProps {
  issue: LatticeIssue
  nested?: boolean
}

const TYPE_ICONS: Record<string, string> = {
  task: '●',
  bug: '⬡',
  feature: '★',
  epic: '⬟',
  chore: '○',
}

export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function IssueRow({ issue, nested = false }: IssueRowProps) {
  return (
    <div
      className={`flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors cursor-default ${nested ? 'ml-6' : ''}`}
    >
      <span className="text-muted-foreground text-xs w-3 flex-shrink-0" aria-hidden>
        {TYPE_ICONS[issue.issue_type] ?? '●'}
      </span>

      <p className="flex-1 text-sm font-medium truncate min-w-0">{issue.title}</p>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge
          variant="secondary"
          className={`text-xs px-1.5 py-0 ${PRIORITY_COLORS[issue.priority] ?? ''}`}
        >
          {PRIORITY_LABELS[issue.priority] ?? `P${issue.priority}`}
        </Badge>

        <Badge
          variant="secondary"
          className={`text-xs px-1.5 py-0 capitalize ${STATUS_COLORS[issue.status] ?? ''}`}
        >
          {issue.status.replace('_', ' ')}
        </Badge>

        {issue.assignee && (
          <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[100px]">
            {issue.assignee}
          </span>
        )}

        <span className="text-xs text-muted-foreground hidden md:inline whitespace-nowrap">
          {relativeTime(issue.updated_at)}
        </span>
      </div>
    </div>
  )
}

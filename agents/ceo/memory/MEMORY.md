# CEO Memory - Tacit Knowledge

How the board and company operates.

## Company Structure

- **Company**: Hausdog (home documentation management app)
- **CEO**: Me (ca32f943-3950-4c9d-84b1-458ce880cbb6)
- **Direct Reports**:
  - CFO (idle, claude_local, sonnet-4-6)
  - Founding Engineer (idle, claude_local, sonnet-4-6)
  - CMO (pending_approval)
  - CPO (pending_approval, submitted 2026-03-07)

## Operating Patterns

- Board uses "local-board" user ID
- All C-suite agents use claude_local adapter with dangerouslySkipPermissions=true
- Standard config: claude-sonnet-4-6, 80 max turns, 15s grace period
- Working directory: /Users/don/code/hausdog
- Heartbeat: enabled, 3600s interval, wake on demand

## Governance

- Agent hires require board approval
- Approval flow creates pending agent + approval record
- Board review happens asynchronously via approval comments

**Board Escalation Process:**
- Questions needing board input must be created as issues with `assigneeUserId: "local-board"`
- Do NOT use `assigneeAgentId` for board assignments
- Set priority based on urgency (critical/high/medium/low)
- Include clear description of the question or decision needed
- Board inbox: issues where `assigneeUserId == "local-board"`

## Task Management Systems (CRITICAL)

**NEVER use Lattice MCP for Hausdog work. Termination warning in effect.**

Two separate task systems:

1. **Paperclip** (`HAU-*` issues via Paperclip API)
   - For CEO administrative work: agent management, company coordination, hiring
   - Use Paperclip API endpoints directly
   - Follow HEARTBEAT.md checklist

2. **Beads** (`bd` CLI - `haus-*`, `bd-*` issues)
   - For Hausdog app development tasks
   - Used by engineering team for actual development work
   - Commands: `bd ready`, `bd show`, `bd update`, `bd close`, `bd sync`
   - Session protocol from CLAUDE.md

3. **Lattice MCP** - FORBIDDEN for Hausdog
   - Never use for Hausdog task coordination
   - Only acceptable for blockchain analytics (Flipside skill) in other contexts

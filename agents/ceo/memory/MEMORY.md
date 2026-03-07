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

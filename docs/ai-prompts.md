# AI prompts

## Initial project foundation

### Prompt

The first Codex prompt requested repository inspection and only a minimal React/TypeScript, Express/TypeScript, PostgreSQL/Prisma foundation, with documentation and verification but no product features.

### What changed

Created the npm-workspaces foundation, minimal client/server, initial Prisma schema, environment template, and documentation.

### Scope confirmation

No learner or instructor business functionality was implemented.

## Database foundation review and migration preparation

### Prompt

The user requested this database-only continuation: review/finalize PostgreSQL/Prisma models; create and apply an initial migration if a real database was available; validate constraints; inspect npm audit; initialize Git if needed; update documentation; and do not implement APIs, UI, authentication, or business logic.

### What changed

Updated `prisma/schema.prisma` with password hashes, enrollment progress state/timestamps, activity details, alert dismissals, explicit restricted historical relations, indexes, and the required constraints. Initialized local Git and updated all required documentation.

### Migration and verification

No `DATABASE_URL` was available, so no migration was created or applied. Prisma format, validation, and client generation passed. `npm audit` reported no vulnerabilities.

### Scope confirmation

No application business functionality was implemented.

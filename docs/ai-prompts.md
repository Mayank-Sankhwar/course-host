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

## Authentication and authorization foundation

### Prompt

The user requested the CourseHost authentication-only phase: signup, login/logout, Argon2id-compatible hashing, HTTP-only cookie session, reusable authentication/role middleware, current-user endpoint, minimal authentication UI, focused tests, CORS configuration, documentation, and no Git history changes or course-related functionality.

### What changed

Added server authentication modules, Prisma-backed repository boundary, Argon2id password hashing, Express cookie sessions, `/api/auth/signup`, `/login`, `/logout`, and `/me`, reusable `requireAuth`/`requireRole` middleware, in-memory test support, focused API tests, and the minimal client auth form/API client.

### Verification and limitations

Type checking, six focused authentication tests, build, Prisma validation, and Prisma client generation were run. Tests intentionally use an in-memory repository because no PostgreSQL database/migration is available. Production authentication requires `DATABASE_URL`, a migrated database, a strong `SESSION_SECRET`, and replacement of the in-memory session store for multi-instance deployment. `npm audit` currently reports three high-severity transitive Prisma CLI findings; its automated remedy is a forced incompatible Prisma change, so it was not applied.

### Scope confirmation

No course, lesson, enrollment, comment, dashboard, alert, CSV, catalogue, or other business functionality was implemented.

## Authentication/authorization self-review

### Prompt

The user requested a security review of the authentication and authorization foundation, focused on password handling, normalized email, signup-role escalation, session/CORS/environment configuration, middleware, frontend credential handling, focused test coverage, dependency use, documentation accuracy, and no Git history changes.

### What changed

The review found and fixed two configuration defects: production now refuses to start if `CLIENT_ORIGIN` is absent, and the session-secret example is empty so copying it cannot start the server with a known placeholder. The `/me` test assertion now explicitly checks the reloaded server-side user fields.

### Verification and scope

Focused auth tests, type checking, build, Prisma validation, and client generation were re-run. PostgreSQL-backed runtime testing remains blocked by the missing database and migration. No business features or Git history operations were performed.

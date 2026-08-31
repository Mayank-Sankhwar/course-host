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

## Instructor course CRUD and ownership

### Prompt

The user requested only instructor course create/read/update/list behavior with server-side ownership authorization, validation, draft-only creation, server pagination/filtering/sorting, focused tests, minimal management UI, documentation, and no Git history changes or future course features.

### What changed

Added a Prisma course repository, instructor-only course router, ownership and input validation, in-memory course repository/tests, and a minimal instructor course manager. The API exposes `POST /api/courses`, `GET /api/courses`, `GET /api/courses/:courseId`, and `PATCH /api/courses/:courseId`.

### Verification and limitations

Eleven focused authentication/course tests, type checking, build, Prisma validation, and client generation were run. Course tests use in-memory repositories; production database-backed course runtime remains blocked by the pending migration/database. No schema change or dependency was needed. Enrollment-count sorting, lessons, publishing, archiving, and learner catalogue behavior remain intentionally deferred.

## Course CRUD verification pass

### Prompt

The user requested a complete automated review of Course CRUD: inspect all related implementation, extend missing API-level coverage for ownership, hostile fields, status preservation, search, filters, sorting, pagination, errors, and frontend scope; then run all tests, typecheck, build, and Prisma checks without Git history changes.

### What changed

Expanded the existing course API test suite to cover unauthenticated/learner read and update access, malicious `id` updates, empty/malformed updates, archived-course metadata preservation, case-insensitive title/description search, combined filters, all instructor-visible statuses, and invalid page/limit/direction bounds.

### Verification status

The expanded verification command was blocked before execution by the Codex environment’s usage-limit approval rejection, not by project output. Earlier in the course phase, the 11-test suite, typecheck, build, Prisma validation, and Prisma client generation had passed. PostgreSQL-backed integration testing remains unavailable because no database/migration has been configured.

## Instructor lesson management

### Prompt

The user requested only instructor lesson create/read/update/delete/reorder functionality, server-side course ownership, stable lesson IDs, append-only creation, contiguous positions, final-lesson protection, complete-set reorder validation, transactional ordering, real PostgreSQL integration tests including LessonProgress cascade behavior, minimal UI, documentation, and no Git history changes or future product features.

### What changed

Added lesson validation, transactional Prisma repository, nested course lesson routes, a real PostgreSQL API integration suite with scoped cleanup, and a minimal instructor lesson manager. It uses complete lesson ID arrays for reorder and preserves IDs/progress references while changing positions.

### Verification and limitations

All 17 tests passed, including six real-PostgreSQL lesson integration tests. Typecheck, build, Prisma validation, migration status, and diff check passed. Prisma client generation was attempted but blocked by a Windows `EPERM` lock on the generated engine file while local Node processes were active. No schema migration was required.

## Development instructor seed

### Prompt

The user requested a controlled Prisma seed for two deterministic local-development instructor accounts. It had to reuse the existing Argon2id helper, stay learner-only at public signup, upsert without deleting or resetting existing data, run explicitly rather than at server startup, and be verified twice against the real PostgreSQL database through Prisma queries and the actual login API.

### What changed

Added `prisma/seed.ts` and Prisma seed configuration. The seed uses the shared password helper and Prisma `upsert` by unique email, forces the two approved accounts to `INSTRUCTOR`, and refuses to run with `NODE_ENV=production`. README documents local-only seed usage and credentials. The tracked environment example was corrected to remove a secret-like value.

### Verification

Local PostgreSQL migration status was up to date. The seed was run twice successfully; a real Prisma query confirmed two matching instructor records, and both accounts successfully completed login plus `/api/auth/me`. Typecheck, tests, build, and Prisma validation passed. Prisma client generation was attempted twice but blocked by a Windows `EPERM` lock on the generated engine file while local Node server/studio processes were running.

## Course lifecycle: publish, archive, and restore

### Prompt

The user requested the controlled CourseHost lifecycle phase: implement only `DRAFT → PUBLISHED → ARCHIVED → PUBLISHED`, use explicit instructor-owned publish/archive/restore endpoints, require at least one lesson before publishing, preserve learning records when archiving/restoring, add real PostgreSQL integration coverage and minimal instructor controls, update documentation, and do not implement learner catalogue, enrollment/progress APIs, comments, alerts, dashboard, CSV, notifications, or Git history operations.

### What changed

Added a serializable Prisma lifecycle service and `POST /api/courses/:courseId/publish`, `/archive`, and `/restore`. Each command derives the instructor from the authenticated session, checks ownership and the expected source status, and uses a conditional database update. Publishing counts lessons in the transaction. The course manager now offers the status-appropriate action and reloads server state after success.

### Scope confirmation

This was the lifecycle foundation step. No learner/instructor business functionality beyond the requested course lifecycle was implemented: there are still no enrollment/progress, learner catalogue, comments, activity behavior, alerts, CSV, dashboard, or notification flows.

### Verification

`npm run typecheck`, `npm test`, and `npm run build` passed. The complete server suite has 21 passing tests, including four isolated real-PostgreSQL lifecycle integration tests. Prisma validation, migration status, and client generation passed; the configured database schema is up to date. No schema migration, dependency change, or Git history operation was performed.

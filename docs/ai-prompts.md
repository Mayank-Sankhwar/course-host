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

## Enrollment + learner progress

### Prompt

The user requested only learner self-enrollment into published courses, own-enrollment lookup, learner lesson access, timestamp-derived lesson progress, derived current-course progress, PostgreSQL integration tests, a minimal learner UI, documentation, and an explicit security review. The prompt prohibited catalogue search/filter/sort/pagination, comments, CSV, instructor manual enrollment, activity behavior, alerts, dashboard, notifications, deployment, schema redesign, and Git history operations.

### What changed

Added learner-only enrollment, enrolled-course, minimal published-course list, lesson access, progress retrieval, start, and complete routes. The service derives the learner from the signed-in session, checks course status and enrollment ownership, validates lesson/course membership, uses serializable transactions/retries for repeated writes, and computes course progress from current lesson IDs and timestamp facts. Added a minimal learner course/progress interface and isolated PostgreSQL API integration coverage.

### Scope confirmation

No full learner catalogue behavior, comments, CSV enrollment, instructor manual enrollment, activity-log behavior, alerts, dashboard, notifications, deployment, or schema migration was implemented.

### Verification

`npm test` passed with 25 tests across five files. This includes four isolated real-PostgreSQL learner integration tests covering enrollment eligibility/duplicates, session-scoped enrolled courses, lesson-access ordering and archive blocking, no-regression timestamps, IDOR attempts, concurrent repeated completion, progress recalculation after reorder/delete/add, and archive/restore preservation. `npm run typecheck`, `npm run build`, `npm exec prisma validate`, `npm exec prisma generate`, `npm exec prisma migrate status`, and `git diff --check` passed. No dependency or schema change was needed, and no Git history operation was performed.

## Full course catalogue

### Prompt

The user requested the full CourseHost catalogue phase: evolve the existing learner `GET /api/available-courses` route, preserve instructor listing, enforce learner published-only visibility and instructor ownership, support server-side search/category/status/instructor filters, title/creation/enrollment-count sorting, pagination/totals, a minimal learner catalogue UI, real PostgreSQL tests, documentation, and no Git history operations.

### What changed

Extended `/api/available-courses` into the sole learner catalogue route with validated `search`, `category`, `instructorId`, `sort`/`sortBy`, `direction`/`sortOrder`, `page`, and `limit` query support. The existing instructor list now supports enrollment-count sorting and returns safe instructor/count data. Prisma/PostgreSQL executes the visibility predicates, case-insensitive text search, relation-count ordering, count query, and page query. The learner UI now requests only each selected catalogue page and provides controls for its filters, sorting, and pagination.

### Scope confirmation

No comments, instructor individual enrollment, CSV enrollment, activity-log behavior, inactivity alerts, dashboard analytics, notifications, deployment, final submission work, schema migration, or dependency change was implemented.

### Verification

`npm test` passed with 29 tests across six files, including four isolated real-PostgreSQL catalogue integration tests. They cover learner and instructor visibility, query-parameter IDOR attempts, draft/archive exclusion, title/description search, category/instructor filters, title/creation-date/relation-derived enrollment-count sorting, deterministic ties, total/page boundaries, invalid query values, and a combined filtered query. `npm run typecheck`, `npm run build`, `npm exec prisma validate`, `npm exec prisma generate`, `npm exec prisma migrate status`, and `git diff --check` passed. No dependency or schema change, migration, or Git history operation was performed.

## Learner course experience + course-level comments

### Prompt

The user requested only the learner enrolled-course experience (server-backed lesson material, progress, start/complete, and current course progress) plus course-level comments. The prompt required participant authorization, a server-enforced 50-word limit, chronological comments, archive/restore preservation, minimal instructor discussion UI, real PostgreSQL integration tests, documentation, and no Git history operations.

### What changed

The existing learner lesson response now includes stored lesson content for the selected-course experience. Added `GET` and `POST /api/courses/:courseId/comments`, a role-aware course-comment service, server body validation, a shared minimal discussion component, learner lesson-content display, and instructor per-course discussion access. Comments are course-level, scoped by the session user’s enrollment or ownership, ordered oldest-first with ID ties, and preserved across archive/restore while new comments are rejected during archive.

### Scope confirmation

No instructor individual enrollment, bulk CSV enrollment, activity-log behavior, inactivity alerts, dashboard analytics, notifications, deployment, final submission work, schema migration, or dependency change was implemented.

### Verification

`npm test` passed with 32 tests across seven files. The three new isolated real-PostgreSQL comment tests cover authenticated participant reads/writes, learner/instructor IDOR denial, session-derived authorship and unexpected author fields, whitespace word counting, exact 50/51-word boundaries, concurrent creates, deterministic chronology including timestamp ties, and archive/restore preservation. Existing learner PostgreSQL tests continue to cover server-ordered material/progress, arbitrary completion, progress recalculation, and archive access. `npm run typecheck`, `npm run build`, `npm exec prisma validate`, `npm exec prisma generate`, `npm exec prisma migrate status`, and `git diff --check` passed. No dependency or schema change, migration, or Git history operation was performed.

## Instructor individual enrollment + bulk CSV enrollment

### Prompt

The user requested only owner-scoped instructor enrollment of existing learners, bounded multipart CSV enrollment with per-email partial-success reporting, a safe instructor learner list, minimal instructor UI, real PostgreSQL tests, and documentation. The prompt prohibited activity logging, alerts, dashboard, notifications, deployment, final submission work, new progress/comment functionality, schema redesign, and Git history operations.

### What changed

Added instructor-only `POST /api/courses/:courseId/enrollments`, `POST /api/courses/:courseId/enrollments/bulk`, and `GET /api/courses/:courseId/enrollments`. The server derives instructor identity from the session, requires course ownership and `PUBLISHED` status for new enrollment, reuses auth email normalization, restricts targets to existing learners, and relies on the existing enrollment unique constraint for races. CSV input is bounded to 256 KiB and 1,000 rows, accepts an optional `email` header, handles quoted/CRLF/LF input, processes rows independently, and returns a deterministic result for every row. Added minimal individual/CSV forms, result table, and enrolled-learner list to the instructor course view.

### Scope confirmation

No activity logging, inactivity classification/alerts, notifications, dashboard analytics, deployment, final submission work, schema migration, or dependency change was implemented.

### Verification

`npm run typecheck` passed after implementation. An initial real-PostgreSQL enrollment test run identified and fixed a test-fixture issue (string attachment interpreted as a path) and a multipart-size-boundary behavior. The final privileged test rerun was blocked by the Codex environment execution usage limit before it could start, so no full-suite success claim is made for this phase. The non-privileged `npm run build` attempt was likewise blocked by sandbox `spawn EPERM` when Vite attempted to start esbuild. The test suite file contains isolated PostgreSQL coverage for individual/bulk authorization, normalization, partial success, duplicate races, size/row limits, and the owner learner list. Earlier project verification remains recorded above.

## Activity log, learner progress activity, and instructor alerts

### Prompt

The user requested activity history, learner activity tracking, 14-day inactivity, instructor alerts, PostgreSQL tests, documentation, and no Git history operations.

### What changed

Added `CourseActivity` plus a migration; actual lesson progress transitions atomically upsert its per-learner/course timestamp. Added owner-only activity, alert count/list/dismissal, and log endpoints, a minimal instructor activity view, and immutable logs for required course/lesson mutations and comments. Added PostgreSQL integration coverage.

### README conflict and resolution

The continuation brief described lesson visits, pings, and optional notifications. README instead defines `IN_PROGRESS` learners with no further **progress** for more than fourteen days and does not require ping/notifications. The implementation follows README: strict-more-than-14-day progress inactivity, no inferred timestamp for never-progressed enrollment, and no notification infrastructure.

### Verification

The migration was applied to local PostgreSQL; Prisma client generation and type checking passed. The first full test run executed all 40 tests successfully but cleanup exposed a missing comment deletion before course cleanup. That cleanup was fixed; the final privileged rerun was then blocked before starting by the Codex environment account usage limit, so it is not claimed as passed. No Git history operation was performed.

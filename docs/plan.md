# Plan

## Delivery plan (about 12 hours)

| Phase | Scope | Verification | Estimate | Status |
|---|---|---|---:|---|
| 1. Foundation | Workspace, minimal client/server, environment template, initial documentation. | Install, type-check, build, health check. | 1.5 h | Complete |
| 2. Database design | Final Prisma schema, database constraints, Git initialization, documentation. | Prisma format/validate/generate; migration when a database is available. | 1 h | Complete; local PostgreSQL migration is applied |
| 3. Identity | Credentials, sessions, server identity, role checks. | Authentication and protected-route tests. | 1.5 h | Complete (in-memory verification; production database migration still pending) |
| 4. Course CRUD and ownership | Instructor-scoped create/read/update/list, validation, pagination, and minimal management UI. | Ownership, status-preservation, filtering, pagination tests. | 1.5 h | Implementation complete; expanded verification rerun blocked by environment usage limit |
| 5. Lesson management | Instructor-owned lesson create/read/update/delete/reorder, real PostgreSQL integration coverage, and minimal UI. | Ownership, stable IDs, progress cascade, ordering, and last-lesson tests. | 1.5 h | Implementation/tests complete; Prisma generation blocked by local Windows file lock |
| 6. Course lifecycle | Publish/archive/restore transitions and publish-with-lesson validation. | Lifecycle and ownership tests. | 0.5 h | Pending |
| 7. Enrollment/progress | Enrollment, timestamps, derived course progress. | Constraints and progress-transition tests. | 2 h | Pending |
| 8. Catalogue/discussion/history | Learner catalogue, comments, immutable history. | Pagination/access tests. | 1.5 h | Pending |
| 9. Reporting and finish | CSV, dashboard, alerts, integration, deployment. | End-to-end smoke tests. | 1 h | Pending |

Database constraints precede behavior so later services have reliable persistence invariants. Stretch goals remain out of scope.

Development setup now includes an explicitly invoked, idempotent Prisma seed for two local instructor accounts. It was verified twice against the local PostgreSQL database without deleting existing data.

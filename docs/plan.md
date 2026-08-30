# Plan

## Delivery plan (about 12 hours)

| Phase | Scope | Verification | Estimate | Status |
|---|---|---|---:|---|
| 1. Foundation | Workspace, minimal client/server, environment template, initial documentation. | Install, type-check, build, health check. | 1.5 h | Complete |
| 2. Database design | Final Prisma schema, database constraints, Git initialization, documentation. | Prisma format/validate/generate; migration when a database is available. | 1 h | Schema complete; migration pending database |
| 3. Identity | Credentials, sessions, server identity, role checks. | Authentication and protected-route tests. | 1.5 h | Complete (in-memory verification; production database migration still pending) |
| 4. Instructor authoring | Course lifecycle, ownership, lessons, safe ordering. | Transition/ownership/last-lesson tests. | 2 h | Pending |
| 5. Enrollment/progress | Enrollment, timestamps, derived course progress. | Constraints and progress-transition tests. | 2 h | Pending |
| 6. Catalogue/discussion/history | Server queries, comments, immutable history. | Pagination/access tests. | 1.5 h | Pending |
| 7. Reporting and finish | CSV, dashboard, alerts, integration, deployment. | End-to-end smoke tests. | 2.5 h | Pending |

Database constraints precede behavior so later services have reliable persistence invariants. Stretch goals remain out of scope.

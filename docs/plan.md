# Plan

## Delivery plan (about 12 hours)

| Phase | Scope | Verification | Estimate | Status |
|---|---|---|---:|---|
| 1. Foundation | Workspace, minimal client/server, environment template, initial documentation. | Install, type-check, build, health check. | 1.5 h | Complete |
| 2. Database design | Final Prisma schema, database constraints, Git initialization, documentation. | Prisma format/validate/generate; migration when a database is available. | 1 h | Complete; local PostgreSQL migration is applied |
| 3. Identity | Credentials, sessions, server identity, role checks. | Authentication and protected-route tests. | 1.5 h | Complete; production still requires persistent session storage and deployment configuration |
| 4. Course CRUD and ownership | Instructor-scoped create/read/update/list, validation, pagination, and minimal management UI. | Ownership, status-preservation, filtering, pagination tests. | 1.5 h | Complete; the expanded verification was later covered by the full passing suite |
| 5. Lesson management | Instructor-owned lesson create/read/update/delete/reorder, real PostgreSQL integration coverage, and minimal UI. | Ownership, stable IDs, progress cascade, ordering, and last-lesson tests. | 1.5 h | Complete; the historical Windows file-lock blocker was resolved |
| 6. Course lifecycle | Explicit publish/archive/restore commands, empty-course publish guard, and minimal instructor controls. | Real PostgreSQL lifecycle, preservation, ownership, invalid-state, and concurrent-transition tests. | 0.5 h | Complete |
| 7. Enrollment/progress | Learner self-enrollment, own enrolled courses, lesson start/complete commands, and derived progress with minimal learner UI. | Real PostgreSQL enrollment, access, timestamp, recalculation, integrity, and IDOR tests. | 2 h | Complete |
| 8. Full course catalogue | Learner published-course catalogue and instructor own-course list with server-side filters, sorting, relation counts, and pagination. | Real PostgreSQL catalogue visibility, IDOR, filtering, sorting, total, and pagination tests. | 1.5 h | Complete |
| 9. Learner course experience and comments | Server-backed course material/progress experience and course-level comments for participants. | Real PostgreSQL lesson/progress and comment authorization, validation, ordering, archive/restore tests. | 1 h | Complete |
| 10. Instructor enrollment and CSV | Owner-scoped individual learner add, bounded CSV partial success, and learner list. | Real PostgreSQL ownership, roles, duplicates/races, CSV parsing, and safe-list tests. | 1 h | Complete; the UI also accepts normalized pasted learner emails through the same bulk flow |
| 11. Activity history and alerts | Immutable required course/comment history, progress activity, and 14-day instructor alerts/dismissal. | Real PostgreSQL activity, threshold, ownership, archive, dismissal/re-alert, and log tests. | 1 h | Complete |
| 12. Dashboard and UI integration | Role-specific shell, dashboard metrics, coherent course/learner workflow, navigation, and responsive baseline. | Typecheck, build, full regression, and browser/Postman checklist. | 1 h | Complete; full regression and production build pass locally |
| 13. Progress export | Instructor-owned complete enrolled-learner progress CSV export using current lesson progress semantics. | PostgreSQL authorization, headers, escaping, all-state, recalculation, and read-only tests. | 0.5 h | Complete |
| 14. Final delivery | Final security review, deployment preparation, and submission. | End-to-end smoke tests and submission review. | 1 h | Pending |

Database constraints precede behavior so later services have reliable persistence invariants. Stretch goals remain out of scope.

Development setup now includes an explicitly invoked, idempotent Prisma seed for two local instructor accounts. It was verified twice against the local PostgreSQL database without deleting existing data.

The implementation phases are complete. Final delivery remains for deployment preparation, any
production hosting work, and submission review; deployment has not been claimed as verified here.

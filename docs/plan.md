# Plan

## Delivery plan (estimated ~12 hours)

| Phase | Scope | Verification | Estimate | Status |
|---|---|---|---:|---|
| 1. Foundation | Workspace, minimal client/server, environment template, initial documentation. | Install, type-check, build, health check. | 1.5 h | Complete |
| 2. Database design | Final Prisma schema, database constraints, Git initialization, documentation. | Prisma format/validate/generate; migration when a database is available. | 1 h | Complete; local PostgreSQL migration is applied |
| 3. Identity | Credentials, sessions, server identity, role checks. | Authentication and protected-route tests. | 1.5 h | Complete; deployed authentication uses HTTP-only session cookies. Persistent session storage remains a production-scaling improvement |
| 4. Course CRUD and ownership | Instructor-scoped create/read/update/list, validation, pagination, and minimal management UI. | Ownership, status-preservation, filtering, pagination tests. | 1.5 h | Complete; covered by the full integration test suite |
| 5. Lesson management | Instructor-owned lesson create/read/update/delete/reorder, real PostgreSQL integration coverage, and minimal UI. | Ownership, stable IDs, progress cascade, ordering, and last-lesson tests. | 1.5 h | Complete; the historical Windows file-lock issue was resolved |
| 6. Course lifecycle | Explicit publish/archive/restore commands, empty-course publish guard, and minimal instructor controls. | Real PostgreSQL lifecycle, preservation, ownership, invalid-state, and concurrent-transition tests. | 0.5 h | Complete |
| 7. Enrollment/progress | Learner self-enrollment, own enrolled courses, lesson start/complete commands, and derived progress with minimal learner UI. | Real PostgreSQL enrollment, access, timestamp, recalculation, integrity, and IDOR tests. | 2 h | Complete |
| 8. Full course catalogue | Learner published-course catalogue and instructor own-course list with server-side filters, sorting, relation counts, and pagination. | Real PostgreSQL catalogue visibility, IDOR, filtering, sorting, total, and pagination tests. | 1.5 h | Complete |
| 9. Learner course experience and comments | Server-backed course material/progress experience and course-level comments for participants. | Real PostgreSQL lesson/progress and comment authorization, validation, ordering, archive/restore tests. | 1 h | Complete |
| 10. Instructor enrollment and CSV | Owner-scoped individual learner add, bounded CSV partial success, and learner list. | Real PostgreSQL ownership, roles, duplicates/races, CSV parsing, and safe-list tests. | 1 h | Complete; the UI also accepts normalized pasted learner emails through the same bulk flow |
| 11. Activity history and alerts | Immutable required course/comment history, progress activity, and 14-day instructor alerts/dismissal. | Real PostgreSQL activity, threshold, ownership, archive, dismissal/re-alert, and log tests. | 1 h | Complete |
| 12. Dashboard and UI integration | Role-specific shell, dashboard metrics, coherent course/learner workflow, navigation, and responsive baseline. | Typecheck, build, full regression, and browser/Postman checklist. | 1 h | Complete; full regression and production build pass locally |
| 13. Progress export | Instructor-owned complete enrolled-learner progress CSV export using current lesson progress semantics. | PostgreSQL authorization, headers, escaping, all-state, recalculation, and read-only tests. | 0.5 h | Complete |
| 14. Final delivery | Final security review, deployment preparation, and submission. | End-to-end smoke tests and submission review. | 1 h | Complete |

## Build order and session structure

I grouped the work into dependency-driven implementation sessions rather than treating the project
as a day-by-day diary:

1. **Foundation and database:** I established the workspace, Prisma schema, migrations, and database
   constraints first so later services had reliable persistence invariants.
2. **Identity and authorization:** I built credential handling, sessions, server identity, and role
   checks before any ownership-sensitive workflow.
3. **Instructor course and lesson workflows:** I implemented course ownership and CRUD, then stable
   lesson creation, editing, deletion, and ordering. Progress depends on this course/lesson structure.
4. **Course lifecycle:** I added explicit publish, archive, and restore commands, including the
   lesson requirement before publishing.
5. **Learner enrollment and progress:** I added self-enrollment and lesson start/complete behavior,
   then derived course progress from the underlying lesson facts.
6. **Catalogue and learner experience:** I added server-side catalogue querying, followed by the
   enrolled-course, lesson-content, and discussion experience.
7. **Instructor enrollment and bulk CSV:** I added owner-scoped individual enrollment, bounded
   row-by-row bulk enrollment, and the instructor learner list.
8. **Activity, alerts, dashboard, and export:** I built these after the underlying progress,
   enrollment, and history data existed, so their reporting semantics could reuse authoritative data.
9. **Final UI integration, verification, deployment, and submission:** I completed role-specific
   navigation and UI integration, expanded regression coverage, verified builds, deployed the
   application, and finalized the submission documentation.

This order kept database integrity and server identity ahead of business workflows, put enrollment
before the learner experience, and delayed activity, alerts, dashboard metrics, and export until the
data they report on was available.

## Estimated vs actual effort

The original implementation plan was approximately 12 hours. The actual effort was approximately
15–18 hours. The additional time went into deeper PostgreSQL integration testing, authorization and
IDOR coverage, concurrency and integrity edge cases, lesson ordering and lifecycle correctness, CSV
partial-success behavior, activity/alert semantics, cross-origin session behavior, deployment
debugging, and the final documentation and submission review. The difference reflects verification
and production hardening beyond the initial implementation estimate rather than a change to the
required scope.

## Scope cuts

I prioritized completeness and correctness of the required workflows over optional learning-platform
features. Quizzes, certificates, prerequisite courses, video tracking, ratings and reviews,
learning paths, downloadable resources, and email digests remained out of scope. They were not
required for the take-home and would introduce additional domain models and business rules; some
would also require additional infrastructure or external integrations. Keeping them out of scope
left time for authorization, data integrity, testing, deployment, and the required instructor and
learner workflows.

## Final status

All 14 implementation phases are complete, including final delivery. The application is deployed
with the frontend and backend running as separate Render services, and the deterministic demo seed
is available through the explicit Prisma seed command. Local PostgreSQL-backed integration tests,
typechecks, production builds, and documentation review were completed as recorded in the project
documentation. The current backend uses the process-local `express-session` MemoryStore; persistent
shared session storage remains a future scaling improvement, not an unfinished deployment step. The
repository is ready for submission.

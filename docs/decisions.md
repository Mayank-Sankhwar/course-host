# Decisions

## 1. Course lifecycle is explicit and preserves history

- **Chose:** I modeled courses with the `DRAFT`, `PUBLISHED`, and `ARCHIVED` `CourseStatus` enum and exposed explicit instructor-only `publish`, `archive`, and `restore` commands. New courses are always created as drafts, and publishing requires an existing lesson.
- **Rejected:** Hard deletion, free-form status text, arbitrary status changes through `PATCH`, or letting the client choose the initial status.
- **Why:** Archiving must preserve lessons, enrollments, progress, comments, and activity history. Explicit commands make the small lifecycle graph and its ownership/status checks visible and enforceable in serializable transactions.

## 2. Lesson identity is permanent and ordering is transactional

- **Chose:** I kept a permanent `Lesson.id`, treated `position` as mutable per-course display order, appended new lessons, and made reorder accept the complete lesson ID set. Delete and reorder use transactions and temporary non-conflicting positions before assigning contiguous final positions.
- **Rejected:** Using array indexes as identity, recreating lessons during reorder, accepting client-selected creation positions, partial reorder payloads, or independent position updates.
- **Why:** Progress must survive content edits and reordering. The unique `(courseId, position)` constraint must remain valid even during a failed or concurrent reorder. Server-side final-lesson protection also keeps a course structurally usable.

## 3. Lesson progress is represented by timestamp facts

- **Chose:** I used `startedAt` and `completedAt` on `LessonProgress` instead of a redundant lesson-status column. A missing row is `NOT_STARTED`, a started-only row is `IN_PROGRESS`, and a completed timestamp is `COMPLETED`; timestamps are written by the server.
- **Rejected:** Client-provided state or timestamps, a second mutable status field, and silent timestamp/state manipulation through request bodies.
- **Why:** The facts have one source of truth and cannot contradict a separate status value. The `(enrollmentId, lessonId)` record remains stable when lesson order changes.
- **Later reversed:** I initially allowed a learner to move directly from `NOT_STARTED` to `COMPLETED`. Implementation and testing showed that this allowed an invalid progression, particularly for one-lesson courses. I changed the service and route behavior to reject `NOT_STARTED → COMPLETED`, added a regression test for the one-lesson case, and updated the learner UI to follow `Start → Complete → Completed`.

## 4. Course progress is derived from current lessons

- **Chose:** I calculate completed count, total count, percentage, and enrollment course state from the current lesson IDs and their `LessonProgress` facts, while retaining queryable enrollment state on `Enrollment` for server updates and dashboard queries.
- **Rejected:** Persisted percentages or counts, array-index matching, and pre-creating progress rows for every not-started lesson.
- **Why:** Adding or deleting lessons must immediately affect progress without a migration or mass update. This also keeps reordering independent from progress identity and preserves completed lessons when reopened.

## 5. Uniqueness and referential integrity belong in the database

- **Chose:** I used database foreign keys, enum values, unique email, unique `(learnerId, courseId)` enrollment, unique `(enrollmentId, lessonId)` progress, and unique `(courseId, position)` lesson constraints, with deliberate cascade/restrict behavior.
- **Rejected:** Client-only duplicate checks, pre-query-only concurrency protection, or a denormalized progress/count model that could drift from the relational records.
- **Why:** PostgreSQL remains the final integrity boundary under concurrent requests. Cascading a deleted lesson or enrollment removes only its lesson-progress facts, while course history and learning records remain protected.

## 6. Authorization is relationship-based and server-derived

- **Chose:** I derive identity and role from the authenticated server session, then authorize through instructor/course, learner/enrollment, lesson/course, and progress/enrollment relationships. List queries apply ownership or visibility predicates before user filters.
- **Rejected:** Trusting IDs, roles, ownership, or learner identity from the frontend, local storage, or request bodies/query parameters.
- **Why:** Knowing a course or lesson ID must not grant cross-instructor or cross-learner access. The same boundary protects course management, catalogue visibility, enrollment, lessons, progress, comments, activity, alerts, and exports.

## 7. Authentication uses Argon2id and HTTP-only cookie sessions

- **Chose:** I hash passwords with Argon2id and use signed `express-session` cookies containing only server-established session identity. Protected requests reload the user from the repository, and credentialed CORS is limited to the configured `CLIENT_ORIGIN`.
- **Rejected:** Plaintext/reversible passwords, JWT or localStorage identity, wildcard credentialed CORS, and client-held roles.
- **Why:** Browser JavaScript cannot read the HTTP-only cookie, and current server-side role data remains authoritative. Secure production cookies, a required session secret, and explicit origins establish a deliberate browser trust boundary.

## 8. Public signup creates learners only

- **Chose:** I allow public signup only for `LEARNER` accounts and provision instructor accounts through the explicitly invoked development seed.
- **Rejected:** Unrestricted public instructor registration or creating privileged users at server startup.
- **Why:** A client-selected instructor role would be privilege escalation. The idempotent development seed provides repeatable demo/API instructors without weakening the public signup boundary.

## 9. Catalogue querying stays server-side and bounded

- **Chose:** I extended the existing catalogue/list routes with database-side search, category/status/instructor filters, title/creation/enrollment-count sorting, deterministic ID tie-breaking, pagination, and total counts. Learners are restricted to published courses; instructor lists are restricted to the authenticated instructor's courses.
- **Rejected:** A competing catalogue route, downloading all courses, React-side filtering/sorting/pagination, arbitrary `orderBy` values, or treating filter parameters as authorization.
- **Why:** The browser receives only the requested page, while PostgreSQL applies visibility before filters and calculates authoritative totals. Relation-derived enrollment counts avoid stale denormalized counters.

## 10. Course discussion is scoped and retained

- **Chose:** I kept comments at course level using `Comment.courseId` and `authorId`, permitted enrolled learners on published courses and the owning instructor, and derived the author from the session. Comments are ordered deterministically and preserved across archive/restore.
- **Rejected:** Lesson discussion threads, request-body author IDs, frontend-only participation checks, deleting archived discussion, or silently truncating text.
- **Why:** The required discussion boundary is the course, and relationship authorization prevents impersonation. Archived learners lose active access while owners can review preserved history; server validation keeps comment limits consistent for every client.

## 11. Instructor enrollment uses normalized learner email

- **Chose:** I require an owned published course for new instructor enrollment, normalize learner email by trimming and lowercasing, look up an existing learner, and rely on the enrollment uniqueness constraint for concurrency.
- **Rejected:** Request-body instructor/learner IDs, automatic account creation, instructor-role enrollment, or adding learners to drafts and archives.
- **Why:** Email matches the instructor workflow while server-derived identity and role checks prevent IDOR and role confusion. Historical enrollments remain listable after archive.

## 12. Bulk enrollment is bounded and reports each row

- **Chose:** I kept multipart CSV bulk enrollment synchronous, bounded to one optional `email` column, 1,000 rows, and 256 KiB. Each normalized row is processed independently and receives an actionable result, including duplicate-file results.
- **Rejected:** Unbounded uploads, a separate bulk-history table, one transaction that rolls back valid rows, or silently discarding invalid/missing/duplicate addresses.
- **Why:** Instructors get useful partial-success feedback without adding a spreadsheet or file-storage subsystem. The database remains the final boundary for duplicate enrollment races. The UI also accepts pasted emails, normalizes common delimiters, and sends them through this same bulk endpoint.

## 13. Activity history and inactivity alerts are query-oriented

- **Chose:** I use append-only, server-authored `ActivityLog` records for required course, lesson, lifecycle, enrollment, completion, and comment history. I track real learner progress in one `CourseActivity` row per learner/course, compute strict-more-than-14-day inactivity at query time, and persist one dismissal checkpoint in `AlertDismissal`.
- **Rejected:** Editable/deletable history, client-authored actors, a mutable `isInactive` flag, treating visits as progress, storing every alert instance, permanent dismissal, pings, queues, or notification infrastructure.
- **Why:** Activity and alert eligibility remain authoritative without duplicate alert rows or stale classifications. Later real progress deletes the dismissal so a new inactive period can surface, while archive hides active alerts without deleting history.

## 14. The instructor dashboard is an owner-scoped read model

- **Chose:** I calculate dashboard totals, enrollment-by-course, enrollment-by-state, and the eight-week completion trend in one authenticated instructor endpoint using existing relational data.
- **Rejected:** Browser aggregation of paginated data, a denormalized analytics schema, or background analytics infrastructure.
- **Why:** The dashboard remains read-only, current, and scoped to the session instructor without introducing another source of truth or schema maintenance.

## 15. Progress export is complete and spreadsheet-safe

- **Chose:** I provide an owner-only server CSV export across all course enrollments, reusing current lesson-derived progress. It emits `learner_email`, `progress_state`, `completed_lessons`, `total_lessons`, and `completion_percentage` with deterministic identifier-based filenames, RFC-style quoting, and formula-leading value protection.
- **Rejected:** Browser-side generation, a second progress algorithm, exporting only the paginated learner list, title-derived filenames, raw comma concatenation, or exposing password/session fields.
- **Why:** The complete export remains consistent with add/delete/reorder progress semantics. Server-side escaping keeps rows structurally valid and reduces spreadsheet formula risks without changing the data model.

## 16. The UI uses a minimal role-specific React shell

- **Chose:** I use one React shell selected from `/api/auth/me`, with role-specific navigation, typed API clients, local server-backed component state, and reusable course-detail modules for metadata, lessons, learners, activity, alerts, and discussion.
- **Rejected:** Client authorization, localStorage roles, duplicated fetch mechanisms, a state-management library, or a new UI framework.
- **Why:** The interface stays small and understandable while the backend remains the security boundary. Learner and instructor views refresh after server commands so displayed state reflects authoritative responses.

## 17. Development remains explicit and operationally honest

- **Chose:** I keep schema changes in Prisma migrations, use an explicitly invoked idempotent development seed, document verified local commands and deployment configuration, and leave optional stretch features out of scope.
- **Rejected:** Seeding at server startup, hiding operational limitations, claiming unverified deployment behavior as local verification, or adding speculative features before the required workflows were complete.
- **Why:** Repeatable setup and honest verification make the take-home easier to inspect. The current `express-session` MemoryStore is suitable for a single-instance/demo deployment but should be replaced with persistent storage before horizontal scaling.

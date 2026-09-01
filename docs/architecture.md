# Architecture

## Activity history, progress activity, and alerts (confirmed)

Course/lesson creation and edits, publish/archive/restore transitions, and comment creation write immutable `ActivityLog` records with the actor derived from the authenticated session. Only the owning instructor can retrieve a course log.

```text
Learner start/complete changes progress
  ↓ (same transaction)
CourseActivity(learnerId, courseId).lastProgressAt upsert
  ↓
Instructor activity/alerts request
  ↓
PostgreSQL filters PUBLISHED + IN_PROGRESS + lastProgressAt < server-now-minus-14-days
```

README defines inactivity as no further **progress** for more than fourteen days, not a page or lesson visit. Idempotent progress requests, catalogue, comments, and read requests do not update it. Archive excludes active alerts without deleting activity; restore leaves timestamps unchanged. Dismissal is a persisted marker, removed only by later real progress so a new inactive period can surface. Ping and learner notifications are not implemented because README does not require them.

## Confirmed

The project is an npm-workspaces TypeScript monorepo: React/Vite in `apps/client`, Express in `apps/server`, and Prisma/PostgreSQL schema in `prisma`. The server provides health, authentication, instructor course management, instructor lesson management, and explicit instructor course-lifecycle routes. The client is a deliberately small instructor management interface.

The database boundary is now designed as:

```text
Frontend
  ↓
Backend/API
  ↓
Service and business-rule layer (planned)
  ↓
Prisma
  ↓
PostgreSQL
```

Prisma owns persistence mapping and database constraints. PostgreSQL holds the relational core, including foreign keys and uniqueness. The initial migration is applied to the configured local development PostgreSQL database.

Authentication now follows this request path:

```text
React auth form / API client
  ↓ (credentialed fetch)
Authentication API
  ↓ (Argon2id verify and session regeneration)
HTTP-only signed session cookie
  ↓ (next request)
requireAuth loads server-side user identity
  ↓
requireRole verifies stored role
  ↓
Future ownership/enrollment business authorization
  ↓
Prisma / PostgreSQL
```

The cookie carries only a session identifier; the in-memory development session stores only a user ID. `requireAuth` reloads safe user data from the repository on each protected request, so roles and identity never come from the frontend. The server requires a 32+ character `SESSION_SECRET`; production also refuses to start without `CLIENT_ORIGIN`. Session cookies are `HttpOnly`, `SameSite=Lax`, seven-day cookies and use `Secure` in production. CORS permits only `CLIENT_ORIGIN` and credentials, never wildcard origin with credentials.

Instructor course requests now follow this path:

```text
Minimal instructor course UI
  ↓
Course API
  ↓
requireAuth → requireRole(INSTRUCTOR)
  ↓
Course ownership check / authenticated instructor query scope
  ↓
Course validation and server-owned DRAFT status
  ↓
Prisma → PostgreSQL
```

Course creation derives `instructorId` from `request.authUser.id`; it never accepts an ownership ID or initial status from the browser. Read/update operations load the requested course and return 403 for an existing course owned by another instructor, while a missing course returns 404. List queries always apply the instructor scope in Prisma before optional search/category/status filters, whitelisted sorting, and database-level pagination.

Instructor lesson management follows the same ownership boundary:

```text
Instructor lesson manager
  ↓ (complete ordered lesson IDs for reorder)
Lesson API
  ↓
requireAuth → requireRole(INSTRUCTOR) → course ownership check
  ↓
Transactional lesson repository
  ↓
Prisma → PostgreSQL
```

`Lesson.id` is permanent identity; `position` is only instructor-defined display order. New lessons append at the end. Delete and reorder use serializable transactions and first move affected positions above the current range before assigning contiguous final positions, preserving the database unique `(courseId, position)` constraint. Deleting a lesson relies on the existing foreign-key cascade to remove only that lesson's `LessonProgress` records.

Course lifecycle is a separate server-side command boundary, rather than part of generic metadata editing:

```text
POST /api/courses/:courseId/publish | archive | restore
  ↓
requireAuth → requireRole(INSTRUCTOR)
  ↓
Serializable lifecycle transaction: load course, verify ownership/status,
verify a lesson exists before publishing, conditionally update status
  ↓
Prisma → PostgreSQL
```

The implemented transitions are `DRAFT → PUBLISHED`, `PUBLISHED → ARCHIVED`, and `ARCHIVED → PUBLISHED`. The conditional update prevents concurrent requests from silently overwriting a transition. Archive and restore modify only `Course.status`; they do not alter related lessons, enrollments, or lesson-progress records. The minimal course manager displays the relevant Publish, Archive, or Restore action and refreshes server state after success.

The full learner catalogue extends the existing `GET /api/available-courses` route:

```text
Learner catalogue controls
  ↓ query parameters only
requireAuth → requireRole(LEARNER)
  ↓
PostgreSQL visibility filter: status = PUBLISHED
  ↓
Search/category/instructor filters → relation-count ordering → skip/take
  ↓
Prisma count query and page query
  ↓
One page plus total/totalPages returned to React
```

The route accepts `search`, `category`, `instructorId`, `sort`/`sortBy`, `direction`/`sortOrder`, `page`, and `limit`. Filters, case-insensitive title/description search, enrollment-count ordering, and pagination execute in PostgreSQL through Prisma; the browser never receives the complete catalogue. Learners are always restricted to published courses—even if they supply a draft/archived status query—and `instructorId` is only a filter over that visible dataset. Catalogue entries expose safe instructor ID/email and a relation-derived `enrollmentCount`, never enrollment rows.

The established instructor `GET /api/courses` list uses the same bounded database filtering/pagination mechanics. It returns only the session instructor's own draft, published, and archived courses; an `instructorId` query cannot change that ownership scope. Both lists default to `createdAt DESC, id DESC`; title, creation date, and enrollment count support a deterministic `id DESC` secondary order.

Learner enrollment and progress now follow this server-enforced path:

```text
Learner UI
  ↓ (credentialed fetch)
requireAuth → requireRole(LEARNER)
  ↓ (session-derived learner ID)
Enrollment lookup / published-course access check
  ↓
Course lessons ordered by position and LessonProgress keyed by lesson ID
  ↓
Derived course progress from current lessons and timestamp facts
  ↓
Prisma → PostgreSQL
```

`POST /api/courses/:courseId/enroll` creates a learner's own enrollment only if the course is currently `PUBLISHED`. `GET /api/me/courses` reads only the authenticated learner's enrollments; a query parameter never supplies learner identity. Learner lesson/progress routes require both that enrollment and a currently published course. Archive blocks learner lesson/progress access but preserves the enrollment and all progress records; restored courses resume with those records intact.

Lesson progress has no client-provided state or timestamp input. Start creates a `(enrollmentId, lessonId)` record only when absent; complete creates both timestamps when absent or adds `completedAt` to an in-progress record. Reopening a completed lesson leaves it completed. The service calculates course state and percentage from the current lesson IDs, so reorder does not change progress, deletion removes only its cascaded progress, and a newly added lesson is naturally `NOT_STARTED`.

Instructor-managed enrollment follows the same server-owned identity boundary:

```text
Instructor form or CSV upload
  ↓
requireAuth → requireRole(INSTRUCTOR)
  ↓
session-derived instructor → owned, PUBLISHED course check
  ↓
normalized learner email → user/role lookup → Enrollment create
  ↓
PostgreSQL unique (learnerId, courseId)
```

`POST /api/courses/:courseId/enrollments` accepts only `{ email }`. `POST /api/courses/:courseId/enrollments/bulk` accepts a multipart CSV with one `email` column (header optional), up to 1,000 nonblank rows and 256 KiB. CSV rows are parsed as untrusted text, normalized with the same trim/lowercase rule as authentication, and processed independently so an invalid, missing, duplicate, or instructor row does not roll back valid rows. Each row receives `ADDED`, `ALREADY_ENROLLED`, `LEARNER_NOT_FOUND`, `NOT_A_LEARNER`, `INVALID_EMAIL`, or `DUPLICATE_IN_FILE`; first CSV occurrence is authoritative and later duplicates get `DUPLICATE_IN_FILE`.

`GET /api/courses/:courseId/enrollments` is owner-only, paginated, and returns safe learner ID/email plus enrollment data. It is intentionally available for archived owned courses to inspect preserved historical enrollment; creating individual or bulk enrollments is limited to published courses, matching the README’s active-course enrollment rule. New enrollment creates no `LessonProgress` rows.

The learner course experience uses the existing own-enrollment and lesson/progress routes. Selecting an enrolled course renders server-ordered lessons, their position/state, the selected lesson's stored material, and the current server-derived course progress. Opening a lesson calls the existing start command; completing it refetches server progress. An archived enrollment remains listed, but active learner lesson and discussion access are server-blocked with the archived-course message.

Course-level discussion is a separate, scoped resource:

```text
GET/POST /api/courses/:courseId/comments
  ↓
requireAuth → session user and stored role
  ↓
Instructor ownership OR learner enrollment + PUBLISHED status
  ↓
Prisma Comment(courseId, authorId) → PostgreSQL
```

Comments are never lesson-specific. Their author comes exclusively from the authenticated session; the API returns only safe author identity, comment body, and timestamp. Comments are ordered `createdAt ASC, id ASC`. Owners can review existing archived discussion, but archived courses reject all new comments; learner discussion access follows the same archived restriction as lessons. Restore makes valid learner discussion available again without recreating comments.

## Planned

Future API/service code will use the established server-side identity for ownership and enrollment checks; frontend-submitted roles or IDs will never authorize an action. The service layer will derive and update enrollment progress from lesson progress and enforce activity immutability. The current `express-session` MemoryStore is intentionally development-only and must be replaced with persistent session storage before horizontally scaled production deployment.

Activity behavior, alerts, CSV processing, analytics, and notifications remain planned.

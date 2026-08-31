# Architecture

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

## Planned

Future API/service code will use the established server-side identity for ownership and enrollment checks; frontend-submitted roles or IDs will never authorize an action. The service layer will derive and update enrollment progress from lesson progress and enforce activity immutability. The current `express-session` MemoryStore is intentionally development-only and must be replaced with persistent session storage before horizontally scaled production deployment.

The future learner catalogue query must apply `status = PUBLISHED` in the server query before search, allowed filters, sorting, total counting, and pagination; it must not load all courses in the browser. Draft and archived courses are not yet exposed through any learner route. Enrollment-count sorting, enrollment/progress APIs, activity behavior, comments, alerts, CSV processing, analytics, and learner UI remain planned.

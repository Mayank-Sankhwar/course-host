# Architecture

## Confirmed

The project is an npm-workspaces TypeScript monorepo: React/Vite in `apps/client`, Express in `apps/server`, and Prisma/PostgreSQL schema in `prisma`. The current server has only `GET /health`; the client is a minimal mount point.

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

Prisma owns persistence mapping and database constraints. PostgreSQL holds the relational core, including foreign keys and uniqueness. An initial migration is not yet present or applied because a real development PostgreSQL connection has not been configured.

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

## Planned

Future API/service code will use the established server-side identity for ownership and enrollment checks; frontend-submitted roles or IDs will never authorize an action. The service layer will derive and update enrollment progress from lesson progress, perform reorder transactions, and enforce activity immutability. The current `express-session` MemoryStore is intentionally development-only and must be replaced with persistent session storage before horizontally scaled production deployment.

Learner catalogue filtering and enrollment-count sorting remain planned. No lesson, publishing, archiving, restoring, enrollment, activity behavior, comments, alerts, CSV processing, or analytics has been implemented.

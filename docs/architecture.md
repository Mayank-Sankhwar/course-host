# Architecture

CourseHost is a TypeScript monorepo with a React/Vite frontend, an Express/TypeScript API, Prisma persistence, and PostgreSQL. In deployment, the frontend and backend run as separate Render services and communicate over credentialed HTTPS requests.

## 1. System components and communication

The main moving pieces are:

- **Browser and React client:** The client renders role-specific instructor and learner workflows, sends requests through typed API modules, and displays server responses. It does not connect directly to PostgreSQL or decide authorization.
- **Express API:** The backend exposes authentication, course/lifecycle, lesson, catalogue, enrollment, learner-progress, comment, activity/alert, dashboard, and progress-export routes.
- **Authentication and authorization middleware:** `express-session` manages the session cookie; `requireAuth` reloads the authenticated user from the repository and `requireRole` enforces the required role. Services then apply ownership, enrollment, course-status, and lesson-access rules.
- **Service and repository layers:** Services implement business rules and transaction boundaries. Repositories and Prisma queries persist and retrieve domain records.
- **Prisma and PostgreSQL:** Prisma maps the TypeScript server to the relational schema. PostgreSQL stores users, courses, lessons, enrollments, lesson progress, comments, activity history, course activity, and alert dismissals, along with foreign keys, indexes, and uniqueness constraints.

Production topology:

```text
Browser
  |
  | HTTPS + credentialed API requests
  v
Render frontend: React/Vite client
  |
  | HTTPS API requests
  v
Render backend: Express/TypeScript API
  |
  +--> express-session MemoryStore and HTTP-only session cookie
  |
  v
Services and repositories
  |
  v
Prisma
  |
  v
PostgreSQL
```

The deployed frontend is `https://course-host-frontend.onrender.com/`. The deployed backend is
`https://course-host-d87j.onrender.com`. `CLIENT_ORIGIN` identifies the frontend origin; backend
CORS allows that configured origin and credentials, so the browser can send the HTTP-only session
cookie with protected API requests.

## 2. Where each component runs

### Production

Render hosts the React/Vite frontend and a separate Express/TypeScript backend service. PostgreSQL
provides persistent relational storage and is connected through the backend's `DATABASE_URL`. The
frontend and backend have separate origins. The backend restricts CORS to `CLIENT_ORIGIN`, and the
client uses credentialed requests. In production, the session cookie is HTTP-only, secure, and
cross-site compatible; authentication state is carried by that cookie.

The current backend session store is the process-local `express-session` MemoryStore. It is part of
the deployed implementation and is suitable for the current single-instance/demo arrangement.

### Local development

The client runs through the Vite development server and the backend through `tsx watch`; the two
processes communicate using the configured client origin and API base URL. PostgreSQL is configured
through `DATABASE_URL`. The repository uses Prisma migrations, client generation, and the explicit
development seed:

```text
npx prisma migrate deploy
npm run prisma:generate
npm run prisma:seed
npm run dev:server
npm run dev:client
```

The frontend and backend are normally run in separate terminals. Tests use Vitest and Supertest,
with PostgreSQL-backed integration coverage where configured.

## 3. Representative request: learner completes a lesson

A learner completing a lesson follows this path:

```text
Learner clicks the completion action
  ↓
React sends a credentialed POST request
  ↓
Express receives the request and session middleware resolves the session
  ↓
requireAuth and requireRole verify the authenticated learner
  ↓
The learner service verifies enrollment and published-course access
  ↓
The service verifies that the lesson belongs to the course
  ↓
The service rejects completion if the enrollment is still NOT_STARTED
  ↓
Prisma updates LessonProgress and derives course progress in PostgreSQL
  ↓
The same transaction updates CourseActivity for real progress changes
  ↓
The API returns lesson progress, course progress, and enrollment state
  ↓
React refreshes lesson/course data and the displayed progress
```

The learner identity comes from the server-side session, not the request body. The service does not
trust client-provided state or timestamps. Completion must follow `NOT_STARTED → IN_PROGRESS →
COMPLETED`; starting a lesson creates the server-timestamped in-progress fact first. Course state
and percentage are derived from the current lessons and progress facts rather than accepted from the
browser.

## 4. Important architectural boundaries

### Authentication and authorization

Signup creates learners only. Passwords are hashed with Argon2id. Login regenerates a signed
`express-session` session whose cookie is HTTP-only and contains only a session identifier; protected
requests reload the current user from the server-side repository. `requireAuth` handles authentication
and `requireRole` handles role checks. Ownership and enrollment relationships provide the remaining
authorization boundary, so frontend route state, IDs, and roles cannot grant access.

### Course ownership and lifecycle

Instructor course creation derives `instructorId` from the authenticated session and always creates a
draft. Instructor list queries are scoped to that instructor, and course/lesson mutations verify
ownership server-side. Lifecycle commands are separate from metadata `PATCH` operations and implement
`DRAFT → PUBLISHED`, `PUBLISHED → ARCHIVED`, and `ARCHIVED → PUBLISHED`. Publishing checks that a
lesson exists. Archive and restore change course status without deleting lessons, enrollments,
progress, comments, or activity history.

### Lessons and progress

Lesson IDs are permanent; mutable positions control ordered display. Lesson creation appends and
reordering uses a complete lesson ID set inside a serializable transaction with temporary positions.
Deleting a lesson preserves the rest of the course and cascades only its lesson-progress records.
Progress uses `startedAt` and `completedAt` timestamp facts. The service enforces the required start
before completion, and course progress is calculated from the current lesson set, so reordering does
not remap progress and additions/deletions are reflected naturally.

### Catalogue

The learner and instructor course lists use Prisma-side search, category/status/instructor filters,
whitelisted title/creation-date/enrollment-count sorting, deterministic tie-breaking, pagination,
and total counts. Learners are restricted to published courses, while instructor lists are scoped to
the authenticated instructor. The browser receives only the requested page and never receives the
complete catalogue for client-side filtering.

### Enrollment

Learners self-enroll using session-derived identity and only into published courses. Instructors can
enroll existing learners into their owned published courses by normalized email. Bulk enrollment is
bounded, accepts CSV input, processes rows independently, and returns per-row results; the client can
also normalize pasted emails and send them through the same bulk endpoint. Database uniqueness on
`(learnerId, courseId)` protects enrollment integrity under concurrency.

### Activity, comments, alerts, and dashboard

Comments are course-level and authorize the owning instructor or an enrolled learner according to
course status; authors come from the session. Activity logs are append-only and server-authored.
Real learner progress updates one `CourseActivity` timestamp per learner/course in the same
transaction. Instructor alerts query strict-more-than-14-day inactivity for in-progress learners and
use persistent dismissal checkpoints that are cleared by later real progress. The instructor
dashboard is an owner-scoped read model for totals, enrollment breakdowns, and the eight-week
completion trend.

### Progress export

The instructor progress export is an owner-only server endpoint that reads all course enrollments and
reuses the current derived-progress calculation. It returns a stable set of progress columns with
CSV quoting and formula-leading value protection; it does not expose passwords, sessions, or other
credential data.

## 5. What I deliberately did NOT build

I left quizzes, certificates, prerequisite courses, video tracking, ratings and reviews, learning
paths, downloadable resources, and email digests out of scope. They were not required for the core
assignment and would require additional domain models, business rules, and in some cases external
integrations or background infrastructure. I prioritized the required authorization, lifecycle,
enrollment, progress, catalogue, activity, dashboard, comments, and export flows instead.

## 6. Current limitations and scaling considerations

### Session storage

The backend currently uses `express-session`'s process-local MemoryStore. Active sessions are held in
backend process memory, so restarting the backend loses them and multiple backend instances cannot
share them. This is acceptable for the current single-instance/demo deployment, but a persistent
shared session store is required before horizontal scaling.

The application deliberately derives progress, course state, enrollment counts, dashboard metrics,
and alert eligibility from relational data instead of introducing separate analytics infrastructure.
That keeps the current system compact and authoritative, while a larger deployment may eventually
need dedicated operational observability and scaling work.

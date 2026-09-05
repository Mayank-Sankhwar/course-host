# CourseHost

CourseHost is a role-based course delivery platform for instructors to create and manage courses and
for learners to discover courses, enroll, complete lessons, and track progress.

## Overview

CourseHost supports two server-authorized roles. Instructors manage courses and ordered lessons,
control publishing and archiving, enroll learners, monitor activity and progress, and use dashboard,
alert, discussion, and CSV workflows. Learners browse published courses, enroll, access lesson
content, participate in course discussions, and record progress through each course.

The application is built around a relational source of truth: lesson progress is recorded as
server-timestamped facts, while course progress and reporting values are derived from current data.

## Key Features

### Authentication and authorization

- Learner and instructor roles.
- Argon2id password hashing.
- HTTP-only `express-session` cookies.
- Server-side role, ownership, and enrollment checks.
- Public signup creates learner accounts only.

### Instructor workflows

- Create, update, list, publish, archive, and restore courses.
- Create, edit, delete, and reorder lessons.
- Enroll registered learners individually or in bulk.
- Paste learner emails or upload a bounded CSV with per-row results.
- View learner enrollment and progress information.
- Review immutable activity history and course comments.
- Monitor inactivity alerts and dashboard metrics.
- Export complete course progress as CSV.

### Learner workflows

- Browse the published course catalogue.
- Search, filter, sort, and paginate server-side course results.
- Enroll in published courses and view enrolled courses.
- Read ordered lesson content.
- Start and complete lessons using the enforced `NOT_STARTED -> IN_PROGRESS -> COMPLETED` flow.
- View derived course progress and participate in permitted course discussions.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| ORM and persistence | Prisma |
| Authentication | Argon2id, `express-session` |
| Testing | Vitest, Supertest, PostgreSQL integration tests |
| Deployment | Render |

## Architecture

```text
Browser
  |
  | HTTPS and credentialed API requests
  v
Render frontend: React/Vite client
  |
  | API requests
  v
Render backend: Express/TypeScript API
  |
  +--> express-session process-local session state
  |
  v
Service and business rules
  |
  v
Prisma
  |
  v
PostgreSQL
```

The UI handles presentation and interaction. Routes handle transport and request validation; service
code owns business rules and authorization; Prisma owns persistence access; and PostgreSQL enforces
foreign keys and core uniqueness. The frontend never connects directly to PostgreSQL and does not
determine authorization.

The deployed frontend is [https://course-host-frontend.onrender.com/](https://course-host-frontend.onrender.com/).
The backend is deployed separately at `https://course-host-d87j.onrender.com`. Because the origins
are separate, the backend allows the configured `CLIENT_ORIGIN` with credentials and authentication
uses an HTTP-only session cookie. The first Render request may take approximately 50 seconds while a
service wakes from inactivity; allow the initial request to complete. The browser must permit the
required cross-site cookie behavior for login and session persistence.

See [docs/architecture.md](docs/architecture.md) for the complete request path and system-boundary
description.

## Core Data Model

The schema contains `User`, `Course`, `Lesson`, `Enrollment`, `LessonProgress`, `Comment`,
`ActivityLog`, `CourseActivity`, and `AlertDismissal`. A learner-course relationship is represented
by the explicit `Enrollment` model, and lesson progress is represented by timestamp facts associated
with an enrollment and lesson. Course progress is derived from current lessons and those facts rather
than maintained as a manually updated percentage.

See [docs/schema.md](docs/schema.md) for every field, relationship, constraint, deletion rule, index,
and scaling consideration.

## Authentication and Authorization

1. The user submits credentials to the API.
2. The server verifies the password with Argon2id.
3. The server establishes a signed session containing server-side identity.
4. The browser stores the HTTP-only session cookie.
5. Protected requests resolve the current user from the server-side session/repository.
6. Role, course ownership, enrollment, and course-visibility checks determine access.

The browser does not supply trusted roles, ownership, or learner identity. The cookie carries a
session identifier rather than application authorization data.

## Demo Accounts

The seeded demo environment contains **10 instructors and 100 learners**.

### Instructor accounts

All seeded instructor accounts use:

**Password:** `12345678i`

| Email                   |
| ----------------------- |
| `instructora@gmail.com` |
| `instructorb@gmail.com` |
| `instructorc@gmail.com` |
| `instructord@gmail.com` |
| `instructore@gmail.com` |
| `instructorf@gmail.com` |
| `instructorg@gmail.com` |
| `instructorh@gmail.com` |
| `instructori@gmail.com` |
| `instructorj@gmail.com` |

### Learner accounts

The first 6 seeded learner accounts are provided below.

**Password:** `12345678l`

|  # | Email                |
| -: | -------------------- |
|  1 | `learnera@gmail.com` |
|  2 | `learnerb@gmail.com` |
|  3 | `learnerc@gmail.com` |
|  4 | `learnerd@gmail.com` |
|  5 | `learnere@gmail.com` |
|  6 | `learnerf@gmail.com` |

The seed contains **100 learner accounts in total**. The remaining accounts continue the same deterministic lowercase naming pattern (`learneru@gmail.com`, `learnerv@gmail.com`, ..., followed by `learneraa@gmail.com`, `learnerab@gmail.com`, and so on till `learnerch@gmail.com`).


## Local Development

### Prerequisites

- Node.js and npm.
- A configured PostgreSQL database.

### Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/Mayank-Sankhwar/course-host.git
cd course-host
npm install
```

Create `.env` from `.env.example` and configure `DATABASE_URL`, `SESSION_SECRET` with at least 32
characters, and `CLIENT_ORIGIN`. Apply migrations, generate Prisma Client, and seed the deterministic
development dataset:

```bash
npx prisma migrate deploy
npm run prisma:generate
npm run prisma:seed
```

Run the client and server in separate terminals:

```bash
npm run dev:server
npm run dev:client
```

The server defaults to port 3001 and the Vite client defaults to port 5173. The client API base can
be configured with `VITE_API_BASE_URL` when the API is not on its default local address.

## Verification

From the repository root:

```bash
npm test
npm run typecheck
npm run build
npm run prisma:validate
npm run prisma:generate
npx prisma migrate status
```

The project includes authentication, course, catalogue, enrollment, lesson, learner-progress,
comment, activity, alert, lifecycle, and export coverage. PostgreSQL-backed integration tests require
a configured database.

## Deployment

The frontend and backend run as separate Render services. The frontend is available at
[https://course-host-frontend.onrender.com/](https://course-host-frontend.onrender.com/), and the
backend API is available at `https://course-host-d87j.onrender.com`. The backend connects to
PostgreSQL through environment configuration, including `DATABASE_URL`, and uses the configured
frontend origin for credentialed CORS.

The deployed login flow uses secure, HTTP-only session cookies for credentialed cross-origin requests. The browser must allow the
required cross-site cookie behavior for sessions to persist. Render services may cold-start after
inactivity.

## Known Limitations and Trade-offs

The backend currently uses the process-local `express-session` MemoryStore. This is suitable for the
current single-instance/demo deployment, but restarting the backend loses active sessions and
multiple backend instances cannot share session state. A persistent shared session store is the
necessary improvement before horizontal scaling.

Progress, course state, enrollment counts, dashboard metrics, and alert eligibility are derived or
queried from relational data rather than maintained by separate analytics infrastructure. Optional
features such as quizzes, certificates, prerequisites, video tracking, ratings, learning paths,
downloadable resources, and email digests are outside the assignment scope.

## Further Documentation

- [docs/architecture.md](docs/architecture.md): deployed topology, request flow, and system boundaries.
- [docs/schema.md](docs/schema.md): complete Prisma data model, constraints, relationships, and scale analysis.
- [docs/decisions.md](docs/decisions.md): major engineering decisions and trade-offs.
- [docs/plan.md](docs/plan.md): implementation phases, estimates, actual effort, scope cuts, and final status.
- [docs/ai-prompts.md](docs/ai-prompts.md): AI prompts, implementation work, reviews, and corrections.

## Repository

[https://github.com/Mayank-Sankhwar/course-host](https://github.com/Mayank-Sankhwar/course-host)

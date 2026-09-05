# CourseHost — Take-Home Submission

## Links

* **Repository:** https://github.com/Mayank-Sankhwar/course-host
* **Live application:** https://course-host-frontend.onrender.com/

## Before You Test

The live application is deployed on Render. The first request may take **approximately 50 seconds** while the service wakes up from inactivity. Please wait for the initial request to complete before concluding that the application is unavailable.

The frontend and backend are deployed on separate origins, and authentication uses an HTTP-only session cookie. Please **allow third-party/cross-site cookies** in your browser for login and session persistence to work correctly. If login does not appear to persist, check the browser's cookie settings and retry.

---

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

The first 10 seeded learner accounts are provided below.

**Password:** `12345678l`

|  # | Email                |
| -: | -------------------- |
|  1 | `learnera@gmail.com` |
|  2 | `learnerb@gmail.com` |
|  3 | `learnerc@gmail.com` |
|  4 | `learnerd@gmail.com` |
|  5 | `learnere@gmail.com` |
|  6 | `learnerf@gmail.com` |
|  7 | `learnerg@gmail.com` |
|  8 | `learnerh@gmail.com` |
|  9 | `learneri@gmail.com` |
| 10 | `learnerj@gmail.com` |

The seed contains **100 learner accounts in total**. The remaining accounts continue the same deterministic lowercase naming pattern (`learneru@gmail.com`, `learnerv@gmail.com`, ..., followed by `learneraa@gmail.com`, `learnerab@gmail.com`, and so on till `learnerch@gmail.com`).

---

## Overview

CourseHost is a course delivery platform with separate instructor and learner workflows.

Instructors can create and manage courses and ordered lessons, control course lifecycle states, enroll learners individually or in bulk, monitor learner progress, review course activity and comments, view dashboard metrics, export progress data, and manage inactivity alerts.

Learners can browse a server-side course catalogue, enroll in published courses, access lessons, comment where permitted, and track lesson progress through the enforced:

`NOT_STARTED → IN_PROGRESS → COMPLETED`

workflow.

---

## Technology Stack

| Layer          | Technology                                                      |
| -------------- | --------------------------------------------------------------- |
| Frontend       | React 19, TypeScript, Vite                                      |
| Backend        | Node.js, Express 5, TypeScript                                  |
| Database       | PostgreSQL                                                      |
| ORM            | Prisma 6                                                        |
| Authentication | Argon2id password hashing + `express-session` HTTP-only cookies |
| Testing        | Vitest, Supertest, PostgreSQL integration tests                 |
| Deployment     | Render                                                          |

---

## Assignment Requirements

|  # | Requirement                | Status   | Implementation                                                                                                                      |
| -: | -------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
|  1 | Accounts and roles         | Complete | Learner/instructor authentication with HTTP-only sessions, server-side role checks, and ownership authorization.                    |
|  2 | Courses                    | Complete | Instructor CRUD with draft, published, and archived lifecycle states.                                                               |
|  3 | Lessons                    | Complete | Lesson creation, editing, deletion, reordering, and ordered learner access.                                                         |
|  4 | Course and progress states | Complete | Server-derived progress with enforced `NOT_STARTED → IN_PROGRESS → COMPLETED` transitions; publishing requires at least one lesson. |
|  5 | Enrollment                 | Complete | Learner self-enrollment, instructor enrollment, enrolled-course views, and lesson progress tracking.                                |
|  6 | Finding courses            | Complete | Server-side search, filtering, sorting, pagination, and total counts.                                                               |
|  7 | Bulk enrollment            | Complete | Individual and pasted/CSV enrollment with per-email results, plus progress CSV export.                                              |
|  8 | Dashboard                  | Complete | Instructor metrics, enrollment/progress breakdowns, and eight-week completion trends.                                               |
|  9 | History                    | Complete | Append-only activity history and course comments with server-derived authorship.                                                    |
| 10 | Inactivity alerts          | Complete | Owner-scoped alerts for more than 14 days of inactivity, with dismissal and re-alerting after subsequent progress.                  |

---

## Running Locally

From the repository root:

```bash
npm install
```

Create `.env` from `.env.example` and configure the required database, session, and client-origin settings.

Apply the database migrations, generate the Prisma client, and seed development data:

```bash
npx prisma migrate deploy
npm run prisma:generate
npm run prisma:seed
```

Run the backend and frontend in separate terminals:

```bash
npm run dev:server
npm run dev:client
```

The demo seed creates deterministic instructor, learner, course, enrollment, progress, activity, and comment data for local development.

---

## Verification

The repository provides the following verification commands:

```bash
npm test
npm run typecheck
npm run build
npm run prisma:validate
npm run prisma:generate
npx prisma migrate status
```

The project includes PostgreSQL-backed server integration tests, client/server TypeScript checks, and client/server production builds. Database-dependent commands require a configured PostgreSQL instance.

---

## Deployment

The frontend and backend are deployed separately on Render, with PostgreSQL configured through environment variables.

Production configuration keeps secrets outside the repository. The deployed frontend and backend use credentialed cross-origin requests so the HTTP-only session cookie can be used for authentication.

The current deployment uses `express-session`'s in-memory session store. This is sufficient for the current single-instance demonstration deployment, but persistent session storage would be required before scaling the application across multiple instances.

---


## Supporting Documentation

The detailed engineering documentation is separated from this submission summary:

* [Architecture](https://github.com/Mayank-Sankhwar/course-host/blob/main/docs/architecture.md) — system structure, request flows, authorization, and major implementation behavior.
* [Schema](https://github.com/Mayank-Sankhwar/course-host/blob/main/docs/schema.md) — database models, relationships, constraints, indexes, and data integrity decisions.
* [Engineering Decisions](https://github.com/Mayank-Sankhwar/course-host/blob/main/docs/decisions.md) — significant implementation choices, rejected alternatives, trade-offs, and a decision that was later reversed after implementation and testing.
* [AI-Assisted Development](https://github.com/Mayank-Sankhwar/course-host/blob/main/docs/ai-prompts.md) — prompts used during development together with implementation, review, and correction history.
* [Project Plan](https://github.com/Mayank-Sankhwar/course-host/blob/main/docs/plan.md) — implementation phases, estimates, verification history, and development progression.

---

# Final Reflection

## How much time did you actually spend?

I spent approximately **15–18 hours on the assignment**, including implementation, integration testing, debugging, deployment, and documentation.

The largest time investments were in authentication/session behavior, course and lesson workflows, progress-state correctness, PostgreSQL integration testing, and resolving the deployed cross-origin session-cookie behavior.


## What would you do next, with another 12 hours?

I would prioritize production hardening and end-to-end confidence rather than adding more product features:

1. **Replace the in-memory session store** with persistent PostgreSQL-backed session storage so the application can safely scale beyond a single instance.
2. **Add browser-level end-to-end tests** covering deployed login/session persistence and the primary instructor and learner workflows.
3. **Improve UI/UX polish**, particularly loading, error, empty, and success states.
4. **Improve production observability**, including structured logging, clearer operational diagnostics, and more explicit health checks.
5. **Perform another security/performance pass** around rate limiting, request validation, and high-volume catalogue/dashboard queries.

These would improve production readiness without changing the core assignment scope.

## What are you least happy with in this codebase, and why?

The main trade-off I am least satisfied with is the current **in-memory session store**.

It keeps the implementation simple and is sufficient for the current single-instance deployment, but it is not appropriate for horizontal scaling: sessions would not be reliably shared between application instances, and restarts can invalidate active sessions.

For a production deployment intended to scale horizontally, I would move sessions to persistent shared storage, such as PostgreSQL-backed sessions or another dedicated session store.

I accepted this trade-off because the assignment's primary focus was the course-delivery functionality, authorization, data integrity, progress workflows, testing, and deployment rather than building a distributed session infrastructure.

---

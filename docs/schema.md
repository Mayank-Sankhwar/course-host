# Database schema

## Status

This is the authoritative initial PostgreSQL/Prisma design. `prisma/schema.prisma` is formatted and valid, and Prisma Client has been generated. An initial migration is pending because no real `DATABASE_URL` has been supplied; no database has been changed.

## Enums

- `Role`: `LEARNER`, `INSTRUCTOR`.
- `CourseStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`.
- `EnrollmentProgressState`: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETED`.
- `ActivityType`: a deliberately small event vocabulary covering course, lesson, enrollment, completion, and comment events. It can be extended only when later functionality needs a new activity.

## Models

| Model | Purpose and important fields | Relationships and database constraints |
|---|---|---|
| `User` | Shared learner/instructor account: immutable ID, unique normalized-at-the-boundary `email`, `passwordHash`, `role`, timestamps. Passwords are never stored. | Owns `Course`, holds `Enrollment`, authors `Comment`, acts in `ActivityLog`, and may be the learner in `AlertDismissal`. Unique email is enforced. |
| `Course` | Instructor-owned course: `instructorId`, title, description, category, status, timestamps. | One instructor; many lessons, enrollments, comments, activity records, and alert dismissals. `instructorId` is an explicit foreign key. |
| `Lesson` | Material: permanent `id`, `courseId`, title, content, mutable `position`, timestamps. | One course; many progress records. `@@unique([courseId, position])` prevents duplicate display positions without tying identity to order. |
| `Enrollment` | Learner/course membership: `learnerId`, `courseId`, derived-and-service-maintained `progressState`, enrollment/completion/update timestamps. | One learner and course; many `LessonProgress`. `@@unique([learnerId, courseId])` prevents duplicate enrollment. |
| `LessonProgress` | Facts for one enrollment and one lesson: `startedAt`, `completedAt`, `updatedAt`; it has no status column. | Cascades only when its lesson or enrollment is deleted. `@@unique([enrollmentId, lessonId])` prevents duplicate records. |
| `Comment` | Course-level `content`, author, and timestamps. | One course, one user. There is intentionally no lesson-comment foreign key. |
| `ActivityLog` | Immutable-history record: course, optional actor, constrained type, optional JSON `details`, creation time. | Course deletion is restricted; actor deletion sets only `actorId` to null, preserving the event. |
| `AlertDismissal` | The current dismissal checkpoint for a learner/course inactivity alert: course, learner, `dismissedAt`. | `@@unique([courseId, learnerId])` gives one current record; eligibility will be computed later rather than persisting alert instances. |

## Indexes and foreign-key behavior

Indexes support the intended catalogue and scoped queries: `Course(instructorId)`, `Course(status)`, `Course(category)`, `Lesson(courseId)`, `Enrollment(courseId)` (the enrollment unique key also indexes `learnerId`), `LessonProgress(lessonId)` (its unique key also indexes `enrollmentId`), `Comment(courseId)`, `ActivityLog(courseId, createdAt)`, and `AlertDismissal(learnerId)` (its unique key begins with `courseId`).

All course/user historical relationships use `onDelete: Restrict`, except `ActivityLog.actor`, which uses `SetNull` to preserve activity if user deletion is ever introduced. Hard deleting a course or user is not an application feature. Deleting a lesson later cascades only its `LessonProgress`; it cannot delete a course, enrollment, comments, or activity history. Deleting an enrollment likewise cascades only its own lesson-progress rows.

The unique lesson-position key requires a reorder service to use a transaction and temporary non-conflicting positions before final positions are assigned. This keeps database ordering unambiguous without changing lesson IDs.

## Database rules versus future service rules

The database enforces foreign keys, enum values, unique email/enrollment/progress/position values, and scoped deletion behavior. The service/API layer will enforce email normalization, password hashing, roles, ownership, learner enrollment access, course lifecycle, last-lesson protection, monotonic progress timestamps, comment eligibility, activity immutability, and valid `progressState` derivation/transitions.

`LessonProgress` state is timestamp-derived: no row means not started; a started-but-uncompleted row is in progress; a completed timestamp means completed. Course percentage and state are calculated from the current lessons plus their progress, so no completed count, total count, or percentage is persisted. This handles additions/deletions/reordering correctly.

There is no `CourseVisit`, persistent `Alert`, course-material, or lesson-discussion table. Visits do not equal learner progress; alert eligibility will be queried from progress timestamps and compared with `AlertDismissal.dismissedAt`.

## Course CRUD phase note

Course CRUD used the existing `Course` model unchanged. No migration or schema correction was needed: its `instructorId`, `status`, content fields, timestamps, and ownership index already support this phase.

# Database schema

## Course activity and alerts

`CourseActivity` is one current progress-activity row per learner/course: `id`, `learnerId`, `courseId`, `lastProgressAt`, `createdAt`, and `updatedAt`. Both compound unique constraints support its one-to-one relationships to the matching enrollment and optional alert dismissal. The course/timestamp index supports inactive-learner lookup. `lastProgressAt` is server-written only for real lesson-progress transitions.

`AlertDismissal` remains unique on `(courseId, learnerId)`. It acknowledges the current inactive period; it does not mark a learner active. A later progress transition deletes the dismissal so a later inactive period can alert again.

`ActivityLog` is append-only history with `courseId`, session-derived nullable `actorId`, enum `type`, bounded optional structured `details`, and `createdAt`. The application writes required course/lesson mutation, lifecycle, and comment events. No route edits/deletes logs or records passwords, sessions, or arbitrary bodies.

## Status

This is the authoritative PostgreSQL/Prisma design. `prisma/schema.prisma` is formatted and valid, the initial migration and `20260901090000_course_activity` migration are applied to the configured local PostgreSQL database, and Prisma Client is present.

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
| `AlertDismissal` | The current dismissal checkpoint for a learner/course inactivity alert: course, learner, `dismissedAt`. | `@@unique([courseId, learnerId])` gives one current record; alert eligibility is computed from `CourseActivity` rather than persisting alert instances. |

## Indexes and foreign-key behavior

Indexes support the intended catalogue and scoped queries: `Course(instructorId)`, `Course(status)`, `Course(category)`, `Lesson(courseId)`, `Enrollment(courseId)` (the enrollment unique key also indexes `learnerId`), `LessonProgress(lessonId)` (its unique key also indexes `enrollmentId`), `Comment(courseId)`, `ActivityLog(courseId, createdAt)`, and `AlertDismissal(learnerId)` (its unique key begins with `courseId`).

All course/user historical relationships use `onDelete: Restrict`, except `ActivityLog.actor`, which uses `SetNull` to preserve activity if user deletion is ever introduced. Hard deleting a course or user is not an application feature. Deleting a lesson later cascades only its `LessonProgress`; it cannot delete a course, enrollment, comments, or activity history. Deleting an enrollment likewise cascades only its own lesson-progress rows.

The unique lesson-position key requires a reorder service to use a transaction and temporary non-conflicting positions before final positions are assigned. This keeps database ordering unambiguous without changing lesson IDs.

## Database rules versus service rules

The database enforces foreign keys, enum values, unique email/enrollment/progress/position values, and scoped deletion behavior. The service/API layer enforces email normalization, password hashing, roles, ownership, explicit course lifecycle transitions, learner self-enrollment into published courses, enrollment-scoped progress access, monotonic lesson timestamps, the `NOT_STARTED → IN_PROGRESS → COMPLETED` lesson-progress rule, course-progress derivation, course-comment eligibility, instructor-controlled enrollment, activity immutability, and inactivity-alert eligibility.

`LessonProgress` state is timestamp-derived: no row means not started; a started-but-uncompleted row is in progress; a completed timestamp means completed. Course percentage and state are calculated from the current lessons plus their progress, so no completed count, total count, or percentage is persisted. This handles additions/deletions/reordering correctly.

There is no `CourseVisit`, persistent `Alert`, course-material, or lesson-discussion table. Visits do not equal learner progress; alert eligibility is queried from `CourseActivity.lastProgressAt` and compared with the persisted `AlertDismissal` checkpoint.

## Course CRUD phase note

Course CRUD used the existing `Course` model unchanged. No migration or schema correction was needed: its `instructorId`, `status`, content fields, timestamps, and ownership index already support this phase.

## Lesson-management phase note

Lesson management used the existing `Lesson` and `LessonProgress` schema unchanged. `Lesson.id` remains the stable progress reference while `position` is mutable ordering within a course. The database enforces unique `(courseId, position)`. The `LessonProgress.lessonId` foreign key uses `onDelete: Cascade`, so deletion removes only progress for the deleted lesson; course, enrollment, remaining lessons, and their progress remain intact.

## Course-lifecycle phase note

Publishing, archiving, and restoring used the existing `Course.status` enum and related foreign keys unchanged. A serializable service transaction verifies the expected current status and uses a conditional update, while publishing counts the current lessons before changing `DRAFT` to `PUBLISHED`. Archiving and restoring only update `Course.status`; lesson IDs/positions, enrollments, and `LessonProgress` rows are deliberately preserved.

## Full-catalogue phase note

No schema or migration change was required. Existing `Course.status`, `Course.category`, `Course.instructorId`, and the `Enrollment` relation are sufficient for visibility filters and relation-derived enrollment counts. Prisma orders by `Enrollment` relation count in PostgreSQL and returns only the numeric count, not enrollment records. Existing `Course(status)`, `Course(category)`, and `Course(instructorId)` indexes support the primary equality filters; no speculative text-search or denormalized count index was added for this take-home scale.

## Enrollment and learner-progress phase note

No Prisma schema change was required. An `Enrollment` is created only for the session-authenticated learner and a currently published course; `@@unique([learnerId, courseId])` protects repeated or concurrent enrollment. `LessonProgress` remains keyed by permanent lesson ID through `@@unique([enrollmentId, lessonId])`. A missing row represents `NOT_STARTED`, `startedAt` without `completedAt` represents `IN_PROGRESS`, and `completedAt` represents `COMPLETED`. Learner-facing course percentage and state are calculated from the current lesson set, so lesson position is never a progress identity and added/deleted lessons are reflected without mass-creating progress rows.

## Learner course experience and comments phase note

No schema or migration change was required. `Comment` already expresses the required course-level relationship: `courseId` links one comment to one course and `authorId` links it to one user; it deliberately has no `lessonId`. The database stores its text in `content`, while the API calls the validated value `body`. Server validation trims surrounding whitespace, requires a non-empty string, limits it to 2,000 characters and 50 whitespace-separated tokens, and rejects unexpected fields. Comments use `createdAt ASC, id ASC` deterministic chronology and remain preserved across archive/restore; application authorization controls viewing and creation rather than deleting history.

## Instructor enrollment and CSV phase note

No schema or migration change was required. The existing `Enrollment(learnerId, courseId)` relationship and `@@unique([learnerId, courseId])` are reused for individual and CSV enrollment. The application validates the owned published course, normalized learner email, learner role, and duplicates; PostgreSQL remains the final concurrency boundary. Bulk operations are not persisted as a separate table and no `LessonProgress` records are pre-created—new learners start with a single `Enrollment` and lazy progress facts.

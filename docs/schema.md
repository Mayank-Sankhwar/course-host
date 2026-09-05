# Database schema

PostgreSQL is the relational database for CourseHost, and Prisma is the ORM and persistence mapping
layer used by the Express server. `prisma/schema.prisma` is the authoritative schema definition.
It models users, courses, lessons, enrollments, lesson progress, comments, activity history, course
progress activity, and alert dismissal state. PostgreSQL enforces referential integrity and core
uniqueness; authenticated workflow, authorization, and derived business state remain in the
application/service layer.

## Current status

The schema is formatted and valid. The repository contains the initial migration and the
`20260901090000_course_activity` migration. Project documentation records these migrations as
applied to the configured local PostgreSQL database, and the generated Prisma Client is present.
This describes local database verification; it does not claim a separate production schema migration
was run from this repository.

## Enums

### `Role`

- `INSTRUCTOR`
- `LEARNER`

Used by `User.role` and server-side role authorization.

### `CourseStatus`

- `DRAFT`
- `PUBLISHED`
- `ARCHIVED`

Used by `Course.status` for the course lifecycle and learner visibility.

### `EnrollmentProgressState`

- `NOT_STARTED`
- `IN_PROGRESS`
- `COMPLETED`

Used by `Enrollment.progressState` as a server-maintained, queryable course-progress state.

### `ActivityType`

- `COURSE_CREATED`
- `COURSE_UPDATED`
- `COURSE_PUBLISHED`
- `COURSE_ARCHIVED`
- `COURSE_RESTORED`
- `LESSON_CREATED`
- `LESSON_UPDATED`
- `LESSON_DELETED`
- `LESSON_REORDERED`
- `LEARNER_ENROLLED`
- `LESSON_COMPLETED`
- `COMMENT_CREATED`

Used by `ActivityLog.type` for the append-only activity vocabulary.

## Tables and columns

The tables below list every scalar Prisma field. Relation fields are described separately in
[Relationships](#relationships).

### `User`

| Column | Prisma type | Nullable | Purpose and defaults |
|---|---|---:|---|
| `id` | `String` | No | Primary key; generated with `cuid()`. |
| `email` | `String` | No | Unique account email. Normalization is performed at the application boundary. |
| `passwordHash` | `String` | No | Argon2id password hash; plaintext passwords are not stored. |
| `role` | `Role` | No | Account role enum. |
| `createdAt` | `DateTime` | No | Creation timestamp; defaults to `now()`. |
| `updatedAt` | `DateTime` | No | Update timestamp; maintained with `@updatedAt`. |

`User.email` is the database-unique account identifier. Users can own courses, enroll in courses,
author comments, act as activity-log actors, and participate in course activity and alert dismissal
relationships.

### `Course`

| Column | Prisma type | Nullable | Purpose and defaults |
|---|---|---:|---|
| `id` | `String` | No | Primary key; generated with `cuid()`. |
| `instructorId` | `String` | No | Foreign key to the owning `User`. |
| `title` | `String` | No | Course title. |
| `description` | `String` | No | Course description and searchable text. |
| `category` | `String` | No | Course category and filter value. |
| `status` | `CourseStatus` | No | Lifecycle status; defaults to `DRAFT`. |
| `createdAt` | `DateTime` | No | Creation timestamp; defaults to `now()`. |
| `updatedAt` | `DateTime` | No | Update timestamp; maintained with `@updatedAt`. |

A course is owned by one instructor and is the parent for lessons, enrollments, comments, activity
records, course activity, and alert dismissals.

### `Lesson`

| Column | Prisma type | Nullable | Purpose and defaults |
|---|---|---:|---|
| `id` | `String` | No | Permanent primary key; generated with `cuid()`. |
| `courseId` | `String` | No | Foreign key to the containing course. |
| `title` | `String` | No | Lesson title. |
| `content` | `String` | No | Lesson material. |
| `position` | `Int` | No | Mutable display order within the course. |
| `createdAt` | `DateTime` | No | Creation timestamp; defaults to `now()`. |
| `updatedAt` | `DateTime` | No | Update timestamp; maintained with `@updatedAt`. |

`(courseId, position)` is unique. Position is ordering, not progress identity.

### `Enrollment`

| Column | Prisma type | Nullable | Purpose and defaults |
|---|---|---:|---|
| `id` | `String` | No | Primary key; generated with `cuid()`. |
| `learnerId` | `String` | No | Foreign key to the enrolled `User`. |
| `courseId` | `String` | No | Foreign key to the enrolled `Course`. |
| `progressState` | `EnrollmentProgressState` | No | Server-maintained course state; defaults to `NOT_STARTED`. |
| `enrolledAt` | `DateTime` | No | Enrollment timestamp; defaults to `now()`. |
| `completedAt` | `DateTime` | Yes | Course completion timestamp, set when derived course state completes. |
| `updatedAt` | `DateTime` | No | Update timestamp; maintained with `@updatedAt`. |

`(learnerId, courseId)` is unique, so a learner has at most one enrollment per course. The model
stores membership and queryable summary state while detailed lesson facts remain in
`LessonProgress`.

### `LessonProgress`

| Column | Prisma type | Nullable | Purpose and defaults |
|---|---|---:|---|
| `id` | `String` | No | Primary key; generated with `cuid()`. |
| `enrollmentId` | `String` | No | Foreign key to the learner's enrollment. |
| `lessonId` | `String` | No | Foreign key to the lesson. |
| `startedAt` | `DateTime` | Yes | Server timestamp for starting the lesson. |
| `completedAt` | `DateTime` | Yes | Server timestamp for completing the lesson. |
| `updatedAt` | `DateTime` | No | Update timestamp; maintained with `@updatedAt`. |

`(enrollmentId, lessonId)` is unique. There is intentionally no separate lesson-status column.

### `Comment`

| Column | Prisma type | Nullable | Purpose and defaults |
|---|---|---:|---|
| `id` | `String` | No | Primary key; generated with `cuid()`. |
| `courseId` | `String` | No | Foreign key to the discussed course. |
| `authorId` | `String` | No | Foreign key to the authoring user. |
| `content` | `String` | No | Validated course-level comment text. |
| `createdAt` | `DateTime` | No | Creation timestamp; defaults to `now()`. |
| `updatedAt` | `DateTime` | No | Update timestamp; maintained with `@updatedAt`. |

Comments are course-level rather than lesson-level. Application validation limits content to 2,000
characters and 50 non-empty whitespace-separated words.

### `ActivityLog`

| Column | Prisma type | Nullable | Purpose and defaults |
|---|---|---:|---|
| `id` | `String` | No | Primary key; generated with `cuid()`. |
| `courseId` | `String` | No | Foreign key to the course whose history is recorded. |
| `actorId` | `String` | Yes | Optional foreign key to the acting user; nullable to preserve history if an actor is removed. |
| `type` | `ActivityType` | No | Constrained activity event type. |
| `details` | `Json` | Yes | Optional structured event details. |
| `createdAt` | `DateTime` | No | Event timestamp; defaults to `now()`. |

The application writes activity records for required course, lesson, lifecycle, enrollment, progress,
and comment events. There are no application routes to edit or delete them.

### `CourseActivity`

| Column | Prisma type | Nullable | Purpose and defaults |
|---|---|---:|---|
| `id` | `String` | No | Primary key; generated with `cuid()`. |
| `learnerId` | `String` | No | Foreign key to the learner. |
| `courseId` | `String` | No | Foreign key to the course. |
| `lastProgressAt` | `DateTime` | No | Most recent real lesson-progress activity timestamp. |
| `createdAt` | `DateTime` | No | Creation timestamp; defaults to `now()`. |
| `updatedAt` | `DateTime` | No | Update timestamp; maintained with `@updatedAt`. |

There are unique constraints on both `(courseId, learnerId)` and `(learnerId, courseId)`, plus an
index on `(courseId, lastProgressAt)`. The duplicate-order unique constraints are present in the
Prisma schema because this model participates in compound relationships using both field orders.

### `AlertDismissal`

| Column | Prisma type | Nullable | Purpose and defaults |
|---|---|---:|---|
| `id` | `String` | No | Primary key; generated with `cuid()`. |
| `courseId` | `String` | No | Foreign key to the course. |
| `learnerId` | `String` | No | Foreign key to the learner. |
| `dismissedAt` | `DateTime` | No | Dismissal timestamp; defaults to `now()`. |

`(courseId, learnerId)` is unique and is also the compound reference to `CourseActivity`.

## Relationships

The schema contains ordinary one-to-many relationships and two explicit association models. It does
not use implicit Prisma many-to-many relations.

### One-to-many relationships

```text
User 1 ─────── * Course                 (Course.instructorId)
User 1 ─────── * Enrollment              (Enrollment.learnerId)
Course 1 ───── * Enrollment              (Enrollment.courseId)
Course 1 ───── * Lesson                  (Lesson.courseId)
Enrollment 1 ─ * LessonProgress          (LessonProgress.enrollmentId)
Lesson 1 ───── * LessonProgress          (LessonProgress.lessonId)
Course 1 ───── * Comment                 (Comment.courseId)
User 1 ─────── * Comment                 (Comment.authorId)
Course 1 ───── * ActivityLog             (ActivityLog.courseId)
User 1 ─────── * ActivityLog             (ActivityLog.actorId, optional)
User 1 ─────── * CourseActivity           (CourseActivity.learnerId)
Course 1 ───── * CourseActivity           (CourseActivity.courseId)
User 1 ─────── * AlertDismissal           (AlertDismissal.learnerId)
Course 1 ───── * AlertDismissal           (AlertDismissal.courseId)
```

`ActivityLog.actorId` is optional, so an activity record can remain after its actor is removed.

### Explicit many-to-many relationships

```text
User (learner) * ───── * Course
                    via Enrollment

Enrollment * ───── * Lesson
                    via LessonProgress
```

The learner-course relationship is conceptually many-to-many, with `Enrollment` carrying membership,
enrollment time, completion state, and completion time. Enrollment is explicit because it is a domain
record, not just a join table.

`LessonProgress` also links enrollments and lessons many-to-many in relational terms, but its meaning
is a fact about a particular learner's progress through a particular lesson. It therefore stores
server timestamps and has its own uniqueness constraint instead of being an implicit join.

### One-to-one relationships

- An `Enrollment` has zero or one `CourseActivity` row. `CourseActivity.enrollment` is required and
  uses the compound `(learnerId, courseId)` reference; its `onDelete: Cascade` removes activity when
  the matching enrollment is deleted.
- A `CourseActivity` has zero or one `AlertDismissal` row, while an `AlertDismissal.activity` is
  required. The compound `(courseId, learnerId)` reference connects the dismissal to the activity
  row, and dismissal is not a separate alert instance.

## Database constraints vs application rules

### Database-enforced invariants

PostgreSQL, through the Prisma schema and migrations, enforces:

- `cuid()` primary keys for every model.
- Foreign-key references between users, courses, lessons, enrollments, progress, comments, activity,
  and dismissal records.
- Enum values for `Role`, `CourseStatus`, `EnrollmentProgressState`, and `ActivityType`.
- Unique `User.email`.
- Unique `(learnerId, courseId)` enrollment membership.
- Unique `(enrollmentId, lessonId)` lesson-progress facts.
- Unique `(courseId, position)` lesson ordering.
- Unique `(courseId, learnerId)` and `(learnerId, courseId)` on `CourseActivity`.
- Unique `(courseId, learnerId)` alert dismissal.
- Foreign-key deletion actions: `Restrict` for historical course/user relationships, `Cascade` from
  enrollment or lesson to `LessonProgress`, `Cascade` from enrollment to its `CourseActivity`,
  `Cascade` from `CourseActivity` to `AlertDismissal`, and `SetNull` from `ActivityLog.actor`.

Declared indexes are:

- `Course(instructorId)`, `Course(status)`, and `Course(category)`.
- `Lesson(courseId)`.
- `Enrollment(courseId)`.
- `LessonProgress(lessonId)`.
- `Comment(courseId)`.
- `ActivityLog(courseId, createdAt)`.
- `CourseActivity(courseId, lastProgressAt)`.
- `AlertDismissal(learnerId)`.

These belong in the database because they prevent invalid references and duplicate relationships even
when requests race, and provide the final integrity boundary below application code.

### Application/service-enforced rules

The service and route layers enforce rules that depend on authentication context, workflow, or
multiple records:

- Trim/lowercase email normalization and Argon2id password hashing.
- Authentication, role checks, instructor ownership, and learner enrollment authorization.
- Learner visibility of published courses and instructor-scoped course lists.
- The lifecycle graph `DRAFT → PUBLISHED → ARCHIVED → PUBLISHED`, including the lesson requirement
  before publishing and separation from generic metadata updates.
- Lesson ownership, append/reorder/delete rules, and contiguous ordering operations.
- Progress transitions and timestamp behavior: a learner must start before completing a lesson, and
  client-provided state/timestamps are not accepted.
- Course progress calculation from current lessons and progress facts.
- Comment eligibility, content limits, and server-derived authorship.
- Instructor-controlled enrollment into owned published courses.
- CSV parsing/size/row validation, pasted-email normalization, and independent per-row processing.
- Activity-log immutability and inactivity-alert eligibility, including dismissal/re-alert behavior.

These rules belong in application code because they use the current user, course status, relationships,
transactional workflow, or calculations across records; they are not static properties of one row.

## Deliberate denormalisation

I deliberately keep one `CourseActivity` row per learner/course with `lastProgressAt`. The detailed
lesson facts remain normalized in `LessonProgress`, where each row belongs to one enrollment and one
lesson. `CourseActivity` is a query-oriented read optimization: inactivity lookup can inspect one
current timestamp per learner/course instead of repeatedly aggregating all lesson-progress timestamps.
It is updated transactionally with real lesson-progress transitions and is not the source of truth for
whether an individual lesson or course is complete.

`Enrollment.progressState` and `Enrollment.completedAt` are also service-maintained summary fields for
course-level queries and dashboard metrics. The service recalculates them from the current lessons and
progress facts; they do not replace those facts.

I deliberately did not persist completed lesson count, total lesson count, completion percentage,
or an enrollment-count column on `Course`. Those values are derived from current lessons and
relationships. I also did not add individual `Alert` rows: alert eligibility is computed from
`CourseActivity` and `AlertDismissal`.

## Progress data model

The progress representation is timestamp-derived:

```text
No LessonProgress row                         = NOT_STARTED
startedAt present, completedAt absent        = IN_PROGRESS
completedAt present                          = COMPLETED
```

The service enforces `NOT_STARTED → IN_PROGRESS → COMPLETED`; a direct completion request for a
not-started enrollment is rejected. Course-level state and percentage use the current course lessons
and their progress facts. Because `Lesson.id`, not `position`, identifies progress, reordering does
not remap records. Deleting a lesson removes only its progress through the foreign-key cascade, and a
new lesson naturally has no progress row and starts as `NOT_STARTED`.

## Referential integrity and deletion behavior

- Deleting a lesson cascades only its related `LessonProgress` rows.
- Deleting an enrollment cascades its lesson-progress rows and its matching `CourseActivity` row;
  the associated `AlertDismissal` is then removed through the activity relationship.
- Course, user, comment, activity, and alert historical relationships use `Restrict` where declared,
  so hard deletion cannot silently erase history or dependent records.
- `ActivityLog.actor` uses `SetNull`, allowing the event to remain while removing only the optional
  actor reference.
- Hard deletion of courses or users is not an application feature; lifecycle archive/restore is used
  to preserve course records and learning history.

These choices preserve the audit trail, comments, enrollments, and progress facts. They also make
lesson deletion safe without allowing a course's historical record to disappear through a cascade.

## Indexes and query patterns

The declared indexes support the current access patterns:

| Index | Query it supports |
|---|---|
| `Course(instructorId)` | Instructor-owned course lists and ownership lookups. |
| `Course(status)` | Published catalogue visibility and lifecycle/status filtering. |
| `Course(category)` | Category filtering. |
| `Lesson(courseId)` | Ordered lesson retrieval and course lesson ownership checks. |
| `Enrollment(courseId)` | Instructor enrollment lists and course enrollment counts/lookups. |
| `LessonProgress(lessonId)` | Progress rows associated with a lesson, including deletion cascades. |
| `Comment(courseId)` | Course discussion retrieval. |
| `ActivityLog(courseId, createdAt)` | Course history ordered by creation time. |
| `CourseActivity(courseId, lastProgressAt)` | Course-scoped inactivity lookup by progress timestamp. |
| `AlertDismissal(learnerId)` | Learner-scoped dismissal lookups. |

Compound unique constraints also provide ordered indexes, but only their leftmost prefixes are
independently useful for prefix lookups. For example, `Enrollment(learnerId, courseId)` supports a
learner-first lookup, while the separate `Enrollment(courseId)` index supports course-first access.
Likewise, `LessonProgress(enrollmentId, lessonId)` supports enrollment-first lookup and the separate
`LessonProgress(lessonId)` index supports lesson-first lookup. `CourseActivity` has both compound
orders because both course/learner and learner/course relationship lookups are used.

The current text search uses case-insensitive `contains` predicates and enrollment-count sorting uses
relation counts. No dedicated full-text search index or denormalized enrollment counter was added for
this take-home scale; those are candidates only if measured query plans justify them.

## What would break first at 100x the data?

The likely pressure points are query cost and instance scaling, not an assumed immediate PostgreSQL
failure.

### Catalogue queries

Catalogue requests combine published visibility, text search, category and instructor filters,
sorting, relation-derived enrollment counts, and pagination. At 100x the data, case-insensitive
contains search and enrollment-count sorting are likely to need query-plan inspection first. Targeted
indexes, specialized search, or a different count strategy may become worthwhile, but the current
implementation is not claimed to be broken at that scale.

### ActivityLog growth

`ActivityLog` is append-only and indexed by course and creation time. At 100x the activity volume, the
table and index would grow substantially. Retention or archival policy, partitioning, and additional
index review could become necessary depending on history requirements.

### Inactivity and activity queries

`CourseActivity` already reduces inactivity lookup cost to one current row per learner/course instead
of an aggregation over every lesson-progress fact. At 100x, PostgreSQL query plans, timestamp/index
selectivity, alert joins, and dashboard activity queries would still need monitoring.

### Session storage

This is an application-instance scaling limit rather than a database-row limit. The current
`express-session` MemoryStore keeps sessions in one backend process, so instances cannot share session
state and a restart loses active sessions. It is suitable for the current single-instance/demo
arrangement, but a persistent shared session store is required before horizontal scaling.

### Database connection and query load

More traffic would increase connection usage, query latency, and contention around serializable lesson,
lifecycle, and progress transactions. I would measure those effects rather than assume a bottleneck or
choose fixed capacity numbers without evidence.

The first step at 100x would be measurement rather than speculative schema changes: inspect PostgreSQL
query plans and latency for catalogue, activity, dashboard, and transactional progress queries, then
add targeted indexes, partitioning, or search infrastructure only where measurements justify them.

# Decisions

## 1. Course lifecycle is an enum, not deletion

- **Chose:** `DRAFT`, `PUBLISHED`, and `ARCHIVED` `CourseStatus` values.
- **Rejected:** Removing courses from the catalogue by hard deletion or free-form status text.
- **Why:** Archive must preserve lessons, enrollments, progress, comments, and history.

## 2. Lesson ID and display position are independent

- **Chose:** Permanent lesson ID plus a mutable, per-course unique `position`.
- **Rejected:** Using order/index as identity or allowing duplicate positions.
- **Why:** Reordering does not alter progress identity. The future reorder transaction uses temporary positions to satisfy the unique key safely.

## 3. Lesson state comes from timestamps

- **Chose:** `startedAt` and `completedAt` without a LessonProgress status enum.
- **Rejected:** A redundant mutable lesson-status field.
- **Why:** It prevents contradictory state and preserves the actual progress facts.

## 4. Enrollment stores queryable course state, derived by the server

- **Chose:** `Enrollment.progressState`, `completedAt`, and `updatedAt`; service code will derive and transition them from current lessons/progress.
- **Rejected:** Client-controlled progress state or stored percentage/counts.
- **Why:** Course state is useful for queries, but lesson changes must be reflected from the true progress source.

## 5. Enrollment and lesson-progress uniqueness are database rules

- **Chose:** unique `(learnerId, courseId)` and `(enrollmentId, lessonId)` constraints.
- **Rejected:** Client-only or pre-query-only duplicate checks.
- **Why:** Database constraints remain correct under concurrency.

## 6. Course-level comments only

- **Chose:** `Comment.courseId` and `authorId` with no lesson reference.
- **Rejected:** Lesson discussion threads and a made-up 50-word rule.
- **Why:** This matches the required scope; authorization belongs in the service layer.

## 7. Activity is preserved, not cascaded away

- **Chose:** Restrict course deletion and set a deleted activity actor to null; `ActivityLog.details` is optional JSON.
- **Rejected:** Cascading course/activity deletion or many speculative event tables.
- **Why:** Course history is immutable and important, while a compact event enum remains extendable.

## 8. Alerts are computed, dismissals persist

- **Chose:** One `AlertDismissal` per course/learner, but no `Alert` table and no `CourseVisit` table.
- **Rejected:** Permanently suppressing alerts, storing every alert instance, or treating a visit as progress.
- **Why:** Comparing dismissal and progress timestamps allows a later inactivity period to reappear correctly.

## 9. Authorization is based on relationships and server identity

- **Chose:** Explicit instructor/course, learner/enrollment, lesson/course, and progress/enrollment foreign keys.
- **Rejected:** Trusting IDs, roles, or ownership supplied by the frontend.
- **Why:** Later services can scope every access to the authenticated user and prevent cross-instructor/cross-learner access.

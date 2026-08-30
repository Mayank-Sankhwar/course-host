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

## 10. Argon2id hashes passwords

- **Chose:** `argon2` using Argon2id for `User.passwordHash`.
- **Rejected:** Plaintext/reversible passwords and bcrypt without a compatibility need.
- **Why:** Argon2id is a current password-hashing algorithm and runs successfully with the project’s Node.js setup.

## 11. Cookie sessions carry server-established identity

- **Chose:** Signed, HTTP-only `express-session` cookies with a server-side session containing only user ID; authentication reloads the user from the repository.
- **Rejected:** JWT/localStorage tokens and client-held role/user identity.
- **Why:** Browser JavaScript cannot read the cookie, and each protected request obtains current server-side role data. MemoryStore is documented as development-only.

## 12. Public signup creates learners only

- **Chose:** `/api/auth/signup` accepts only `LEARNER`; an attempted `INSTRUCTOR` role is rejected.
- **Rejected:** Unrestricted public instructor registration.
- **Why:** A client-selected instructor role would be privilege escalation. Instructor accounts must be provisioned through a controlled future operational path.

## 13. Authentication and authorization use different status codes

- **Chose:** 401 for missing/invalid session and 403 for an authenticated role mismatch.
- **Rejected:** Returning 403 for every denied request or trusting frontend route state.
- **Why:** Clients can distinguish login needs from permission limits without exposing passwords, hashes, or internals.

## 14. Credentialed CORS is explicit

- **Chose:** Configure one `CLIENT_ORIGIN` with credentials and production-only secure cookies.
- **Rejected:** `Access-Control-Allow-Origin: *` with cookies or hard-coded deployment URLs.
- **Why:** Cookies require a deliberate browser trust boundary that works for local development and configurable deployments.

## 15. New courses are always drafts

- **Chose:** The server explicitly writes `DRAFT` on creation and rejects request fields other than title, description, and category.
- **Rejected:** Letting the client choose `PUBLISHED`/`ARCHIVED` or silently trusting a status field.
- **Why:** Publishing requires lesson validation in a later phase; creation cannot bypass that lifecycle rule.

## 16. Course ownership is enforced per request

- **Chose:** Derive `instructorId` from authenticated identity, scope list queries by it, and return 403 when another instructor accesses a known course.
- **Rejected:** Request-body/query ownership IDs or frontend-only filtering.
- **Why:** It prevents cross-instructor access while still distinguishing a genuinely missing course (404) from an ownership violation (403).

## 17. Metadata edits preserve lifecycle status

- **Chose:** `PATCH` permits only title, description, and category; it rejects status/instructor/id fields.
- **Rejected:** Combining edits with status transitions.
- **Why:** Editing published or archived metadata must not silently alter lifecycle state.

## 18. Instructor lists are database-paginated and deterministic

- **Chose:** Prisma-filtered queries with bounded page size, total count, stable ID secondary order, and a `title`/`createdAt` sort whitelist.
- **Rejected:** Browser-side filtering/pagination or arbitrary `orderBy` query values.
- **Why:** Ownership stays server-enforced and pagination remains stable. Enrollment-count sorting is deferred until enrollment data exists.

## 19. Development instructors are explicitly seeded

- **Chose:** A manually invoked, idempotent Prisma seed upserts two local-development instructors.
- **Rejected:** Public instructor signup or automatically creating privileged users when the server starts.
- **Why:** Public signup remains learner-only to prevent privilege escalation; the seed is an explicit, development-only route to create repeatable API/demo accounts.

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

## 20. Lesson identity is permanent; position is ordering only

- **Chose:** Keep the existing permanent `Lesson.id` and update only `position` for reorder.
- **Rejected:** Recreating lessons, using array index as identity, or treating position as a progress key.
- **Why:** Future lesson progress references lesson IDs and must survive content edits, deletion of other lessons, and reordering.

## 21. New lessons append; metadata updates cannot reorder

- **Chose:** Create at next position and allow only title/content through normal lesson updates.
- **Rejected:** Client-selected creation positions or accepting position/course/ID changes in metadata requests.
- **Why:** It keeps ordering predictable and reserves all position changes for a fully validated reorder operation.

## 22. A course cannot lose its final lesson

- **Chose:** Server-side deletion rejects the final lesson; otherwise deletion normalizes positions to `1..N`.
- **Rejected:** Frontend-only disablement, leaving ordering gaps, or allowing an empty formerly populated course.
- **Why:** The course remains structurally usable and the invariant holds regardless of client behavior.

## 23. Reorder receives the complete lesson ID set

- **Chose:** The API accepts a complete ordered `lessonIds` array and verifies it exactly matches the course's current IDs.
- **Rejected:** Individual untrusted position updates or partial reorder payloads.
- **Why:** It rejects missing, duplicate, extra, and foreign-course IDs before positions change.

## 24. Delete and reorder are serializable transactions

- **Chose:** Temporarily move affected positions above the current maximum, then assign contiguous final positions inside a serializable Prisma transaction with retry for transactional conflicts.
- **Rejected:** Independent updates that can transiently violate unique `(courseId, position)`.
- **Why:** Partial failure cannot leave duplicate/gapped final order, and lesson IDs/progress links remain untouched during reorder.

## 25. Lifecycle changes use explicit commands, not `PATCH`

- **Chose:** Instructor-only `publish`, `archive`, and `restore` commands with server-checked expected states.
- **Rejected:** Accepting arbitrary course-status values in generic metadata updates.
- **Why:** The lifecycle has a small allowed graph and must not be bypassed by browser-provided status fields.

## 26. Publishing requires an existing lesson at transition time

- **Chose:** Count lessons inside the serializable publish transaction and reject an empty course with a conflict.
- **Rejected:** A frontend-only check or publishing first and validating later.
- **Why:** Concurrent browser requests cannot publish an empty draft, and the database state remains the authority.

## 27. Archival preserves course records and learning history

- **Chose:** Archive/restore update only `Course.status`.
- **Rejected:** Deleting, recreating, or mutating lessons, enrollments, or lesson progress during lifecycle transitions.
- **Why:** Existing learners retain their data and a restored course resumes with stable lesson identities and ordering.

## 28. Learner catalogue visibility is a server query rule

- **Chose:** The future learner catalogue will query only `PUBLISHED` courses before filtering, sorting, counting, and paginating.
- **Rejected:** Sending all lifecycle states to the browser and hiding them client-side.
- **Why:** Draft and archived material must never become visible through a manipulated client request.

## 29. Learners self-enroll only into currently published courses

- **Chose:** The learner endpoint derives the learner from the session and checks `Course.status` at enrollment time.
- **Rejected:** Accepting a body `learnerId`, allowing draft/archive enrollment, or trusting the browser's view of course status.
- **Why:** A known course ID must not allow cross-user enrollment or enrollment into unavailable material.

## 30. Progress is a timestamp fact, not a client-set state

- **Chose:** Start and complete commands write server timestamps; missing progress is `NOT_STARTED`, started-only is `IN_PROGRESS`, and completed is `COMPLETED`.
- **Rejected:** A mutable request-body status/timestamp or a second lesson-state column.
- **Why:** The storage model cannot contradict the derived state and completed lessons never regress when reopened.

## 31. Learner progress is scoped by enrollment and stable lesson ID

- **Chose:** Every learner progress read/write first resolves the session learner's enrollment and verifies the lesson belongs to that course.
- **Rejected:** Enrollment IDs or lesson positions supplied by the client as authorization.
- **Why:** It prevents learner IDOR attacks and keeps reorder independent from progress identity.

## 32. Course progress is calculated from current lessons

- **Chose:** Calculate completed/total/percentage and state from the current course lessons plus their `LessonProgress` rows.
- **Rejected:** Persisted percentages, array-index matching, or creating rows for every not-started lesson.
- **Why:** Adding a lesson naturally reduces a formerly complete course; deleting a lesson's cascaded progress no longer affects the result.

## 33. The learner catalogue has one extended route

- **Chose:** Extend authenticated learner `GET /api/available-courses` into the full catalogue.
- **Rejected:** Adding another competing learner-catalogue endpoint.
- **Why:** The existing route already represented published courses, so it is the clearest stable API contract.

## 34. Catalogue visibility is enforced before user filters

- **Chose:** Learner queries always include database `status = PUBLISHED`; instructor queries always include session-derived ownership.
- **Rejected:** React-side hiding or treating `instructorId`/`status` as authorization input.
- **Why:** Query parameters are filters, not proof of permission, so they cannot expose drafts, archives, or another instructor's data.

## 35. Catalogue work remains server-side and bounded

- **Chose:** Prisma `where`, `orderBy`, `skip`, `take`, and `count`, with maximum page size 50.
- **Rejected:** Downloading all courses and using browser `filter`, `sort`, or `slice`.
- **Why:** Filtered totals and page boundaries remain correct and the browser receives only the requested page.

## 36. Enrollment count is relation-derived and sortable

- **Chose:** Use Prisma's `Enrollment` relation `_count` for response values and PostgreSQL relation-count ordering.
- **Rejected:** Fetching enrollments to count in JavaScript or adding a denormalized counter column.
- **Why:** Enrollment remains the source of truth without stale counters or unnecessary schema maintenance.

## 37. Catalogue ordering has deterministic ties

- **Chose:** Default `createdAt DESC, id DESC`; title, creation date, and enrollment-count sorts use `id DESC` as a secondary key.
- **Rejected:** Single-column ordering with unstable page boundaries.
- **Why:** Pagination does not duplicate or omit equal-valued records between requests.

## 38. Comments are course-level and retained

- **Chose:** Use existing `Comment(courseId, authorId, content)` without a lesson foreign key.
- **Rejected:** Per-lesson comment threads or deleting discussion when a course is archived.
- **Why:** The assignment defines one course discussion, while archive/restore must preserve history.

## 39. Discussion participation is relationship-authorized

- **Chose:** Permit enrolled learners on published courses and the owning instructor; derive author identity from the session.
- **Rejected:** Request-body author IDs, client role checks, or unrelated instructor/learner access.
- **Why:** Course ID knowledge alone cannot expose discussion or create an impersonated comment.

## 40. Comment text uses a deterministic server word limit

- **Chose:** Trim text and count non-empty whitespace-separated tokens, with a 50-word and 2,000-character server limit.
- **Rejected:** HTML-only validation, NLP word parsing, or silent truncation.
- **Why:** The result is simple, predictable, and enforced for every client.

## 41. Archived discussion is read-preserved but write-stopped

- **Chose:** Preserve all comment rows; reject all new comments while archived. Learner reads are blocked with course access, while the owner can review the historic discussion.
- **Rejected:** Deleting comments, letting active discussion continue, or recreating history on restore.
- **Why:** It preserves history and matches archived learner-content access without losing instructor context.

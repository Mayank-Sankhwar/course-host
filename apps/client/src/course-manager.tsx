import { FormEvent, useEffect, useState } from "react";
import { courseApi, type Course, type CourseListQuery } from "./course-api";
import { LessonManager } from "./lesson-manager";
import { CourseDiscussion } from "./course-discussion";
import { EnrollmentManager } from "./enrollment-manager";
import { ActivityManager } from "./activity-manager";

const emptyCourse = { title: "", description: "", category: "" };
type DetailTab =
  "metadata" | "lessons" | "learners" | "activity" | "discussion";
const statusClass = (status: string) =>
  `status-badge status-${status.toLowerCase().replaceAll("_", "-")}`;

export function CourseManager({
  instructor,
  initialActivity = false,
}: {
  instructor: { id: string; email: string };
  initialActivity?: boolean;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState(emptyCourse);
  const [selected, setSelected] = useState<Course | null>(null);
  const [tab, setTab] = useState<DetailTab>(
    initialActivity ? "activity" : "metadata",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<CourseListQuery["status"]>("");
  const [instructorId, setInstructorId] = useState("");
  const [sort, setSort] = useState<CourseListQuery["sort"]>("createdAt");
  const [direction, setDirection] =
    useState<CourseListQuery["direction"]>("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [catalogue, setCatalogue] = useState({ total: 0, totalPages: 0 });
  async function loadCourses() {
    setLoading(true);
    setError(null);
    try {
      const response = await courseApi.list({
        search,
        category,
        status,
        instructorId,
        sort,
        direction,
        page,
        limit,
      });
      setCourses(response.courses);
      setCatalogue({ total: response.total, totalPages: response.totalPages });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load courses.",
      );
      setCourses([]);
      setCatalogue({ total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadCourses();
  }, [search, category, status, instructorId, sort, direction, page, limit]);
  function resetPage(update: () => void) {
    update();
    setPage(1);
  }
  function resetFilters() {
    setSearch("");
    setCategory("");
    setStatus("");
    setInstructorId("");
    setSort("createdAt");
    setDirection("desc");
    setPage(1);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const response = selected
        ? await courseApi.update(selected.id, form)
        : await courseApi.create(form);
      setSelected(response.course);
      setForm({
        title: response.course.title,
        description: response.course.description,
        category: response.course.category,
      });
      await loadCourses();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save course.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function transition(action: "publish" | "archive" | "restore") {
    if (!selected) return;
    setError(null);
    setTransitioning(true);
    try {
      const { course } = await courseApi.transition(selected.id, action);
      setSelected(course);
      await loadCourses();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to update course status.",
      );
    } finally {
      setTransitioning(false);
    }
  }
  function open(
    course: Course,
    nextTab: DetailTab = initialActivity ? "activity" : "metadata",
  ) {
    setSelected(course);
    setTab(nextTab);
    setForm({
      title: course.title,
      description: course.description,
      category: course.category,
    });
  }
  if (selected)
    return (
      <section className="card course-detail">
        <div className="course-detail-header">
          <div>
            <button
              className="back-button"
              onClick={() => {
                setSelected(null);
                setForm(emptyCourse);
              }}
            >
              ← All courses
            </button>
            <p className="eyebrow">Course management</p>
            <h2>{selected.title}</h2>
            <p className="course-detail-meta">
              <span>{selected.category}</span>
              <span>
                Created {new Date(selected.createdAt).toLocaleDateString()}
              </span>
            </p>
          </div>
          <div className="course-state">
            <span className={statusClass(selected.status)}>
              {selected.status}
            </span>
            {selected.status === "ARCHIVED" && (
              <p className="archived-note">
                This course is archived. Its lessons, enrollments, and history
                remain preserved.
              </p>
            )}
          </div>
        </div>
        {error && <p role="alert">{error}</p>}
        <nav className="detail-tabs" aria-label="Course management sections">
          {(
            [
              "metadata",
              "lessons",
              "learners",
              "activity",
              "discussion",
            ] as DetailTab[]
          ).map((item) => (
            <button
              key={item}
              aria-current={tab === item ? "page" : undefined}
              onClick={() => setTab(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        {tab === "metadata" && (
          <section className="metadata-panel">
            <div className="section-heading">
              <div>
                <h3>Course metadata</h3>
                <p className="helper-text">
                  Update the information learners see in the course catalogue.
                </p>
              </div>
            </div>
            <form onSubmit={submit}>
              <label>
                Title{" "}
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  required
                  disabled={saving}
                />
              </label>
              <label>
                Description{" "}
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  required
                  disabled={saving}
                />
              </label>
              <label>
                Category{" "}
                <input
                  value={form.category}
                  onChange={(event) =>
                    setForm({ ...form, category: event.target.value })
                  }
                  required
                  disabled={saving}
                />
              </label>
              <button type="submit" disabled={saving}>
                {saving ? "Saving metadata…" : "Save metadata"}
              </button>
            </form>
            <div className="lifecycle-actions">
              <div>
                <h4>Course lifecycle</h4>
                <p className="helper-text">
                  Status changes preserve existing course data and learner
                  history.
                </p>
              </div>
              <div className="actions">
                {selected.status === "DRAFT" && (
                  <button
                    className="button-primary"
                    disabled={transitioning}
                    onClick={() => void transition("publish")}
                  >
                    {transitioning ? "Publishing…" : "Publish"}
                  </button>
                )}
                {selected.status === "PUBLISHED" && (
                  <button
                    className="danger"
                    disabled={transitioning}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Archive this course? Enrollments and progress will be preserved.",
                        )
                      )
                        void transition("archive");
                    }}
                  >
                    {transitioning ? "Archiving…" : "Archive"}
                  </button>
                )}
                {selected.status === "ARCHIVED" && (
                  <button
                    className="button-primary"
                    disabled={transitioning}
                    onClick={() => void transition("restore")}
                  >
                    {transitioning ? "Restoring…" : "Restore"}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}
        {tab === "lessons" && (
          <LessonManager courseId={selected.id} courseTitle={selected.title} />
        )}
        {tab === "learners" && (
          <EnrollmentManager
            courseId={selected.id}
            courseTitle={selected.title}
          />
        )}
        {tab === "activity" && (
          <ActivityManager
            courseId={selected.id}
            courseTitle={selected.title}
          />
        )}
        {tab === "discussion" && <CourseDiscussion courseId={selected.id} />}
      </section>
    );
  const filtersActive = Boolean(
    search ||
    category ||
    status ||
    instructorId ||
    sort !== "createdAt" ||
    direction !== "desc",
  );
  const categories = [
    ...new Set([category, ...courses.map((course) => course.category)].filter(Boolean)),
  ].sort();
  return (
    <section className="card">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Instructor workspace</p>
          <h2>Courses</h2>
          <p>Manage your course library, lessons, learners, and activity.</p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="subsection create-course-panel">
        <div>
          <h3>Create course</h3>
          <p className="helper-text">
            Start with a draft, then add lessons before publishing.
          </p>
        </div>
        <form onSubmit={submit}>
          <label>
            Title{" "}
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              required
              disabled={saving}
            />
          </label>
          <label>
            Description{" "}
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              required
              disabled={saving}
            />
          </label>
          <label>
            Category{" "}
            <input
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
              required
              disabled={saving}
            />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? "Creating course…" : "Create draft course"}
          </button>
        </form>
      </div>
      <form
        className="catalogue-filters"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="search-field">
          Search courses{" "}
          <input
            placeholder="Search by title or description"
            value={search}
            onChange={(event) => resetPage(() => setSearch(event.target.value))}
          />
        </label>
        <label>
          Category{" "}
          <select
            value={category}
            onChange={(event) =>
              resetPage(() => setCategory(event.target.value))
            }
          >
            <option value="">Any category</option>
            {categories.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status{" "}
          <select
            value={status}
            onChange={(event) =>
              resetPage(() =>
                setStatus(event.target.value as CourseListQuery["status"]),
              )
            }
          >
            <option value="">Any status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <label>
          Instructor{" "}
          <select
            value={instructorId}
            onChange={(event) =>
              resetPage(() => setInstructorId(event.target.value))
            }
          >
            <option value="">Any instructor</option>
            <option value={instructor.id}>{instructor.email} (you)</option>
          </select>
        </label>
        <label>
          Sort by{" "}
          <select
            value={sort}
            onChange={(event) =>
              resetPage(() =>
                setSort(event.target.value as CourseListQuery["sort"]),
              )
            }
          >
            <option value="createdAt">Creation date</option>
            <option value="title">Title</option>
            <option value="enrollmentCount">Enrollment count</option>
          </select>
        </label>
        <label>
          Order{" "}
          <select
            value={direction}
            onChange={(event) =>
              resetPage(() =>
                setDirection(
                  event.target.value as CourseListQuery["direction"],
                ),
              )
            }
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </label>
        <label>
          Page size{" "}
          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </label>
        {filtersActive && (
          <button className="filter-reset" type="button" onClick={resetFilters}>
            Reset filters
          </button>
        )}
      </form>
      <div className="catalogue-summary">
        <p className="helper-text">
          {catalogue.total} matching{" "}
          {catalogue.total === 1 ? "course" : "courses"}
        </p>
      </div>
      {loading ? (
        <p className="loading-state">Loading your courses…</p>
      ) : courses.length === 0 ? (
        <>
          <p className="empty">No courses found.</p>
          <div className="pagination" aria-label="Course catalogue pagination">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1}>
              Previous
            </button>
            <span>
              Page <strong>{page}</strong> of{" "}
              <strong>{catalogue.totalPages}</strong>
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={
                page >= catalogue.totalPages || catalogue.totalPages === 0
              }
            >
              Next
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="course-list instructor-course-list">
            {courses.map((course) => (
              <article className="course-card" key={course.id}>
                <div className="course-card-header">
                  <strong>{course.title}</strong>
                  <span className={statusClass(course.status)}>
                    {course.status}
                  </span>
                </div>
                <p>{course.description}</p>
                <p className="meta">
                  {course.category} <span>·</span> created{" "}
                  {new Date(course.createdAt).toLocaleDateString()}
                  {course.enrollmentCount === undefined
                    ? ""
                    : ` · ${course.enrollmentCount} enrollments`}
                </p>
                <div className="actions">
                  <button
                    className="button-primary"
                    onClick={() => open(course)}
                  >
                    Manage course
                  </button>
                  <button onClick={() => open(course)}>Edit metadata</button>
                </div>
              </article>
            ))}
          </div>
          <div className="pagination" aria-label="Course catalogue pagination">
            <button onClick={() => setPage(page - 1)} disabled={page <= 1}>
              Previous
            </button>
            <span>
              Page <strong>{page}</strong> of{" "}
              <strong>{catalogue.totalPages}</strong>
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={
                page >= catalogue.totalPages || catalogue.totalPages === 0
              }
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}

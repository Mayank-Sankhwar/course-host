import { FormEvent, useEffect, useState } from 'react';
import { learnerApi, type CourseProgress, type LearnerCourse, type LearnerLesson } from './learner-api';
import { CourseDiscussion } from './course-discussion';

type EnrolledCourse = { enrollment: { id: string; courseId: string }; course: LearnerCourse; progress: CourseProgress };
const statusClass = (status: string) => `status-badge status-${status.toLowerCase().replaceAll('_', '-')}`;
const readableStatus = (status: string) => status.replaceAll('_', ' ');

export function LearnerManager({ initialView }: { initialView: 'catalogue' | 'my-courses' }) {
  const [available, setAvailable] = useState<LearnerCourse[]>([]);
  const [enrolled, setEnrolled] = useState<EnrolledCourse[]>([]);
  const [selected, setSelected] = useState<EnrolledCourse | null>(null);
  const [blockedCourse, setBlockedCourse] = useState<EnrolledCourse | null>(null);
  const [lessons, setLessons] = useState<LearnerLesson[]>([]);
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null);
  const [currentLesson, setCurrentLesson] = useState<LearnerLesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(''); const [category, setCategory] = useState(''); const [instructorId, setInstructorId] = useState('');
  const [sort, setSort] = useState<'title' | 'createdAt' | 'enrollmentCount'>('createdAt'); const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1); const [limit, setLimit] = useState(10); const [catalogue, setCatalogue] = useState({ total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true); const [enrolling, setEnrolling] = useState<string | null>(null); const [opening, setOpening] = useState<string | null>(null); const [lessonAction, setLessonAction] = useState<string | null>(null);

  function clearSelected() { setSelected(null); setBlockedCourse(null); setLessons([]); setCourseProgress(null); setCurrentLesson(null); }
  function showArchivedCourse(course: EnrolledCourse) { setBlockedCourse(course); setSelected(null); setLessons([]); setCourseProgress(null); setCurrentLesson(null); }

  async function loadLists() {
    setLoading(true);
    try {
      const [availableResponse, enrolledResponse] = await Promise.all([
        learnerApi.availableCourses({ search, category, instructorId, sort, direction, page, limit }), learnerApi.enrolledCourses()
      ]);
      setAvailable(availableResponse.courses); setEnrolled(enrolledResponse.courses); setCatalogue({ total: availableResponse.total, totalPages: availableResponse.totalPages });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load learner courses.'); setAvailable([]); setCatalogue({ total: 0, totalPages: 0 });
    } finally { setLoading(false); }
  }
  useEffect(() => { void loadLists(); }, [search, category, instructorId, sort, direction, page, limit]);
  function resetPage(update: () => void) { update(); setPage(1); }
  function preventSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); }
  function resetFilters() { setSearch(''); setCategory(''); setInstructorId(''); setSort('createdAt'); setDirection('desc'); setPage(1); }

  async function enroll(courseId: string) {
    setError(null); setEnrolling(courseId);
    try { await learnerApi.enroll(courseId); await loadLists(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to enroll.'); }
    finally { setEnrolling(null); }
  }
  async function openCourse(course: EnrolledCourse) {
    setError(null); setBlockedCourse(null); setOpening(course.course.id);
    try { const response = await learnerApi.lessons(course.course.id); setSelected(course); setLessons(response.lessons); setCourseProgress(response.courseProgress); setCurrentLesson(null); }
    catch (requestError) { const message = requestError instanceof Error ? requestError.message : 'Unable to open course.'; if (/archived/i.test(message)) showArchivedCourse(course); else setError(message); }
    finally { setOpening(null); }
  }
  async function progressAction(lesson: LearnerLesson, action: 'start' | 'complete') {
    if (!selected) return;
    setError(null); setLessonAction(`${lesson.id}-${action}`);
    try {
      await learnerApi.progressAction(selected.course.id, lesson.id, action);
      const [progressResponse] = await Promise.all([learnerApi.progress(selected.course.id), loadLists()]);
      setLessons(progressResponse.lessons); setCourseProgress(progressResponse.courseProgress); setCurrentLesson(progressResponse.lessons.find((item) => item.id === lesson.id) ?? null);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Unable to record lesson progress.';
      if (/archived/i.test(message)) showArchivedCourse(selected); else setError(message);
    } finally { setLessonAction(null); }
  }

  const enrolledCourseIds = new Set(enrolled.map((item) => item.course.id));
  const filtersActive = Boolean(search || category || instructorId || sort !== 'createdAt' || direction !== 'desc');

  if (initialView === 'catalogue') return <section className="card learner-page">
    <div className="page-heading learner-heading"><div><p className="eyebrow">Learning library</p><h2>Course catalogue</h2><p>Explore available courses and start learning at your own pace.</p></div></div>
    {error && <p role="alert">{error}</p>}
    <form className="catalogue-filters" onSubmit={preventSubmit}>
      <label className="search-field">Search courses <input placeholder="Search by title or description" value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} /></label>
      <label>Category <input placeholder="Any category" value={category} onChange={(event) => resetPage(() => setCategory(event.target.value))} /></label>
      <label>Instructor ID <input placeholder="Any instructor" value={instructorId} onChange={(event) => resetPage(() => setInstructorId(event.target.value))} /></label>
      <label>Sort by <select value={sort} onChange={(event) => resetPage(() => setSort(event.target.value as typeof sort))}><option value="createdAt">Creation date</option><option value="title">Title</option><option value="enrollmentCount">Enrollment count</option></select></label>
      <label>Order <select value={direction} onChange={(event) => resetPage(() => setDirection(event.target.value as typeof direction))}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
      <label>Page size <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label>
      {filtersActive && <button className="filter-reset" type="button" onClick={resetFilters}>Reset filters</button>}
    </form>
    <div className="catalogue-summary"><p className="helper-text">{catalogue.total} matching {catalogue.total === 1 ? 'course' : 'courses'}</p></div>
    {loading ? <p className="loading-state">Loading available courses…</p> : <><div className="course-list learner-course-list">{available.map((course) => <article className="course-card learner-course-card" key={course.id}><div className="course-card-header"><span className="course-category">{course.category}</span>{enrolledCourseIds.has(course.id) && <span className="status-badge status-completed">Enrolled</span>}</div><h3>{course.title}</h3><p>{course.description}</p><p className="meta">Instructor: {course.instructor.email} <span>·</span> {course.enrollmentCount} enrollments</p><div className="actions">{!enrolledCourseIds.has(course.id) ? <button className="button-primary" onClick={() => void enroll(course.id)} disabled={enrolling !== null}>{enrolling === course.id ? 'Enrolling…' : 'Enroll'}</button> : <span className="helper-text">Available in My Courses</span>}</div></article>)}</div>{available.length === 0 && <p className="empty">{filtersActive ? 'No courses match these filters. Reset them or try another search.' : 'No courses are available yet. Please check back soon.'}</p>}<div className="pagination" aria-label="Catalogue pagination"><button onClick={() => setPage(page - 1)} disabled={page <= 1}>Previous</button><span>Page <strong>{page}</strong> of <strong>{catalogue.totalPages}</strong></span><button onClick={() => setPage(page + 1)} disabled={page >= catalogue.totalPages || catalogue.totalPages === 0}>Next</button></div></>}</section>;

  return <section className="card learner-page"><div className="page-heading learner-heading"><div><p className="eyebrow">My learning</p><h2>My courses</h2><p>Continue where you left off and track your progress.</p></div></div>{error && <p role="alert">{error}</p>}
    {selected ? <section className="learning-workspace"><div className="learner-course-header"><div><button className="back-button" onClick={clearSelected}>← My courses</button><p className="eyebrow">Learning course</p><h2>{selected.course.title}</h2><p>{selected.course.description}</p><span className="course-category">{selected.course.category}</span></div>{courseProgress && <div className="progress-summary"><span className={statusClass(courseProgress.state)}>{readableStatus(courseProgress.state)}</span><strong>{courseProgress.completionPercentage}%</strong><span className="helper-text">{courseProgress.completedLessons} of {courseProgress.totalLessons} lessons completed</span><div className="progress-track" aria-label={`${courseProgress.completionPercentage}% complete`}><div className="progress-bar" style={{ width: `${courseProgress.completionPercentage}%` }} /></div></div>}</div>
      <div className="learning-layout"><section className="lesson-navigation"><div className="section-heading"><div><h3>Lessons</h3><p className="helper-text">Choose a lesson to begin or continue learning.</p></div></div><ol className="learner-lesson-list">{lessons.map((lesson) => { const active = currentLesson?.id === lesson.id; const isComplete = lesson.progressState === 'COMPLETED'; return <li className={active ? 'is-active' : ''} key={lesson.id}><div className="lesson-index">{String(lesson.position).padStart(2, '0')}</div><div className="learner-lesson-summary"><strong>{lesson.title}</strong><span className={statusClass(lesson.progressState)}>{readableStatus(lesson.progressState)}</span></div><div className="learner-lesson-actions">{!isComplete && <button className={lesson.progressState === 'IN_PROGRESS' ? 'button-primary' : undefined} onClick={() => void progressAction(lesson, lesson.progressState === 'NOT_STARTED' ? 'start' : 'complete')} disabled={lessonAction !== null}>{lessonAction === `${lesson.id}-start` ? 'Starting…' : lessonAction === `${lesson.id}-complete` ? 'Completing…' : lesson.progressState === 'NOT_STARTED' ? 'Start lesson' : 'Mark complete'}</button>}{isComplete && <span className="status-badge status-completed">Completed</span>}</div></li>; })}</ol></section>
        <section className="lesson-content" aria-live="polite">{currentLesson ? <article><div className="section-heading"><div><p className="eyebrow">Lesson {currentLesson.position}</p><h3>{currentLesson.title}</h3></div><span className={statusClass(currentLesson.progressState)}>{readableStatus(currentLesson.progressState)}</span></div><div className="lesson-reading-content">{currentLesson.content}</div></article> : <div className="empty">Select a lesson to read its content and begin tracking progress.</div>}</section></div>
      <div className="learner-discussion"><CourseDiscussion courseId={selected.course.id} /></div>
    </section> : blockedCourse ? <section className="archived-course-notice"><span className="status-badge status-archived">Course archived</span><h3>{blockedCourse.course.title}</h3><p>This course is currently archived and its lessons are unavailable. Your enrollment and learning history are preserved.</p><button className="button-primary" onClick={clearSelected}>Back to My Courses</button></section> : loading ? <p className="loading-state">Loading your courses…</p> : <><div className="course-list learner-enrolled-list">{enrolled.map((item) => <article className="course-card learner-course-card" key={item.enrollment.id}><div className="course-card-header"><span className="course-category">{item.course.category}</span><span className={statusClass(item.progress.state)}>{readableStatus(item.progress.state)}</span></div><h3>{item.course.title}</h3><p>{item.course.description}</p><div className="course-progress-line"><span>{item.progress.completionPercentage}% complete</span><span>{item.progress.completedLessons}/{item.progress.totalLessons} lessons</span></div><div className="progress-track" aria-label={`${item.progress.completionPercentage}% complete`}><div className="progress-bar" style={{ width: `${item.progress.completionPercentage}%` }} /></div><div className="actions"><button className="button-primary" onClick={() => void openCourse(item)} disabled={opening !== null}>{opening === item.course.id ? 'Opening course…' : item.progress.state === 'NOT_STARTED' ? 'Start course' : item.progress.state === 'COMPLETED' ? 'Review course' : 'Continue course'}</button></div></article>)}</div>{enrolled.length === 0 && <p className="empty">You have not enrolled in any courses yet. Visit the catalogue to find a course to begin.</p>}</>}
  </section>;
}

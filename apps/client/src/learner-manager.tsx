import { FormEvent, useEffect, useState } from 'react';
import { learnerApi, type CourseProgress, type LearnerCourse, type LearnerLesson } from './learner-api';
import { CourseDiscussion } from './course-discussion';

type EnrolledCourse = { enrollment: { id: string; courseId: string }; course: LearnerCourse; progress: CourseProgress };

export function LearnerManager({ initialView }: { initialView: 'catalogue' | 'my-courses' }) {
  const [available, setAvailable] = useState<LearnerCourse[]>([]);
  const [enrolled, setEnrolled] = useState<EnrolledCourse[]>([]);
  const [selected, setSelected] = useState<EnrolledCourse | null>(null);
  const [lessons, setLessons] = useState<LearnerLesson[]>([]);
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null);
  const [currentLesson, setCurrentLesson] = useState<LearnerLesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [sort, setSort] = useState<'title' | 'createdAt' | 'enrollmentCount'>('createdAt');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [catalogue, setCatalogue] = useState({ total: 0, totalPages: 0 });

  async function loadLists() {
    try {
      const [availableResponse, enrolledResponse] = await Promise.all([
        learnerApi.availableCourses({ search, category, instructorId, sort, direction, page, limit }),
        learnerApi.enrolledCourses()
      ]);
      setAvailable(availableResponse.courses);
      setEnrolled(enrolledResponse.courses);
      setCatalogue({ total: availableResponse.total, totalPages: availableResponse.totalPages });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load learner courses.');
      setAvailable([]);
      setCatalogue({ total: 0, totalPages: 0 });
    }
  }

  useEffect(() => { void loadLists(); }, [search, category, instructorId, sort, direction, page, limit]);

  function resetPage(update: () => void) {
    update();
    setPage(1);
  }

  function preventSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); }

  async function enroll(courseId: string) {
    setError(null);
    try {
      await learnerApi.enroll(courseId);
      await loadLists();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to enroll.');
    }
  }

  async function openCourse(course: EnrolledCourse) {
    setError(null);
    try {
      const response = await learnerApi.lessons(course.course.id);
      setSelected(course);
      setLessons(response.lessons);
      setCourseProgress(response.courseProgress);
      setCurrentLesson(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to open course.');
    }
  }

  async function progressAction(lessonId: string, action: 'start' | 'complete') {
    if (!selected) return;
    setError(null);
    try {
      await learnerApi.progressAction(selected.course.id, lessonId, action);
      const [progressResponse] = await Promise.all([learnerApi.progress(selected.course.id), loadLists()]);
      setLessons(progressResponse.lessons);
      setCourseProgress(progressResponse.courseProgress);
      setCurrentLesson(progressResponse.lessons.find((lesson) => lesson.id === lessonId) ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to record lesson progress.');
    }
  }

  const enrolledCourseIds = new Set(enrolled.map((item) => item.course.id));
  return <section className="card">
    {initialView === 'catalogue' && <><h2>Available published courses</h2>
    {error && <p role="alert">{error}</p>}
    <form onSubmit={preventSubmit}>
      <label>Search <input value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} /></label>
      <label>Category <input value={category} onChange={(event) => resetPage(() => setCategory(event.target.value))} /></label>
      <label>Instructor ID <input value={instructorId} onChange={(event) => resetPage(() => setInstructorId(event.target.value))} /></label>
      <label>Sort <select value={sort} onChange={(event) => resetPage(() => setSort(event.target.value as typeof sort))}><option value="createdAt">Creation date</option><option value="title">Title</option><option value="enrollmentCount">Enrollment count</option></select></label>
      <label>Order <select value={direction} onChange={(event) => resetPage(() => setDirection(event.target.value as typeof direction))}><option value="desc">Descending</option><option value="asc">Ascending</option></select></label>
      <label>Page size <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label>
    </form>
    <p>{catalogue.total} matching courses</p>
    <ul>{available.map((course) => <li key={course.id}><strong>{course.title}</strong> — {course.category} — Instructor: {course.instructor.email} — {course.enrollmentCount} enrollments {!enrolledCourseIds.has(course.id) ? <button onClick={() => void enroll(course.id)}>Enroll</button> : 'Already enrolled'}</li>)}</ul>
    {available.length === 0 && <p className="empty">No courses found.</p>}<button onClick={() => setPage(page - 1)} disabled={page <= 1}>Previous page</button> <span>Page {page} of {catalogue.totalPages}</span> <button onClick={() => setPage(page + 1)} disabled={page >= catalogue.totalPages}>Next page</button></>}
    {initialView === 'my-courses' && <><h2>My courses</h2>
    <ul>{enrolled.map((item) => <li key={item.enrollment.id}><strong>{item.course.title}</strong> — {item.course.status} — {item.progress.completionPercentage}% <button onClick={() => void openCourse(item)}>Open</button></li>)}</ul>
    {enrolled.length === 0 && <p className="empty">No enrolled courses yet.</p>}
    {selected && <section>
      <h3>{selected.course.title}</h3>
      <p>{selected.course.description}</p>
      {courseProgress && <p>Course progress: {courseProgress.state} ({courseProgress.completedLessons}/{courseProgress.totalLessons}, {courseProgress.completionPercentage}%)</p>}
      <ol>{lessons.map((lesson) => <li key={lesson.id}><strong>{lesson.position}. {lesson.title}</strong> — {lesson.progressState} <button onClick={() => { setCurrentLesson(lesson); void progressAction(lesson.id, 'start'); }}>Open lesson</button> <button onClick={() => void progressAction(lesson.id, 'complete')}>Complete</button></li>)}</ol>
      {currentLesson && <article><h4>{currentLesson.title}</h4><p>{currentLesson.content}</p></article>}
      <CourseDiscussion courseId={selected.course.id} />
    </section>}</>}
  </section>;
}

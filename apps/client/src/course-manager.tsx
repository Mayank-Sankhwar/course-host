import { FormEvent, useEffect, useState } from 'react';
import { courseApi, type Course } from './course-api';
import { LessonManager } from './lesson-manager';
import { CourseDiscussion } from './course-discussion';
import { EnrollmentManager } from './enrollment-manager';
import { ActivityManager } from './activity-manager';

const emptyCourse = { title: '', description: '', category: '' };
type DetailTab = 'metadata' | 'lessons' | 'learners' | 'activity' | 'discussion';
const statusClass = (status: string) => `status-badge status-${status.toLowerCase().replaceAll('_', '-')}`;

export function CourseManager({ initialActivity = false }: { initialActivity?: boolean }) {
  const [courses, setCourses] = useState<Course[]>([]); const [form, setForm] = useState(emptyCourse);
  const [selected, setSelected] = useState<Course | null>(null);
  const [tab, setTab] = useState<DetailTab>(initialActivity ? 'activity' : 'metadata'); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  async function loadCourses() { setLoading(true); try { const response = await courseApi.list(); setCourses(response.courses); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load courses.'); } finally { setLoading(false); } }
  useEffect(() => { void loadCourses(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const response = selected
        ? await courseApi.update(selected.id, form)
        : await courseApi.create(form);
      setSelected(response.course);
      setForm({ title: response.course.title, description: response.course.description, category: response.course.category });
      await loadCourses();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save course.'); }
  }
  async function transition(action: 'publish' | 'archive' | 'restore') { if (!selected) return; setError(null); try { const { course } = await courseApi.transition(selected.id, action); setSelected(course); await loadCourses(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update course status.'); } }
  function open(course: Course, nextTab: DetailTab = initialActivity ? 'activity' : 'metadata') { setSelected(course); setTab(nextTab); setForm({ title: course.title, description: course.description, category: course.category }); }
  if (selected) return <section className="card"><div className="page-heading"><div><button className="button-secondary" onClick={() => { setSelected(null); setForm(emptyCourse); }}>← All courses</button><h2>{selected.title}</h2></div><span className={statusClass(selected.status)}>{selected.status}</span></div>{error && <p role="alert">{error}</p>}<nav className="detail-tabs" aria-label="Course management sections">{(['metadata', 'lessons', 'learners', 'activity', 'discussion'] as DetailTab[]).map((item) => <button key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav>{tab === 'metadata' && <><h3>Course metadata</h3><form onSubmit={submit}><label>Title <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label>Description <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></label><label>Category <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required /></label><button type="submit">Save metadata</button></form><p className="helper-text">Created {new Date(selected.createdAt).toLocaleString()}</p><div className="actions">{selected.status === 'DRAFT' && <button className="button-primary" onClick={() => void transition('publish')}>Publish</button>}{selected.status === 'PUBLISHED' && <button className="danger" onClick={() => { if (window.confirm('Archive this course? Enrollments and progress will be preserved.')) void transition('archive'); }}>Archive</button>}{selected.status === 'ARCHIVED' && <button className="button-primary" onClick={() => void transition('restore')}>Restore</button>}</div></>}{tab === 'lessons' && <LessonManager courseId={selected.id} courseTitle={selected.title} />}{tab === 'learners' && <EnrollmentManager courseId={selected.id} courseTitle={selected.title} />}{tab === 'activity' && <ActivityManager courseId={selected.id} courseTitle={selected.title} />}{tab === 'discussion' && <CourseDiscussion courseId={selected.id} />}</section>;
  return <section className="card"><div className="page-heading"><div><h2>My courses</h2><p>Manage your course library, lessons, learners, and activity.</p></div></div>{error && <p role="alert">{error}</p>}<div className="subsection"><h3>Create a draft course</h3><form onSubmit={submit}><label>Title <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label><label>Description <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></label><label>Category <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required /></label><button type="submit">Create draft course</button></form></div>{loading ? <p className="loading-state">Loading your courses…</p> : courses.length === 0 ? <p className="empty">No courses yet. Create your first draft course above.</p> : <div className="course-list">{courses.map((course) => <article className="course-card" key={course.id}><div className="course-card-header"><strong>{course.title}</strong><span className={statusClass(course.status)}>{course.status}</span></div><p>{course.description}</p><p className="meta">{course.category} · created {new Date(course.createdAt).toLocaleDateString()}{course.enrollmentCount === undefined ? '' : ` · ${course.enrollmentCount} enrollments`}</p><div className="actions"><button className="button-primary" onClick={() => open(course)}>Open course</button><button onClick={() => open(course)}>Edit metadata</button></div></article>)}</div>}</section>;
}

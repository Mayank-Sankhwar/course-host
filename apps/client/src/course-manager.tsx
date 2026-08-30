import { FormEvent, useEffect, useState } from 'react';
import { courseApi, type Course } from './course-api';

const emptyCourse = { title: '', description: '', category: '' };

export function CourseManager() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [form, setForm] = useState(emptyCourse);
  const [editing, setEditing] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCourses() {
    try {
      const response = await courseApi.list();
      setCourses(response.courses);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load courses.');
    }
  }

  useEffect(() => { void loadCourses(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      if (editing) await courseApi.update(editing.id, form);
      else await courseApi.create(form);
      setForm(emptyCourse);
      setEditing(null);
      await loadCourses();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save course.');
    }
  }

  function edit(course: Course) {
    setEditing(course);
    setForm({ title: course.title, description: course.description, category: course.category });
  }

  return (
    <section>
      <h2>My courses</h2>
      <form onSubmit={submit}>
        <label>Title <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
        <label>Description <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></label>
        <label>Category <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required /></label>
        <button type="submit">{editing ? 'Save course' : 'Create draft course'}</button>
        {editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyCourse); }}>Cancel</button>}
      </form>
      {error && <p role="alert">{error}</p>}
      <ul>
        {courses.map((course) => <li key={course.id}><strong>{course.title}</strong> — {course.status} <button onClick={() => edit(course)}>Edit</button></li>)}
      </ul>
    </section>
  );
}

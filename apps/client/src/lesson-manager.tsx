import { FormEvent, useEffect, useState } from 'react';
import { lessonApi, type Lesson } from './lesson-api';

const emptyLesson = { title: '', content: '' };

export function LessonManager({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [form, setForm] = useState(emptyLesson);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadLessons() {
    try {
      const response = await lessonApi.list(courseId);
      setLessons(response.lessons);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load lessons.');
    }
  }

  useEffect(() => { void loadLessons(); }, [courseId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      if (editing) await lessonApi.update(courseId, editing.id, form);
      else await lessonApi.create(courseId, form);
      setForm(emptyLesson);
      setEditing(null);
      await loadLessons();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save lesson.');
    }
  }

  async function remove(lesson: Lesson) {
    setError(null);
    try {
      await lessonApi.remove(courseId, lesson.id);
      await loadLessons();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete lesson.');
    }
  }

  async function move(index: number, offset: -1 | 1) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= lessons.length) return;
    const reordered = [...lessons];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setError(null);
    try {
      const response = await lessonApi.reorder(courseId, reordered.map((lesson) => lesson.id));
      setLessons(response.lessons);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reorder lessons.');
      await loadLessons();
    }
  }

  function edit(lesson: Lesson) {
    setEditing(lesson);
    setForm({ title: lesson.title, content: lesson.content });
  }

  return (
    <section>
      <div className="page-heading"><div><h3>Lessons</h3><p className="helper-text">Create and order lessons for {courseTitle}.</p></div></div>
      <form onSubmit={submit}>
        <label>Title <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
        <label>Content <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required /></label>
        <button type="submit">{editing ? 'Save lesson' : 'Add lesson'}</button>
        {editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyLesson); }}>Cancel</button>}
      </form>
      {error && <p role="alert">{error}</p>}
      {lessons.length === 0 && <p className="empty">No lessons yet. Add the first lesson above to publish this course.</p>}
      <ol className="lesson-list">
        {lessons.map((lesson, index) => (
          <li key={lesson.id}>
            <strong>{lesson.title}</strong>
            <button onClick={() => void move(index, -1)} disabled={index === 0}>Move up</button>
            <button onClick={() => void move(index, 1)} disabled={index === lessons.length - 1}>Move down</button>
            <button onClick={() => edit(lesson)}>Edit</button>
            <button className="button-danger" onClick={() => void remove(lesson)}>Delete</button>
          </li>
        ))}
      </ol>
    </section>
  );
}

import { FormEvent, useEffect, useState } from 'react';
import { lessonApi, type Lesson } from './lesson-api';

const emptyLesson = { title: '', content: '' };

export function LessonManager({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [form, setForm] = useState(emptyLesson);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

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
    setPending('save');
    try {
      if (editing) await lessonApi.update(courseId, editing.id, form);
      else await lessonApi.create(courseId, form);
      setForm(emptyLesson);
      setEditing(null);
      await loadLessons();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save lesson.');
    } finally { setPending(null); }
  }

  async function remove(lesson: Lesson) {
    setError(null);
    setPending(`delete-${lesson.id}`);
    try {
      await lessonApi.remove(courseId, lesson.id);
      await loadLessons();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete lesson.');
    } finally { setPending(null); }
  }

  async function move(index: number, offset: -1 | 1) {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= lessons.length) return;
    const reordered = [...lessons];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setError(null);
    setPending('reorder');
    try {
      const response = await lessonApi.reorder(courseId, reordered.map((lesson) => lesson.id));
      setLessons(response.lessons);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reorder lessons.');
      await loadLessons();
    } finally { setPending(null); }
  }

  function edit(lesson: Lesson) {
    setEditing(lesson);
    setForm({ title: lesson.title, content: lesson.content });
  }

  return (
    <section>
      <div className="page-heading"><div><h3>Lessons</h3><p className="helper-text">Create and order lessons for {courseTitle}.</p></div></div>
      <section className="subsection lesson-editor"><div className="section-heading"><div><h4>{editing ? 'Edit lesson' : 'Add a lesson'}</h4><p className="helper-text">Lessons keep their identity when their order changes.</p></div></div><form onSubmit={submit}>
        <label>Title <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required disabled={pending === 'save'} /></label>
        <label>Content <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required disabled={pending === 'save'} /></label>
        <button type="submit" disabled={pending === 'save'}>{pending === 'save' ? 'Saving lesson…' : editing ? 'Save lesson' : 'Add lesson'}</button>
        {editing && <button type="button" disabled={pending === 'save'} onClick={() => { setEditing(null); setForm(emptyLesson); }}>Cancel</button>}
      </form>
      </section>
      {error && <p role="alert">{error}</p>}
      {lessons.length === 0 && <p className="empty">No lessons yet. Add the first lesson above to publish this course.</p>}
      <ol className="lesson-list">
        {lessons.map((lesson, index) => (
          <li className="lesson-row" key={lesson.id}>
            <div className="lesson-position" aria-label={`Lesson ${lesson.position}`}>{lesson.position}</div>
            <div className="lesson-summary"><strong>{lesson.title}</strong><p className="helper-text">{lesson.content}</p></div>
            <div className="lesson-actions"><button onClick={() => void move(index, -1)} disabled={index === 0 || pending !== null}>Move up</button><button onClick={() => void move(index, 1)} disabled={index === lessons.length - 1 || pending !== null}>Move down</button><button onClick={() => edit(lesson)} disabled={pending !== null}>Edit</button><button className="button-danger" onClick={() => void remove(lesson)} disabled={pending !== null}>{pending === `delete-${lesson.id}` ? 'Deleting…' : 'Delete'}</button></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

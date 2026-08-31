import { FormEvent, useEffect, useState } from 'react';
import { commentApi, type CourseComment } from './comment-api';

function wordCount(value: string) {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/).length : 0;
}

export function CourseDiscussion({ courseId }: { courseId: string }) {
  const [comments, setComments] = useState<CourseComment[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadComments() {
    try {
      const response = await commentApi.list(courseId);
      setComments(response.comments);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load comments.');
    }
  }

  useEffect(() => { void loadComments(); }, [courseId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await commentApi.create(courseId, body);
      setBody('');
      await loadComments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to post comment.');
    }
  }

  const words = wordCount(body);
  return <section>
    <h3>Course discussion</h3>
    {error && <p role="alert">{error}</p>}
    <ul>{comments.map((comment) => <li key={comment.id}><strong>{comment.author.email}</strong> — {new Date(comment.createdAt).toLocaleString()}<p>{comment.body}</p></li>)}</ul>
    <form onSubmit={submit}>
      <label>Comment <textarea value={body} onChange={(event) => setBody(event.target.value)} required /></label>
      <p>{words} / 50 words</p>
      <button type="submit" disabled={words === 0 || words > 50}>Post comment</button>
    </form>
  </section>;
}

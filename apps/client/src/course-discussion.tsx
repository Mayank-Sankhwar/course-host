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
  const [posting, setPosting] = useState(false);

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
    setPosting(true);
    try {
      await commentApi.create(courseId, body);
      setBody('');
      await loadComments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to post comment.');
    } finally { setPosting(false); }
  }

  const words = wordCount(body);
  return <section>
    <div className="page-heading"><div><h3>Course discussion</h3><p className="helper-text">Share questions and updates with the course community.</p></div></div>
    {error && <p role="alert">{error}</p>}
    {comments.length ? <ul className="data-list">{comments.map((comment) => <li key={comment.id}><strong>{comment.author.email}</strong> <span className="helper-text">— {new Date(comment.createdAt).toLocaleString()}</span><p>{comment.body}</p></li>)}</ul> : <p className="empty">No comments yet. Start the discussion below.</p>}
    <form className="comment-composer" onSubmit={submit}>
      <label>Comment <textarea value={body} onChange={(event) => setBody(event.target.value)} required disabled={posting} /></label>
      <p className="helper-text">{words} / 50 words</p>
      <button type="submit" disabled={posting || words === 0 || words > 50}>{posting ? 'Posting…' : 'Post comment'}</button>
    </form>
  </section>;
}

export type CourseComment = {
  id: string;
  courseId: string;
  body: string;
  createdAt: string;
  author: { id: string; email: string; role: 'LEARNER' | 'INSTRUCTOR' };
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Request failed.');
  return payload;
}

export const commentApi = {
  list: (courseId: string) => request<{ comments: CourseComment[] }>(`/api/courses/${courseId}/comments`),
  create: (courseId: string, body: string) => request<{ comment: CourseComment }>(`/api/courses/${courseId}/comments`, {
    method: 'POST', body: JSON.stringify({ body })
  })
};

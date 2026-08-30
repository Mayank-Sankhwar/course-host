export type Lesson = {
  id: string;
  courseId: string;
  title: string;
  content: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Request failed.');
  return payload;
}

export const lessonApi = {
  list: (courseId: string) => request<{ lessons: Lesson[] }>(`/api/courses/${courseId}/lessons`),
  create: (courseId: string, input: Pick<Lesson, 'title' | 'content'>) => request<{ lesson: Lesson }>(`/api/courses/${courseId}/lessons`, {
    method: 'POST', body: JSON.stringify(input)
  }),
  update: (courseId: string, lessonId: string, input: Partial<Pick<Lesson, 'title' | 'content'>>) => request<{ lesson: Lesson }>(`/api/courses/${courseId}/lessons/${lessonId}`, {
    method: 'PATCH', body: JSON.stringify(input)
  }),
  remove: (courseId: string, lessonId: string) => request<void>(`/api/courses/${courseId}/lessons/${lessonId}`, { method: 'DELETE' }),
  reorder: (courseId: string, lessonIds: string[]) => request<{ lessons: Lesson[] }>(`/api/courses/${courseId}/lessons/reorder`, {
    method: 'PATCH', body: JSON.stringify({ lessonIds })
  })
};

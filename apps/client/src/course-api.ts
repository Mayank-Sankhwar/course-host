export type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
};

type CourseList = { courses: Course[]; page: number; limit: number; total: number; totalPages: number };
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

export const courseApi = {
  list: () => request<CourseList>('/api/courses?sort=createdAt&direction=desc'),
  create: (input: Pick<Course, 'title' | 'description' | 'category'>) => request<{ course: Course }>('/api/courses', {
    method: 'POST', body: JSON.stringify(input)
  }),
  update: (id: string, input: Partial<Pick<Course, 'title' | 'description' | 'category'>>) => request<{ course: Course }>(`/api/courses/${id}`, {
    method: 'PATCH', body: JSON.stringify(input)
  })
};

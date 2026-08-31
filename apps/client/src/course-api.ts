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
export type InstructorEnrollment = { id: string; courseId: string; enrolledAt: string; progressState: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'; learner: { id: string; email: string } };
export type BulkEnrollmentResult = { email: string; status: 'ADDED' | 'ALREADY_ENROLLED' | 'LEARNER_NOT_FOUND' | 'NOT_A_LEARNER' | 'INVALID_EMAIL' | 'DUPLICATE_IN_FILE' };
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

async function upload<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${apiBaseUrl}${path}`, { method: 'POST', credentials: 'include', body: form });
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
  }),
  transition: (id: string, action: 'publish' | 'archive' | 'restore') => request<{ course: Course }>(`/api/courses/${id}/${action}`, {
    method: 'POST'
  }),
  enrollLearner: (courseId: string, email: string) => request<{ enrollment: InstructorEnrollment }>(`/api/courses/${courseId}/enrollments`, {
    method: 'POST', body: JSON.stringify({ email })
  }),
  bulkEnroll: (courseId: string, file: File) => upload<{ summary: Record<string, number>; results: BulkEnrollmentResult[] }>(`/api/courses/${courseId}/enrollments/bulk`, file),
  enrollments: (courseId: string, page = 1, limit = 20) => request<{ enrollments: InstructorEnrollment[]; page: number; limit: number; total: number; totalPages: number }>(`/api/courses/${courseId}/enrollments?page=${page}&limit=${limit}`)
};

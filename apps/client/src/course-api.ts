export type Course = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  enrollmentCount?: number;
};

type CourseList = { courses: Course[]; page: number; limit: number; total: number; totalPages: number };
export type InstructorEnrollment = { id: string; courseId: string; enrolledAt: string; progressState: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'; learner: { id: string; email: string } };
export type BulkEnrollmentResult = { email: string; status: 'ADDED' | 'ALREADY_ENROLLED' | 'LEARNER_NOT_FOUND' | 'NOT_A_LEARNER' | 'INVALID_EMAIL' | 'DUPLICATE_IN_FILE' };
export type LearnerActivity = { enrollment: { id: string; enrolledAt: string; progressState: InstructorEnrollment['progressState'] }; learner: { id: string; email: string }; lastProgressAt: string | null; state: 'NOT_STARTED' | 'ACTIVE' | 'INACTIVE' };
export type InactivityAlert = { learner: { id: string; email: string }; lastProgressAt: string; state: 'INACTIVE'; daysSinceLastProgress: number };
export type ActivityRecord = { id: string; type: string; createdAt: string; details: unknown; actor: { id: string; email: string; role: string } | null };
export type InstructorDashboard = {
  totals: { totalLearners: number; publishedCourses: number; completionsThisMonth: number; inProgress: number };
  enrollmentByCourse: { id: string; title: string; enrollmentCount: number }[];
  enrollmentByState: { state: InstructorEnrollment['progressState']; count: number }[];
  completionTrend: { start: string; completed: number }[];
};
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  });
  const payload = (response.status === 204 ? {} : await response.json()) as T & { error?: string };
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

function downloadFilename(header: string | null, fallback: string) {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

async function downloadCsv(courseId: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${apiBaseUrl}/api/courses/${courseId}/enrollments/export.csv`, { credentials: 'include' });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Unable to export learner progress.');
  }
  return {
    blob: await response.blob(),
    filename: downloadFilename(response.headers.get('Content-Disposition'), `course-progress-${courseId}.csv`)
  };
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
  exportProgressCsv: (courseId: string) => downloadCsv(courseId),
  enrollments: (courseId: string, page = 1, limit = 20) => request<{ enrollments: InstructorEnrollment[]; page: number; limit: number; total: number; totalPages: number }>(`/api/courses/${courseId}/enrollments?page=${page}&limit=${limit}`),
  activity: (courseId: string) => request<{ learners: LearnerActivity[]; total: number }>(`/api/courses/${courseId}/activity`),
  alerts: (courseId: string) => request<{ alerts: InactivityAlert[] }>(`/api/courses/${courseId}/alerts`),
  dismissAlert: (courseId: string, learnerId: string) => request<void>(`/api/courses/${courseId}/alerts/${learnerId}/dismiss`, { method: 'POST' }),
  alertCount: () => request<{ count: number }>('/api/alerts/count'),
  activityLog: (courseId: string) => request<{ records: ActivityRecord[]; total: number }>(`/api/courses/${courseId}/activity-log`),
  dashboard: () => request<InstructorDashboard>('/api/dashboard')
};

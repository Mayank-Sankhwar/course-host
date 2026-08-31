export type LearnerCourse = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'PUBLISHED' | 'ARCHIVED' | 'DRAFT';
  instructor: { id: string; email: string };
  enrollmentCount: number;
};

export type CourseProgress = {
  state: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  completedLessons: number;
  totalLessons: number;
  completionPercentage: number;
};

export type LearnerLesson = { id: string; title: string; position: number; progressState: CourseProgress['state'] };
type EnrolledCourse = { enrollment: { id: string; courseId: string; enrolledAt: string }; course: LearnerCourse; progress: CourseProgress };

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

export const learnerApi = {
  availableCourses: (query: { search: string; category: string; instructorId: string; sort: 'title' | 'createdAt' | 'enrollmentCount'; direction: 'asc' | 'desc'; page: number; limit: number }) => {
    const params = new URLSearchParams({ sort: query.sort, direction: query.direction, page: String(query.page), limit: String(query.limit) });
    if (query.search.trim()) params.set('search', query.search.trim());
    if (query.category.trim()) params.set('category', query.category.trim());
    if (query.instructorId.trim()) params.set('instructorId', query.instructorId.trim());
    return request<{ courses: LearnerCourse[]; page: number; limit: number; total: number; totalPages: number }>(`/api/available-courses?${params.toString()}`);
  },
  enroll: (courseId: string) => request<{ enrollment: { id: string; courseId: string; enrolledAt: string; progressState: CourseProgress['state'] } }>(`/api/courses/${courseId}/enroll`, { method: 'POST' }),
  enrolledCourses: () => request<{ courses: EnrolledCourse[] }>('/api/me/courses'),
  lessons: (courseId: string) => request<{ lessons: LearnerLesson[]; courseProgress: CourseProgress }>(`/api/my-courses/${courseId}/lessons`),
  progress: (courseId: string) => request<{ lessons: LearnerLesson[]; courseProgress: CourseProgress }>(`/api/my-courses/${courseId}/progress`),
  progressAction: (courseId: string, lessonId: string, action: 'start' | 'complete') => request<{ courseProgress: CourseProgress }>(`/api/my-courses/${courseId}/lessons/${lessonId}/${action}`, { method: 'POST' })
};

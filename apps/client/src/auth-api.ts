export type CurrentUser = {
  id: string;
  email: string;
  role: 'LEARNER' | 'INSTRUCTOR';
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed.');
  }
  return payload;
}

export const authApi = {
  signup: (email: string, password: string) => request<{ user: CurrentUser }>('/api/auth/signup', {
    method: 'POST', body: JSON.stringify({ email, password, role: 'LEARNER' })
  }),
  login: (email: string, password: string) => request<{ user: CurrentUser }>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password })
  }),
  me: () => request<{ user: CurrentUser }>('/api/auth/me'),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' })
};

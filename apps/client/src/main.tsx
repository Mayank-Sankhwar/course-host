import { FormEvent, StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { authApi, type CurrentUser } from './auth-api';
import { CourseManager } from './course-manager';
import { LearnerManager } from './learner-manager';
import { InstructorDashboardView } from './instructor-dashboard';
import { AlertBadge } from './alert-badge';
import './app.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found.');
}

function AuthenticationApp() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'courses' | 'alerts' | 'catalogue' | 'my-courses'>('dashboard');

  useEffect(() => {
    authApi.me().then(({ user: currentUser }) => setUser(currentUser)).catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const response = mode === 'login'
        ? await authApi.login(email, password)
        : await authApi.signup(email, password);
      setUser(response.user);
      setView(response.user.role === 'INSTRUCTOR' ? 'dashboard' : 'catalogue');
      setPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed.');
    }
  }

  async function logout() {
    try { await authApi.logout(); } catch { /* A missing session is already logged out. */ }
    setUser(null);
  }

  if (user) return <main><header className="topbar"><h1>CourseHost</h1><span>{user.email}</span><nav>{user.role === 'INSTRUCTOR' ? <><button aria-current={view === 'dashboard' ? 'page' : undefined} onClick={() => setView('dashboard')}>Dashboard</button><button aria-current={view === 'courses' ? 'page' : undefined} onClick={() => setView('courses')}>Courses</button><button aria-current={view === 'alerts' ? 'page' : undefined} onClick={() => setView('alerts')}>Activity / Alerts<AlertBadge /></button></> : <><button aria-current={view === 'catalogue' ? 'page' : undefined} onClick={() => setView('catalogue')}>Catalogue</button><button aria-current={view === 'my-courses' ? 'page' : undefined} onClick={() => setView('my-courses')}>My Courses</button></>}<button onClick={() => void logout()}>Log out</button></nav></header>{user.role === 'INSTRUCTOR' && view === 'dashboard' && <InstructorDashboardView />}{user.role === 'INSTRUCTOR' && view === 'courses' && <CourseManager />}{user.role === 'INSTRUCTOR' && view === 'alerts' && <CourseManager initialActivity />}{user.role === 'LEARNER' && <LearnerManager initialView={view === 'my-courses' ? 'my-courses' : 'catalogue'} />}</main>;

  return (
    <main>
      <h1>CourseHost</h1>
      <h2>{mode === 'login' ? 'Log in' : 'Create learner account'}</h2>
      <form onSubmit={submit}>
        <label>Email <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
        <button type="submit">{mode === 'login' ? 'Log in' : 'Sign up'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'Need a learner account?' : 'Already have an account?'}
      </button>
    </main>
  );
}

createRoot(root).render(<StrictMode><AuthenticationApp /></StrictMode>);

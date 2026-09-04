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
  const [showPassword, setShowPassword] = useState(false);
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

  if (user) return <div className="app-shell"><header className="topbar"><h1 className="brand">CourseHost</h1><div className="user-meta"><strong title={user.email}>{user.email}</strong><span className="role-label">{user.role.toLowerCase()}</span></div><nav aria-label="Primary navigation">{user.role === 'INSTRUCTOR' ? <><button aria-current={view === 'dashboard' ? 'page' : undefined} onClick={() => setView('dashboard')}>Dashboard</button><button aria-current={view === 'courses' ? 'page' : undefined} onClick={() => setView('courses')}>Courses</button><button aria-current={view === 'alerts' ? 'page' : undefined} onClick={() => setView('alerts')}>Activity / Alerts<AlertBadge /></button></> : <><button aria-current={view === 'catalogue' ? 'page' : undefined} onClick={() => setView('catalogue')}>Catalogue</button><button aria-current={view === 'my-courses' ? 'page' : undefined} onClick={() => setView('my-courses')}>My Courses</button></>}<button className="logout-button" onClick={() => void logout()}>Log out</button></nav></header><main className="app-content">{user.role === 'INSTRUCTOR' && view === 'dashboard' && <InstructorDashboardView />}{user.role === 'INSTRUCTOR' && view === 'courses' && <CourseManager instructor={user} />}{user.role === 'INSTRUCTOR' && view === 'alerts' && <CourseManager instructor={user} initialActivity />}{user.role === 'LEARNER' && <LearnerManager initialView={view === 'my-courses' ? 'my-courses' : 'catalogue'} />}</main></div>;

  return (
    <main className="auth-layout">
      <section className="auth-card" aria-labelledby="auth-title">
      <h1>CourseHost</h1>
      <h2 id="auth-title">{mode === 'login' ? 'Welcome back' : 'Create learner account'}</h2>
      <p className="helper-text">{mode === 'login' ? 'Log in to continue learning or managing your courses.' : 'Get started with your learner account.'}</p>
      <form onSubmit={submit}>
        <label>Email <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Password <span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /><button className="password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}><span aria-hidden="true">{showPassword ? '◉' : '◌'}</span></button></span></label>
        <button type="submit">{mode === 'login' ? 'Log in' : 'Sign up'}</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <button className="auth-switch" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        {mode === 'login' ? 'Need a learner account?' : 'Already have an account?'}
      </button>
      </section>
    </main>
  );
}

createRoot(root).render(<StrictMode><AuthenticationApp /></StrictMode>);

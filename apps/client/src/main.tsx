import { FormEvent, StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { authApi, type CurrentUser } from './auth-api';

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
      setPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed.');
    }
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  if (user) {
    return <main><h1>CourseHost</h1><p>Signed in as {user.email} ({user.role}).</p><button onClick={logout}>Log out</button></main>;
  }

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

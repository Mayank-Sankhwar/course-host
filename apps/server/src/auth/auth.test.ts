import { Role } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { requireAuth, requireRole } from './middleware.js';
import { hashPassword } from './password.js';
import { MemoryAuthUserRepository } from '../test-support/memory-auth-user-repository.js';

function testContext() {
  const users = new MemoryAuthUserRepository();
  const app = createApp({
    clientOrigin: 'http://localhost:5173',
    isProduction: false,
    sessionSecret: 'test-session-secret-that-is-at-least-32-characters',
    userRepository: users,
    registerRoutes: (testApp) => {
      testApp.get('/test/instructor-only', requireAuth(users), requireRole(Role.INSTRUCTOR), (_request, response) => response.json({ ok: true }));
      testApp.get('/test/learner-only', requireAuth(users), requireRole(Role.LEARNER), (_request, response) => response.json({ ok: true }));
    }
  });
  return { app, users };
}

describe('authentication API', () => {
  it('registers a learner and returns only safe user data', async () => {
    const { app } = testContext();
    const response = await request(app).post('/api/auth/signup').send({
      email: '  LEARNER@example.com ', password: 'a secure password'
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ email: 'learner@example.com', role: Role.LEARNER });
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate emails', async () => {
    const { app } = testContext();
    await request(app).post('/api/auth/signup').send({ email: 'learner@example.com', password: 'a secure password' });
    const response = await request(app).post('/api/auth/signup').send({ email: 'LEARNER@example.com', password: 'a secure password' });
    expect(response.status).toBe(409);
  });

  it('rejects invalid signup input and public instructor registration', async () => {
    const { app } = testContext();
    const invalidEmail = await request(app).post('/api/auth/signup').send({ email: 'not-an-email', password: 'a secure password' });
    const invalidPassword = await request(app).post('/api/auth/signup').send({ email: 'learner@example.com', password: 'short' });
    const instructor = await request(app).post('/api/auth/signup').send({ email: 'instructor@example.com', password: 'a secure password', role: Role.INSTRUCTOR });
    expect(invalidEmail.status).toBe(400);
    expect(invalidPassword.status).toBe(400);
    expect(instructor.status).toBe(403);
  });

  it('logs in with valid credentials and rejects invalid credentials generically', async () => {
    const { app, users } = testContext();
    await users.create({ email: 'learner@example.com', passwordHash: await hashPassword('a secure password'), role: Role.LEARNER });
    const success = await request(app).post('/api/auth/login').send({ email: 'LEARNER@example.com', password: 'a secure password' });
    const wrongPassword = await request(app).post('/api/auth/login').send({ email: 'learner@example.com', password: 'wrong password' });
    const unknownUser = await request(app).post('/api/auth/login').send({ email: 'unknown@example.com', password: 'a secure password' });

    expect(success.status).toBe(200);
    expect(success.body.user.passwordHash).toBeUndefined();
    expect(wrongPassword).toMatchObject({ status: 401, body: { error: 'Invalid email or password.' } });
    expect(unknownUser).toMatchObject({ status: 401, body: { error: 'Invalid email or password.' } });
  });

  it('returns the current server-side user and invalidates the server session on logout', async () => {
    const { app } = testContext();
    const agent = request.agent(app);
    await agent.post('/api/auth/signup').send({ email: 'learner@example.com', password: 'a secure password' }).expect(201);
    await agent.get('/api/auth/me').expect(200).expect(({ body }) => {
      expect(body.user).toMatchObject({ email: 'learner@example.com', role: Role.LEARNER });
      expect(body.user.passwordHash).toBeUndefined();
    });
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('distinguishes unauthenticated and wrong-role protected requests', async () => {
    const { app, users } = testContext();
    const unauthenticated = await request(app).get('/test/instructor-only');
    const learner = request.agent(app);
    await learner.post('/api/auth/signup').send({ email: 'learner@example.com', password: 'a secure password' }).expect(201);
    const learnerForbidden = await learner.get('/test/instructor-only');

    await users.create({ email: 'instructor@example.com', passwordHash: await hashPassword('a secure password'), role: Role.INSTRUCTOR });
    const instructor = request.agent(app);
    await instructor.post('/api/auth/login').send({ email: 'instructor@example.com', password: 'a secure password' }).expect(200);
    const instructorForbidden = await instructor.get('/test/learner-only');
    const instructorAllowed = await instructor.get('/test/instructor-only');

    expect(unauthenticated.status).toBe(401);
    expect(learnerForbidden.status).toBe(403);
    expect(instructorForbidden.status).toBe(403);
    expect(instructorAllowed.status).toBe(200);
  });
});

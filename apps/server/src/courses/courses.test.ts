import { CourseStatus, Role } from '@prisma/client';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { hashPassword } from '../auth/password.js';
import { MemoryAuthUserRepository } from '../test-support/memory-auth-user-repository.js';
import { MemoryCourseRepository } from '../test-support/memory-course-repository.js';

const courseInput = { title: 'Security Basics', description: 'Security training course.', category: 'Compliance' };

function testContext() {
  const users = new MemoryAuthUserRepository();
  const courses = new MemoryCourseRepository();
  const app = createApp({
    clientOrigin: 'http://localhost:5173',
    isProduction: false,
    sessionSecret: 'test-session-secret-that-is-at-least-32-characters',
    userRepository: users,
    courseRepository: courses
  });
  return { app, users, courses };
}

async function instructorAgent(app: ReturnType<typeof createApp>, users: MemoryAuthUserRepository, email: string) {
  await users.create({ email, passwordHash: await hashPassword('a secure password'), role: Role.INSTRUCTOR });
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: 'a secure password' }).expect(200);
  return agent;
}

describe('instructor course API', () => {
  it('requires authenticated instructors to create courses', async () => {
    const { app } = testContext();
    await request(app).post('/api/courses').send(courseInput).expect(401);

    const learner = request.agent(app);
    await learner.post('/api/auth/signup').send({ email: 'learner@example.com', password: 'a secure password' }).expect(201);
    await learner.post('/api/courses').send(courseInput).expect(403);
  });

  it('creates a draft owned by the authenticated instructor and rejects server-owned fields', async () => {
    const { app, users } = testContext();
    const instructor = await instructorAgent(app, users, 'instructor@example.com');
    const created = await instructor.post('/api/courses').send(courseInput).expect(201);
    expect(created.body.course).toMatchObject({ ...courseInput, status: CourseStatus.DRAFT });
    expect(created.body.course.instructorId).toBeDefined();

    await instructor.post('/api/courses').send({ ...courseInput, status: CourseStatus.PUBLISHED }).expect(400);
    await instructor.post('/api/courses').send({ ...courseInput, status: CourseStatus.ARCHIVED }).expect(400);
    await instructor.post('/api/courses').send({ ...courseInput, instructorId: 'another-user' }).expect(400);
    await instructor.post('/api/courses').send({ title: '', description: courseInput.description, category: courseInput.category }).expect(400);
  });

  it('returns an instructor own course but not another instructor course', async () => {
    const { app, users, courses } = testContext();
    await request(app).get('/api/courses/not-a-course').expect(401);
    const owner = await instructorAgent(app, users, 'owner@example.com');
    const ownerId = (await owner.get('/api/auth/me')).body.user.id;
    const course = courses.seed({ ...courseInput, instructorId: ownerId });
    await owner.get(`/api/courses/${course.id}`).expect(200).expect(({ body }) => expect(body.course.id).toBe(course.id));
    await owner.get('/api/courses/not-a-course').expect(404);

    const other = await instructorAgent(app, users, 'other@example.com');
    await other.get(`/api/courses/${course.id}`).expect(403);

    const learner = request.agent(app);
    await learner.post('/api/auth/signup').send({ email: 'learner@example.com', password: 'a secure password' }).expect(201);
    await learner.get(`/api/courses/${course.id}`).expect(403);
  });

  it('updates only an owner course and preserves status', async () => {
    const { app, users, courses } = testContext();
    const owner = await instructorAgent(app, users, 'owner@example.com');
    const ownerId = (await owner.get('/api/auth/me')).body.user.id;
    const draft = courses.seed({ ...courseInput, instructorId: ownerId });
    const published = courses.seed({ ...courseInput, title: 'Published course', instructorId: ownerId, status: CourseStatus.PUBLISHED });
    const archived = courses.seed({ ...courseInput, title: 'Archived course', instructorId: ownerId, status: CourseStatus.ARCHIVED });

    const updatedDraft = await owner.patch(`/api/courses/${draft.id}`).send({ title: 'Updated draft' }).expect(200);
    const updatedPublished = await owner.patch(`/api/courses/${published.id}`).send({ description: 'Updated description' }).expect(200);
    const updatedArchived = await owner.patch(`/api/courses/${archived.id}`).send({ category: 'Updated category' }).expect(200);
    expect(updatedDraft.body.course).toMatchObject({ title: 'Updated draft', status: CourseStatus.DRAFT });
    expect(updatedPublished.body.course.status).toBe(CourseStatus.PUBLISHED);
    expect(updatedArchived.body.course.status).toBe(CourseStatus.ARCHIVED);
    await owner.patch(`/api/courses/${draft.id}`).send({ status: CourseStatus.PUBLISHED }).expect(400);
    await owner.patch(`/api/courses/${draft.id}`).send({ instructorId: 'other-user' }).expect(400);
    await owner.patch(`/api/courses/${draft.id}`).send({ id: 'different-course' }).expect(400);
    await owner.patch(`/api/courses/${draft.id}`).send({}).expect(400);
    await owner.patch(`/api/courses/${draft.id}`).send({ title: 42 }).expect(400);
    await request(app).patch(`/api/courses/${draft.id}`).send({ title: 'Unauthenticated' }).expect(401);

    const other = await instructorAgent(app, users, 'other@example.com');
    await other.patch(`/api/courses/${draft.id}`).send({ title: 'Stolen' }).expect(403);
    const learner = request.agent(app);
    await learner.post('/api/auth/signup').send({ email: 'learner@example.com', password: 'a secure password' }).expect(201);
    await learner.patch(`/api/courses/${draft.id}`).send({ title: 'Stolen' }).expect(403);
  });

  it('lists only owned courses with database-style pagination, filters, search, and whitelisted sorting', async () => {
    const { app, users, courses } = testContext();
    const owner = await instructorAgent(app, users, 'owner@example.com');
    const ownerId = (await owner.get('/api/auth/me')).body.user.id;
    courses.seed({ ...courseInput, title: 'Bravo', description: 'React foundations', instructorId: ownerId, category: 'Engineering' });
    courses.seed({ ...courseInput, title: 'Alpha', description: 'Advanced React', instructorId: ownerId, category: 'Engineering', status: CourseStatus.PUBLISHED });
    courses.seed({ ...courseInput, title: 'Archived', description: 'Legacy React', instructorId: ownerId, category: 'Engineering', status: CourseStatus.ARCHIVED });
    courses.seed({ ...courseInput, title: 'Other instructor', instructorId: 'outside-owner' });

    const page = await owner.get('/api/courses?page=1&limit=1&sort=title&direction=asc&category=Engineering');
    expect(page.status).toBe(200);
    expect(page.body).toMatchObject({ page: 1, limit: 1, total: 3, totalPages: 3 });
    expect(page.body.courses).toHaveLength(1);
    expect(page.body.courses[0].title).toBe('Alpha');

    const status = await owner.get('/api/courses?status=PUBLISHED&instructorId=outside-owner');
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ total: 1 });
    expect(status.body.courses[0].instructorId).toBe(ownerId);

    const titleSearch = await owner.get('/api/courses?search=bravo');
    const descriptionSearch = await owner.get('/api/courses?search=ADVANCED');
    const noMatch = await owner.get('/api/courses?search=does-not-exist');
    const combined = await owner.get('/api/courses?status=PUBLISHED&category=Engineering&search=react&page=1&limit=1');
    expect(titleSearch.body).toMatchObject({ total: 1 });
    expect(titleSearch.body.courses[0].title).toBe('Bravo');
    expect(descriptionSearch.body).toMatchObject({ total: 1 });
    expect(descriptionSearch.body.courses[0].title).toBe('Alpha');
    expect(noMatch.body).toMatchObject({ total: 0, totalPages: 0 });
    expect(combined.body).toMatchObject({ total: 1, page: 1, limit: 1, totalPages: 1 });
    expect(combined.body.courses[0].status).toBe(CourseStatus.PUBLISHED);

    const allStatuses = await owner.get('/api/courses?limit=50');
    expect(allStatuses.body.courses.map((course: { status: CourseStatus }) => course.status)).toEqual(expect.arrayContaining([
      CourseStatus.DRAFT, CourseStatus.PUBLISHED, CourseStatus.ARCHIVED
    ]));

    await owner.get('/api/courses?sort=instructorId').expect(400);
    await owner.get('/api/courses?direction=sideways').expect(400);
    await owner.get('/api/courses?page=0').expect(400);
    await owner.get('/api/courses?page=-1').expect(400);
    await owner.get('/api/courses?limit=0').expect(400);
    await owner.get('/api/courses?limit=-1').expect(400);
    await owner.get('/api/courses?limit=999999999').expect(400);
  });
});

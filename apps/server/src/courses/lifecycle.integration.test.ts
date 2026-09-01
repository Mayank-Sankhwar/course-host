import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { CourseStatus, EnrollmentProgressState, Role } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { hashPassword } from '../auth/password.js';
import { prisma } from '../db/prisma.js';

const integrationDescribe = process.env.DATABASE_URL ? describe : describe.skip;
const runId = randomUUID();
const password = 'LifecycleIntegration123!';
const createdCourseIds: string[] = [];
const createdUserIds: string[] = [];

let instructorA: { id: string };
let instructorB: { id: string };
let learner: { id: string };
let app: ReturnType<typeof createApp>;
let agentA: ReturnType<typeof request.agent>;
let agentB: ReturnType<typeof request.agent>;
let learnerAgent: ReturnType<typeof request.agent>;

async function createCourse(instructorId: string, label: string, status: CourseStatus = CourseStatus.DRAFT) {
  const course = await prisma.course.create({
    data: { instructorId, title: `${label}-${runId}`, description: 'Lifecycle integration test course.', category: 'Testing', status }
  });
  createdCourseIds.push(course.id);
  return course;
}

async function createLesson(courseId: string, position: number) {
  return prisma.lesson.create({ data: { courseId, title: `Lesson ${position}`, content: 'Test content.', position } });
}

integrationDescribe('course lifecycle API with PostgreSQL', () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    [instructorA, instructorB, learner] = await Promise.all([
      prisma.user.create({ data: { email: `lifecycle-a-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true } }),
      prisma.user.create({ data: { email: `lifecycle-b-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true } }),
      prisma.user.create({ data: { email: `lifecycle-learner-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true } })
    ]);
    createdUserIds.push(instructorA.id, instructorB.id, learner.id);
    app = createApp({
      clientOrigin: 'http://localhost:5173',
      isProduction: false,
      sessionSecret: 'lifecycle-test-session-secret-that-is-at-least-32-characters'
    });
    agentA = request.agent(app);
    agentB = request.agent(app);
    learnerAgent = request.agent(app);
    await Promise.all([
      agentA.post('/api/auth/login').send({ email: `lifecycle-a-${runId}@test.local`, password }).expect(200),
      agentB.post('/api/auth/login').send({ email: `lifecycle-b-${runId}@test.local`, password }).expect(200),
      learnerAgent.post('/api/auth/login').send({ email: `lifecycle-learner-${runId}@test.local`, password }).expect(200)
    ]);
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.lessonProgress.deleteMany({ where: { enrollment: { courseId: { in: createdCourseIds } } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.lesson.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it('publishes an owned draft only when it contains a lesson', async () => {
    const emptyDraft = await createCourse(instructorA.id, 'Empty draft');
    const draft = await createCourse(instructorA.id, 'Publishable draft');
    const lesson = await createLesson(draft.id, 1);

    await request(app).post(`/api/courses/${draft.id}/publish`).expect(401);
    await learnerAgent.post(`/api/courses/${draft.id}/publish`).expect(403);
    await agentB.post(`/api/courses/${draft.id}/publish`).expect(403);
    await agentA.post('/api/courses/not-a-course/publish').expect(404);
    await agentA.post(`/api/courses/${emptyDraft.id}/publish`).expect(409).expect(({ body }) => {
      expect(body.error).toBe('The course must contain at least one lesson before it can be published.');
    });

    const published = await agentA.post(`/api/courses/${draft.id}/publish`).send({ instructorId: instructorB.id, status: CourseStatus.ARCHIVED }).expect(200);
    expect(published.body.course).toMatchObject({ id: draft.id, instructorId: instructorA.id, status: CourseStatus.PUBLISHED });
    expect(await prisma.lesson.findUnique({ where: { id: lesson.id } })).toMatchObject({ id: lesson.id, courseId: draft.id, position: 1 });
    await agentA.post(`/api/courses/${draft.id}/publish`).expect(409);
    await agentA.patch(`/api/courses/${draft.id}`).send({ status: CourseStatus.ARCHIVED }).expect(400);
  });

  it('archives and restores only the valid states while preserving lessons, enrollment, and progress', async () => {
    const course = await createCourse(instructorA.id, 'Preservation');
    const [first, second] = await Promise.all([createLesson(course.id, 1), createLesson(course.id, 2)]);
    const enrollment = await prisma.enrollment.create({
      data: { learnerId: learner.id, courseId: course.id, progressState: EnrollmentProgressState.IN_PROGRESS }
    });
    const progress = await prisma.lessonProgress.create({
      data: { enrollmentId: enrollment.id, lessonId: first.id, startedAt: new Date(), completedAt: new Date() }
    });
    await agentA.post(`/api/courses/${course.id}/publish`).expect(200);

    const before = await prisma.course.findUniqueOrThrow({
      where: { id: course.id }, include: { lessons: { orderBy: { position: 'asc' } }, enrollments: { include: { lessonProgress: true } } }
    });
    const archived = await agentA.post(`/api/courses/${course.id}/archive`).expect(200);
    expect(archived.body.course.status).toBe(CourseStatus.ARCHIVED);
    await agentA.post(`/api/courses/${course.id}/archive`).expect(409);

    const afterArchive = await prisma.course.findUniqueOrThrow({
      where: { id: course.id }, include: { lessons: { orderBy: { position: 'asc' } }, enrollments: { include: { lessonProgress: true } } }
    });
    expect(afterArchive.lessons.map((lesson) => [lesson.id, lesson.position])).toEqual(before.lessons.map((lesson) => [lesson.id, lesson.position]));
    expect(afterArchive.enrollments.map((item) => item.id)).toEqual([enrollment.id]);
    expect(afterArchive.enrollments[0].lessonProgress.map((item) => item.id)).toEqual([progress.id]);
    expect(afterArchive.enrollments[0].lessonProgress[0].lessonId).toBe(first.id);
    expect(afterArchive.lessons.map((lesson) => lesson.id)).toContain(second.id);

    const restored = await agentA.post(`/api/courses/${course.id}/restore`).expect(200);
    expect(restored.body.course.status).toBe(CourseStatus.PUBLISHED);
    const afterRestore = await prisma.course.findUniqueOrThrow({ where: { id: course.id }, include: { lessons: true, enrollments: { include: { lessonProgress: true } } } });
    expect(afterRestore.lessons).toHaveLength(2);
    expect(afterRestore.enrollments[0].lessonProgress[0].id).toBe(progress.id);
    await agentA.post(`/api/courses/${course.id}/restore`).expect(409);
  });

  it('rejects archive and restore from invalid starting states', async () => {
    const draft = await createCourse(instructorA.id, 'Draft invalid transitions');
    const published = await createCourse(instructorA.id, 'Published invalid transitions', CourseStatus.PUBLISHED);
    await agentA.post(`/api/courses/${draft.id}/archive`).expect(409);
    await agentA.post(`/api/courses/${draft.id}/restore`).expect(409);
    await agentA.post(`/api/courses/${published.id}/restore`).expect(409);
  });

  it('allows only one concurrent archive transition to succeed', async () => {
    const course = await createCourse(instructorA.id, 'Concurrent archive', CourseStatus.PUBLISHED);
    const results = await Promise.all([
      agentA.post(`/api/courses/${course.id}/archive`),
      agentA.post(`/api/courses/${course.id}/archive`)
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect((await prisma.course.findUniqueOrThrow({ where: { id: course.id } })).status).toBe(CourseStatus.ARCHIVED);
  });
});

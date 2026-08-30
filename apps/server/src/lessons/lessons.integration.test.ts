import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Role } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { hashPassword } from '../auth/password.js';
import { prisma } from '../db/prisma.js';

const integrationDescribe = process.env.DATABASE_URL ? describe : describe.skip;
const runId = randomUUID();
const password = 'IntegrationTest123!';
const createdCourseIds: string[] = [];
const createdUserIds: string[] = [];

let instructorA: { id: string };
let instructorB: { id: string };
let learner: { id: string };
let courseA: { id: string };
let courseASecond: { id: string };
let courseB: { id: string };
let app: ReturnType<typeof createApp>;
let agentA: ReturnType<typeof request.agent>;
let agentB: ReturnType<typeof request.agent>;
let learnerAgent: ReturnType<typeof request.agent>;

async function createCourse(instructorId: string, label: string) {
  const course = await prisma.course.create({
    data: { instructorId, title: `${label}-${runId}`, description: 'Integration test course.', category: 'Testing' }
  });
  createdCourseIds.push(course.id);
  return course;
}

async function createLesson(courseId: string, title: string, position: number) {
  return prisma.lesson.create({ data: { courseId, title, content: `${title} content`, position } });
}

integrationDescribe('lesson management API with PostgreSQL', () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    [instructorA, instructorB, learner] = await Promise.all([
      prisma.user.create({ data: { email: `lesson-a-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true } }),
      prisma.user.create({ data: { email: `lesson-b-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true } }),
      prisma.user.create({ data: { email: `lesson-learner-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true } })
    ]);
    createdUserIds.push(instructorA.id, instructorB.id, learner.id);
    [courseA, courseASecond, courseB] = await Promise.all([
      createCourse(instructorA.id, 'Course A'),
      createCourse(instructorA.id, 'Course A secondary'),
      createCourse(instructorB.id, 'Course B')
    ]);
    app = createApp({
      clientOrigin: 'http://localhost:5173',
      isProduction: false,
      sessionSecret: 'integration-test-session-secret-that-is-at-least-32-characters'
    });
    agentA = request.agent(app);
    agentB = request.agent(app);
    learnerAgent = request.agent(app);
    await Promise.all([
      agentA.post('/api/auth/login').send({ email: `lesson-a-${runId}@test.local`, password }).expect(200),
      agentB.post('/api/auth/login').send({ email: `lesson-b-${runId}@test.local`, password }).expect(200),
      learnerAgent.post('/api/auth/login').send({ email: `lesson-learner-${runId}@test.local`, password }).expect(200)
    ]);
  });

  afterAll(async () => {
    await prisma.lessonProgress.deleteMany({ where: { enrollment: { learnerId: { in: createdUserIds } } } });
    await prisma.enrollment.deleteMany({ where: { learnerId: { in: createdUserIds } } });
    await prisma.lesson.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it('requires an authenticated instructor to create lessons and appends valid lessons', async () => {
    await request(app).post(`/api/courses/${courseA.id}/lessons`).send({ title: 'One', content: 'One content' }).expect(401);
    await learnerAgent.post(`/api/courses/${courseA.id}/lessons`).send({ title: 'One', content: 'One content' }).expect(403);
    await agentA.post(`/api/courses/${courseB.id}/lessons`).send({ title: 'Stolen', content: 'Stolen content' }).expect(403);

    const first = await agentA.post(`/api/courses/${courseA.id}/lessons`).send({ title: 'First', content: 'First content' }).expect(201);
    const second = await agentA.post(`/api/courses/${courseA.id}/lessons`).send({ title: 'Second', content: 'Second content' }).expect(201);
    expect(first.body.lesson).toMatchObject({ courseId: courseA.id, position: 1, title: 'First' });
    expect(second.body.lesson).toMatchObject({ courseId: courseA.id, position: 2, title: 'Second' });
    expect(first.body.lesson.id).not.toBe(second.body.lesson.id);
    await agentA.post(`/api/courses/${courseA.id}/lessons`).send({ title: '', content: 'x' }).expect(400);
    await agentA.post(`/api/courses/${courseA.id}/lessons`).send({ title: 'x', content: 'y', position: 1 }).expect(400);
  });

  it('lists in position order and scopes reads to the owned course', async () => {
    const listed = await agentA.get(`/api/courses/${courseA.id}/lessons`).expect(200);
    expect(listed.body.lessons.map((lesson: { position: number }) => lesson.position)).toEqual([1, 2]);
    await agentB.get(`/api/courses/${courseA.id}/lessons`).expect(403);
    await learnerAgent.get(`/api/courses/${courseA.id}/lessons`).expect(403);

    const foreignLesson = await createLesson(courseASecond.id, 'Secondary', 1);
    await agentA.get(`/api/courses/${courseA.id}/lessons/${foreignLesson.id}`).expect(404);
    await agentA.get(`/api/courses/${courseA.id}/lessons/${listed.body.lessons[0].id}`).expect(200);
  });

  it('updates owner lesson metadata without changing stable identity, course, or position', async () => {
    const lesson = (await agentA.get(`/api/courses/${courseA.id}/lessons`)).body.lessons[0];
    const updated = await agentA.patch(`/api/courses/${courseA.id}/lessons/${lesson.id}`).send({ title: 'Renamed', content: 'Revised material' }).expect(200);
    expect(updated.body.lesson).toMatchObject({ id: lesson.id, courseId: courseA.id, position: 1, title: 'Renamed', content: 'Revised material' });
    await agentA.patch(`/api/courses/${courseA.id}/lessons/${lesson.id}`).send({ id: 'replacement' }).expect(400);
    await agentA.patch(`/api/courses/${courseA.id}/lessons/${lesson.id}`).send({ courseId: courseB.id }).expect(400);
    await agentA.patch(`/api/courses/${courseA.id}/lessons/${lesson.id}`).send({ position: 2 }).expect(400);
    await agentA.patch(`/api/courses/${courseA.id}/lessons/${lesson.id}`).send({}).expect(400);
    await agentB.patch(`/api/courses/${courseA.id}/lessons/${lesson.id}`).send({ title: 'Stolen' }).expect(403);
    await learnerAgent.patch(`/api/courses/${courseA.id}/lessons/${lesson.id}`).send({ title: 'Stolen' }).expect(403);
  });

  it('rejects deleting the final lesson', async () => {
    const singleLessonCourse = await createCourse(instructorA.id, 'Single lesson');
    const lesson = await createLesson(singleLessonCourse.id, 'Only', 1);
    await agentA.delete(`/api/courses/${singleLessonCourse.id}/lessons/${lesson.id}`).expect(409).expect(({ body }) => {
      expect(body.error).toBe('The course must contain at least one lesson.');
    });
    expect(await prisma.lesson.findUnique({ where: { id: lesson.id } })).not.toBeNull();
  });

  it('deletes only the selected lesson progress, normalizes positions, and preserves remaining IDs/progress', async () => {
    const progressCourse = await createCourse(instructorA.id, 'Progress relationship');
    const [lessonA, lessonB, lessonC] = await Promise.all([
      createLesson(progressCourse.id, 'Progress A', 1),
      createLesson(progressCourse.id, 'Progress B', 2),
      createLesson(progressCourse.id, 'Progress C', 3)
    ]);
    const enrollment = await prisma.enrollment.create({ data: { learnerId: learner.id, courseId: progressCourse.id } });
    await prisma.lessonProgress.createMany({ data: [
      { enrollmentId: enrollment.id, lessonId: lessonA.id, startedAt: new Date() },
      { enrollmentId: enrollment.id, lessonId: lessonB.id, startedAt: new Date() },
      { enrollmentId: enrollment.id, lessonId: lessonC.id, startedAt: new Date() }
    ] });

    await agentB.delete(`/api/courses/${progressCourse.id}/lessons/${lessonB.id}`).expect(403);
    await learnerAgent.delete(`/api/courses/${progressCourse.id}/lessons/${lessonB.id}`).expect(403);
    await agentA.delete(`/api/courses/${progressCourse.id}/lessons/${lessonB.id}`).expect(204);

    expect(await prisma.lesson.findUnique({ where: { id: lessonB.id } })).toBeNull();
    expect(await prisma.lessonProgress.count({ where: { lessonId: lessonB.id } })).toBe(0);
    expect(await prisma.lessonProgress.count({ where: { lessonId: { in: [lessonA.id, lessonC.id] } } })).toBe(2);
    const remaining = await prisma.lesson.findMany({ where: { courseId: progressCourse.id }, orderBy: { position: 'asc' } });
    expect(remaining.map((lesson) => [lesson.id, lesson.position])).toEqual([[lessonA.id, 1], [lessonC.id, 2]]);

    const reordered = await agentA.patch(`/api/courses/${progressCourse.id}/lessons/reorder`).send({ lessonIds: [lessonC.id, lessonA.id] }).expect(200);
    expect(reordered.body.lessons.map((lesson: { id: string; position: number }) => [lesson.id, lesson.position])).toEqual([[lessonC.id, 1], [lessonA.id, 2]]);
    expect(await prisma.lessonProgress.count({ where: { lessonId: { in: [lessonA.id, lessonC.id] } } })).toBe(2);
  });

  it('reorders a complete owned lesson set without recreating lessons and rejects invalid sets', async () => {
    const reorderCourse = await createCourse(instructorA.id, 'Reorder');
    const [one, two, three] = await Promise.all([
      createLesson(reorderCourse.id, 'One', 1),
      createLesson(reorderCourse.id, 'Two', 2),
      createLesson(reorderCourse.id, 'Three', 3)
    ]);
    const foreignLesson = await createLesson(courseB.id, 'Foreign', 1);
    await agentA.patch(`/api/courses/${reorderCourse.id}/lessons/reorder`).send({ lessonIds: [three.id, one.id, two.id] }).expect(200);
    const ordered = await agentA.get(`/api/courses/${reorderCourse.id}/lessons`).expect(200);
    expect(ordered.body.lessons.map((lesson: { id: string; position: number }) => [lesson.id, lesson.position])).toEqual([[three.id, 1], [one.id, 2], [two.id, 3]]);
    expect(new Set(ordered.body.lessons.map((lesson: { position: number }) => lesson.position)).size).toBe(3);

    await agentA.patch(`/api/courses/${reorderCourse.id}/lessons/reorder`).send({ lessonIds: [one.id, one.id, two.id] }).expect(400);
    await agentA.patch(`/api/courses/${reorderCourse.id}/lessons/reorder`).send({ lessonIds: [one.id, two.id] }).expect(400);
    await agentA.patch(`/api/courses/${reorderCourse.id}/lessons/reorder`).send({ lessonIds: [one.id, two.id, three.id, foreignLesson.id] }).expect(400);
    await agentB.patch(`/api/courses/${reorderCourse.id}/lessons/reorder`).send({ lessonIds: [one.id, two.id, three.id] }).expect(403);
    await learnerAgent.patch(`/api/courses/${reorderCourse.id}/lessons/reorder`).send({ lessonIds: [one.id, two.id, three.id] }).expect(403);
  });
});

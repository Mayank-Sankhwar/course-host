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
const password = 'ActivityIntegration123!';
const createdCourseIds: string[] = [];
const createdUserIds: string[] = [];
let instructorA: { id: string; email: string }; let instructorB: { id: string; email: string };
let learnerA: { id: string; email: string }; let learnerB: { id: string; email: string };
let courseA: { id: string }; let courseB: { id: string };
let app: ReturnType<typeof createApp>;
let instructorAAgent: ReturnType<typeof request.agent>; let instructorBAgent: ReturnType<typeof request.agent>; let learnerAAgent: ReturnType<typeof request.agent>;

async function lesson(courseId: string, position: number) {
  return prisma.lesson.create({ data: { courseId, title: `Lesson ${position}`, content: 'Activity test lesson.', position } });
}

integrationDescribe('activity history and inactivity alerts with PostgreSQL', () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    [instructorA, instructorB, learnerA, learnerB] = await Promise.all([
      prisma.user.create({ data: { email: `activity-instructor-a-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true, email: true } }),
      prisma.user.create({ data: { email: `activity-instructor-b-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true, email: true } }),
      prisma.user.create({ data: { email: `activity-learner-a-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true, email: true } }),
      prisma.user.create({ data: { email: `activity-learner-b-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true, email: true } })
    ]);
    createdUserIds.push(instructorA.id, instructorB.id, learnerA.id, learnerB.id);
    [courseA, courseB] = await Promise.all([
      prisma.course.create({ data: { instructorId: instructorA.id, title: `Activity A ${runId}`, description: 'Activity test course.', category: 'Testing', status: CourseStatus.PUBLISHED } }),
      prisma.course.create({ data: { instructorId: instructorB.id, title: `Activity B ${runId}`, description: 'Activity test course.', category: 'Testing', status: CourseStatus.PUBLISHED } })
    ]);
    createdCourseIds.push(courseA.id, courseB.id);
    app = createApp({ clientOrigin: 'http://localhost:5173', isProduction: false, sessionSecret: 'activity-test-session-secret-that-is-at-least-32-characters' });
    instructorAAgent = request.agent(app); instructorBAgent = request.agent(app); learnerAAgent = request.agent(app);
    await Promise.all([
      instructorAAgent.post('/api/auth/login').send({ email: instructorA.email, password }).expect(200),
      instructorBAgent.post('/api/auth/login').send({ email: instructorB.email, password }).expect(200),
      learnerAAgent.post('/api/auth/login').send({ email: learnerA.email, password }).expect(200)
    ]);
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.comment.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.lesson.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it('records one course-specific progress activity only when progress changes', async () => {
    const [one, two, other] = await Promise.all([lesson(courseA.id, 1), lesson(courseA.id, 2), lesson(courseB.id, 1)]);
    await prisma.enrollment.createMany({ data: [
      { courseId: courseA.id, learnerId: learnerA.id }, { courseId: courseB.id, learnerId: learnerA.id }
    ] });
    await learnerAAgent.post(`/api/my-courses/${courseA.id}/lessons/${one.id}/start`).send({}).expect(200);
    const first = await prisma.courseActivity.findUniqueOrThrow({ where: { courseId_learnerId: { courseId: courseA.id, learnerId: learnerA.id } } });
    await learnerAAgent.post(`/api/my-courses/${courseA.id}/lessons/${one.id}/start`).send({}).expect(200);
    expect(await prisma.courseActivity.count({ where: { courseId: courseA.id, learnerId: learnerA.id } })).toBe(1);
    await learnerAAgent.post(`/api/my-courses/${courseA.id}/lessons/${two.id}/complete`).send({}).expect(200);
    const updated = await prisma.courseActivity.findUniqueOrThrow({ where: { courseId_learnerId: { courseId: courseA.id, learnerId: learnerA.id } } });
    expect(updated.lastProgressAt.getTime()).toBeGreaterThanOrEqual(first.lastProgressAt.getTime());
    expect(await prisma.courseActivity.findUnique({ where: { courseId_learnerId: { courseId: courseB.id, learnerId: learnerA.id } } })).toBeNull();
    await learnerAAgent.post(`/api/my-courses/${courseB.id}/lessons/${other.id}/start`).send({}).expect(200);
    expect(await prisma.courseActivity.count({ where: { learnerId: learnerA.id } })).toBe(2);
  });

  it('surfaces only strict-more-than-14-day in-progress alerts and supports a new alert cycle after dismissal', async () => {
    const course = await prisma.course.create({ data: { instructorId: instructorA.id, title: `Alert ${runId}`, description: 'Alert test.', category: 'Testing', status: CourseStatus.PUBLISHED } });
    createdCourseIds.push(course.id);
    const [one, two] = await Promise.all([lesson(course.id, 1), lesson(course.id, 2)]);
    await prisma.enrollment.create({ data: { courseId: course.id, learnerId: learnerB.id, progressState: EnrollmentProgressState.IN_PROGRESS } });
    const exactlyFourteenDays = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 60_000);
    await prisma.courseActivity.create({ data: { courseId: course.id, learnerId: learnerB.id, lastProgressAt: exactlyFourteenDays } });
    expect((await instructorAAgent.get(`/api/courses/${course.id}/alerts`).expect(200)).body.alerts).toHaveLength(0);
    await prisma.courseActivity.update({ where: { courseId_learnerId: { courseId: course.id, learnerId: learnerB.id } }, data: { lastProgressAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 - 60_000) } });
    const inactive = await instructorAAgent.get(`/api/courses/${course.id}/alerts`).expect(200);
    expect(inactive.body.alerts).toHaveLength(1);
    await instructorAAgent.post(`/api/courses/${course.id}/alerts/${learnerB.id}/dismiss`).send({}).expect(204);
    expect((await instructorAAgent.get(`/api/courses/${course.id}/alerts`).expect(200)).body.alerts).toHaveLength(0);
    expect((await prisma.courseActivity.findUniqueOrThrow({ where: { courseId_learnerId: { courseId: course.id, learnerId: learnerB.id } } })).lastProgressAt.getTime()).toBeLessThan(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const learnerBAgent = request.agent(app);
    await learnerBAgent.post('/api/auth/login').send({ email: learnerB.email, password }).expect(200);
    await learnerBAgent.post(`/api/my-courses/${course.id}/lessons/${one.id}/start`).send({}).expect(200);
    expect(await prisma.alertDismissal.count({ where: { courseId: course.id, learnerId: learnerB.id } })).toBe(0);
    await prisma.courseActivity.update({ where: { courseId_learnerId: { courseId: course.id, learnerId: learnerB.id } }, data: { lastProgressAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) } });
    expect((await instructorAAgent.get(`/api/courses/${course.id}/alerts`).expect(200)).body.alerts).toHaveLength(1);
    await learnerBAgent.post(`/api/my-courses/${course.id}/lessons/${two.id}/complete`).send({}).expect(200);
  });

  it('enforces session role and ownership and excludes archived courses without mutating history', async () => {
    await request(app).get(`/api/courses/${courseA.id}/activity`).expect(401);
    await learnerAAgent.get(`/api/courses/${courseA.id}/activity`).expect(403);
    await instructorBAgent.get(`/api/courses/${courseA.id}/activity`).expect(403);
    await instructorBAgent.get(`/api/courses/${courseA.id}/alerts`).expect(403);
    await instructorBAgent.post(`/api/courses/${courseA.id}/alerts/${learnerA.id}/dismiss`).send({}).expect(403);
    const before = await prisma.courseActivity.findUniqueOrThrow({ where: { courseId_learnerId: { courseId: courseA.id, learnerId: learnerA.id } } });
    await prisma.course.update({ where: { id: courseA.id }, data: { status: CourseStatus.ARCHIVED } });
    expect((await instructorAAgent.get(`/api/courses/${courseA.id}/alerts`).expect(200)).body.alerts).toHaveLength(0);
    const after = await prisma.courseActivity.findUniqueOrThrow({ where: { courseId_learnerId: { courseId: courseA.id, learnerId: learnerA.id } } });
    expect(after.lastProgressAt).toEqual(before.lastProgressAt);
    await prisma.course.update({ where: { id: courseA.id }, data: { status: CourseStatus.PUBLISHED } });
  });

  it('writes immutable safe history for course lifecycle and comments and does not expose it to learners', async () => {
    const created = await instructorAAgent.post('/api/courses').send({ title: `Logged ${runId}`, description: 'History test.', category: 'Testing' }).expect(201);
    const courseId = created.body.course.id as string; createdCourseIds.push(courseId);
    await instructorAAgent.patch(`/api/courses/${courseId}`).send({ title: `Logged edited ${runId}` }).expect(200);
    const lessonRow = await lesson(courseId, 1);
    await instructorAAgent.post(`/api/courses/${courseId}/publish`).expect(200);
    await prisma.enrollment.create({ data: { courseId, learnerId: learnerA.id } });
    await learnerAAgent.post(`/api/courses/${courseId}/comments`).send({ body: 'A recorded course comment.' }).expect(201);
    await instructorAAgent.post(`/api/courses/${courseId}/archive`).expect(200);
    await instructorAAgent.post(`/api/courses/${courseId}/restore`).expect(200);
    const logs = await instructorAAgent.get(`/api/courses/${courseId}/activity-log`).expect(200);
    expect(logs.body.records.map((record: { type: string }) => record.type)).toEqual(expect.arrayContaining(['COURSE_CREATED', 'COURSE_UPDATED', 'COURSE_PUBLISHED', 'COMMENT_CREATED', 'COURSE_ARCHIVED', 'COURSE_RESTORED']));
    expect(JSON.stringify(logs.body)).not.toContain('passwordHash');
    await learnerAAgent.get(`/api/courses/${courseId}/activity-log`).expect(403);
    expect(lessonRow.id).toBeTruthy();
  });
});

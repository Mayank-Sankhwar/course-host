import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { CourseStatus, Role } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { hashPassword } from '../auth/password.js';
import { prisma } from '../db/prisma.js';

const integrationDescribe = process.env.DATABASE_URL ? describe : describe.skip;
const runId = randomUUID();
const password = 'EnrollmentIntegration123!';
const createdCourseIds: string[] = [];
const createdUserIds: string[] = [];
let instructorA: { id: string; email: string };
let instructorB: { id: string; email: string };
let learnerA: { id: string; email: string };
let learnerB: { id: string; email: string };
let learnerC: { id: string; email: string };
let learnerD: { id: string; email: string };
let courseA: { id: string };
let courseB: { id: string };
let draftA: { id: string };
let app: ReturnType<typeof createApp>;
let instructorAAgent: ReturnType<typeof request.agent>;
let instructorBAgent: ReturnType<typeof request.agent>;
let learnerAAgent: ReturnType<typeof request.agent>;

async function createCourse(instructorId: string, label: string, status: CourseStatus = CourseStatus.PUBLISHED) {
  const course = await prisma.course.create({ data: { instructorId, title: `${label}-${runId}`, description: 'Enrollment integration course.', category: 'Testing', status } });
  createdCourseIds.push(course.id);
  return course;
}

function csvUpload(agent: ReturnType<typeof request.agent>, courseId: string, body: Buffer | string, filename = 'learners.csv') {
  return agent.post(`/api/courses/${courseId}/enrollments/bulk`).attach('file', Buffer.isBuffer(body) ? body : Buffer.from(body), { filename, contentType: 'text/csv' });
}

integrationDescribe('instructor enrollment API with PostgreSQL', () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    [instructorA, instructorB, learnerA, learnerB, learnerC, learnerD] = await Promise.all([
      prisma.user.create({ data: { email: `enrol-instructor-a-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true, email: true } }),
      prisma.user.create({ data: { email: `enrol-instructor-b-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true, email: true } }),
      prisma.user.create({ data: { email: `enrol-learner-a-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true, email: true } }),
      prisma.user.create({ data: { email: `enrol-learner-b-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true, email: true } }),
      prisma.user.create({ data: { email: `enrol-learner-c-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true, email: true } }),
      prisma.user.create({ data: { email: `enrol-learner-d-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true, email: true } })
    ]);
    createdUserIds.push(instructorA.id, instructorB.id, learnerA.id, learnerB.id, learnerC.id, learnerD.id);
    [courseA, courseB, draftA] = await Promise.all([
      createCourse(instructorA.id, 'Course A'), createCourse(instructorB.id, 'Course B'), createCourse(instructorA.id, 'Draft A', CourseStatus.DRAFT)
    ]);
    app = createApp({ clientOrigin: 'http://localhost:5173', isProduction: false, sessionSecret: 'enrollment-test-session-secret-that-is-at-least-32-characters' });
    instructorAAgent = request.agent(app); instructorBAgent = request.agent(app); learnerAAgent = request.agent(app);
    await Promise.all([
      instructorAAgent.post('/api/auth/login').send({ email: instructorA.email, password }).expect(200),
      instructorBAgent.post('/api/auth/login').send({ email: instructorB.email, password }).expect(200),
      learnerAAgent.post('/api/auth/login').send({ email: learnerA.email, password }).expect(200)
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

  it('creates one safe learner enrollment for an owner instructor and blocks IDOR or role abuse', async () => {
    await request(app).post(`/api/courses/${courseA.id}/enrollments`).send({ email: learnerA.email }).expect(401);
    await learnerAAgent.post(`/api/courses/${courseA.id}/enrollments`).send({ email: learnerA.email }).expect(403);
    await instructorAAgent.post(`/api/courses/${courseB.id}/enrollments`).send({ email: learnerA.email }).expect(403);
    await instructorAAgent.post(`/api/courses/${draftA.id}/enrollments`).send({ email: learnerA.email }).expect(409);
    await instructorAAgent.post(`/api/courses/${courseA.id}/enrollments`).send({ email: instructorB.email }).expect(400);
    await instructorAAgent.post(`/api/courses/${courseA.id}/enrollments`).send({ email: `missing-${runId}@test.local` }).expect(404);
    await instructorAAgent.post(`/api/courses/${courseA.id}/enrollments`).send({ email: learnerA.email, learnerId: learnerB.id }).expect(400);
    await instructorAAgent.post(`/api/courses/${courseA.id}/enrollments`).send({ email: learnerA.email, instructorId: instructorB.id }).expect(400);

    const created = await instructorAAgent.post(`/api/courses/${courseA.id}/enrollments`).send({ email: ` ${learnerA.email.toUpperCase()} ` }).expect(201);
    expect(created.body.enrollment).toMatchObject({ courseId: courseA.id, learner: { id: learnerA.id, email: learnerA.email } });
    expect(JSON.stringify(created.body)).not.toContain('passwordHash');
    expect(await prisma.lessonProgress.count({ where: { enrollment: { learnerId: learnerA.id, courseId: courseA.id } } })).toBe(0);
    await instructorAAgent.post(`/api/courses/${courseA.id}/enrollments`).send({ email: learnerA.email }).expect(409);
    const myCourses = await learnerAAgent.get('/api/me/courses').expect(200);
    expect(myCourses.body.courses.some((item: { course: { id: string } }) => item.course.id === courseA.id)).toBe(true);
  });

  it('handles concurrent individual duplicates with the database unique constraint', async () => {
    const responses = await Promise.all([
      instructorAAgent.post(`/api/courses/${courseA.id}/enrollments`).send({ email: learnerD.email }),
      instructorAAgent.post(`/api/courses/${courseA.id}/enrollments`).send({ email: learnerD.email })
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.enrollment.count({ where: { learnerId: learnerD.id, courseId: courseA.id } })).toBe(1);
  });

  it('processes bounded CSV rows independently with deterministic results and partial success', async () => {
    await instructorAAgent.post(`/api/courses/${courseA.id}/enrollments`).send({ email: learnerB.email }).expect(201);
    const csv = [
      'email',
      `  ${learnerC.email.toUpperCase()}  `,
      learnerB.email,
      `missing-${runId}@test.local`,
      'invalid-address',
      learnerC.email,
      '',
      instructorB.email
    ].join('\r\n');
    const response = await csvUpload(instructorAAgent, courseA.id, csv).expect(200);
    expect(response.body.summary).toMatchObject({ total: 6, added: 1, alreadyEnrolled: 1, learnerNotFound: 1, invalidEmail: 1, duplicateInFile: 1, notALearner: 1 });
    expect(response.body.results.map((item: { status: string }) => item.status)).toEqual(['ADDED', 'ALREADY_ENROLLED', 'LEARNER_NOT_FOUND', 'INVALID_EMAIL', 'DUPLICATE_IN_FILE', 'NOT_A_LEARNER']);
    expect(response.body.results[0].email).toBe(learnerC.email);
    expect(await prisma.enrollment.count({ where: { courseId: courseA.id, learnerId: learnerC.id } })).toBe(1);
    await csvUpload(instructorAAgent, courseA.id, 'email\r\n').expect(400);
    await instructorAAgent.post(`/api/courses/${courseA.id}/enrollments/bulk`).expect(400);
    const tooMany = `email\n${Array.from({ length: 1001 }, (_, index) => `row${index}@example.test`).join('\n')}`;
    await csvUpload(instructorAAgent, courseA.id, tooMany).expect(400);
    await csvUpload(instructorAAgent, courseA.id, Buffer.alloc(256 * 1024 + 1, 65)).expect(413);
    await csvUpload(instructorBAgent, courseA.id, `email\n${learnerA.email}`).expect(403);
    await learnerAAgent.post(`/api/courses/${courseA.id}/enrollments/bulk`).attach('file', Buffer.from(`email\n${learnerA.email}`), { filename: 'learners.csv', contentType: 'text/csv' }).expect(403);
  });

  it('lists only an owner course learners with bounded pagination and safe fields', async () => {
    const first = await instructorAAgent.get(`/api/courses/${courseA.id}/enrollments?page=1&limit=2`).expect(200);
    const second = await instructorAAgent.get(`/api/courses/${courseA.id}/enrollments?page=2&limit=2`).expect(200);
    expect(first.body).toMatchObject({ total: 4, totalPages: 2, page: 1, limit: 2 });
    expect(first.body.enrollments).toHaveLength(2);
    expect(second.body.enrollments).toHaveLength(2);
    expect(new Set([...first.body.enrollments, ...second.body.enrollments].map((item: { learner: { id: string } }) => item.learner.id)).size).toBe(4);
    expect(JSON.stringify(first.body)).not.toContain('passwordHash');
    await instructorBAgent.get(`/api/courses/${courseA.id}/enrollments`).expect(403);
    await learnerAAgent.get(`/api/courses/${courseA.id}/enrollments`).expect(403);
    await request(app).get(`/api/courses/${courseA.id}/enrollments`).expect(401);
    await instructorAAgent.get(`/api/courses/${courseA.id}/enrollments?limit=999`).expect(400);
    await instructorAAgent.post(`/api/courses/${courseA.id}/archive`).expect(200);
    await instructorAAgent.get(`/api/courses/${courseA.id}/enrollments`).expect(200);
    await instructorAAgent.get(`/api/courses/${courseA.id}/enrollments/export.csv`).expect(200);
  });

  it('exports all owner-course learner progress as escaped, read-only CSV', async () => {
    const course = await createCourse(instructorA.id, 'Export course');
    const [first, second] = await Promise.all([
      prisma.lesson.create({ data: { courseId: course.id, title: 'First', content: 'First content', position: 1 } }),
      prisma.lesson.create({ data: { courseId: course.id, title: 'Second', content: 'Second content', position: 2 } })
    ]);
    const unusual = await prisma.user.create({ data: { email: '=formula,"learner"@test.local', passwordHash: await hashPassword(password), role: Role.LEARNER }, select: { id: true, email: true } });
    createdUserIds.push(unusual.id);
    await prisma.enrollment.createMany({ data: [
      { courseId: course.id, learnerId: learnerA.id }, { courseId: course.id, learnerId: learnerB.id },
      { courseId: course.id, learnerId: learnerC.id }, { courseId: course.id, learnerId: unusual.id }
    ] });
    const enrollments = await prisma.enrollment.findMany({ where: { courseId: course.id }, select: { id: true, learnerId: true } });
    const enrollmentId = (learnerId: string) => enrollments.find((item) => item.learnerId === learnerId)!.id;
    await prisma.lessonProgress.createMany({ data: [
      { enrollmentId: enrollmentId(learnerB.id), lessonId: first.id, startedAt: new Date() },
      { enrollmentId: enrollmentId(learnerC.id), lessonId: first.id, startedAt: new Date(), completedAt: new Date() },
      { enrollmentId: enrollmentId(learnerC.id), lessonId: second.id, startedAt: new Date(), completedAt: new Date() }
    ] });
    const activityBefore = await prisma.courseActivity.count({ where: { courseId: course.id } });
    const progressBefore = await prisma.lessonProgress.count({ where: { enrollment: { courseId: course.id } } });
    await request(app).get(`/api/courses/${course.id}/enrollments/export.csv`).expect(401);
    await learnerAAgent.get(`/api/courses/${course.id}/enrollments/export.csv`).expect(403);
    await instructorBAgent.get(`/api/courses/${course.id}/enrollments/export.csv?instructorId=${instructorA.id}`).expect(403);
    await instructorAAgent.get('/api/courses/missing/enrollments/export.csv').expect(404);
    const response = await instructorAAgent.get(`/api/courses/${course.id}/enrollments/export.csv`).expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe(`attachment; filename="course-progress-${course.id}.csv"`);
    expect(response.text).toContain('learner_email,progress_state,completed_lessons,total_lessons,completion_percentage');
    expect(response.text).toContain(`${learnerA.email},NOT_STARTED,0,2,0`);
    expect(response.text).toContain(`${learnerB.email},IN_PROGRESS,0,2,0`);
    expect(response.text).toContain(`${learnerC.email},COMPLETED,2,2,100`);
    expect(response.text).toContain(`"'=formula,""learner""@test.local"`);
    expect(response.text).not.toContain('passwordHash');
    expect(await prisma.courseActivity.count({ where: { courseId: course.id } })).toBe(activityBefore);
    expect(await prisma.lessonProgress.count({ where: { enrollment: { courseId: course.id } } })).toBe(progressBefore);
    await instructorAAgent.patch(`/api/courses/${course.id}/lessons/reorder`).send({ lessonIds: [second.id, first.id] }).expect(200);
    expect((await instructorAAgent.get(`/api/courses/${course.id}/enrollments/export.csv`).expect(200)).text).toContain(`${learnerC.email},COMPLETED,2,2,100`);
    await instructorAAgent.delete(`/api/courses/${course.id}/lessons/${second.id}`).expect(204);
    expect((await instructorAAgent.get(`/api/courses/${course.id}/enrollments/export.csv`).expect(200)).text).toContain(`${learnerC.email},COMPLETED,1,1,100`);
    const third = await instructorAAgent.post(`/api/courses/${course.id}/lessons`).send({ title: 'Third', content: 'Third content' }).expect(201);
    expect((await instructorAAgent.get(`/api/courses/${course.id}/enrollments/export.csv`).expect(200)).text).toContain(`${learnerC.email},IN_PROGRESS,1,2,50`);
    await instructorAAgent.get(`/api/courses/${draftA.id}/enrollments/export.csv`).expect(200).expect('Content-Type', /text\/csv/);
  });
});

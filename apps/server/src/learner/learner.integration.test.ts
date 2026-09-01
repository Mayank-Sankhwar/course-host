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
const password = 'LearnerIntegration123!';
const createdCourseIds: string[] = [];
const createdUserIds: string[] = [];

let instructor: { id: string };
let learnerA: { id: string };
let learnerB: { id: string };
let app: ReturnType<typeof createApp>;
let instructorAgent: ReturnType<typeof request.agent>;
let learnerAAgent: ReturnType<typeof request.agent>;
let learnerBAgent: ReturnType<typeof request.agent>;

async function createCourse(label: string, status: CourseStatus = CourseStatus.PUBLISHED) {
  const course = await prisma.course.create({
    data: { instructorId: instructor.id, title: `${label}-${runId}`, description: 'Learner integration test course.', category: 'Testing', status }
  });
  createdCourseIds.push(course.id);
  return course;
}

async function createLesson(courseId: string, title: string, position: number) {
  return prisma.lesson.create({ data: { courseId, title, content: `${title} content`, position } });
}

async function enroll(courseId: string, agent = learnerAAgent) {
  return agent.post(`/api/courses/${courseId}/enroll`).send({}).expect(201);
}

integrationDescribe('learner enrollment and progress API with PostgreSQL', () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    [instructor, learnerA, learnerB] = await Promise.all([
      prisma.user.create({ data: { email: `progress-instructor-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true } }),
      prisma.user.create({ data: { email: `progress-learner-a-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true } }),
      prisma.user.create({ data: { email: `progress-learner-b-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true } })
    ]);
    createdUserIds.push(instructor.id, learnerA.id, learnerB.id);
    app = createApp({ clientOrigin: 'http://localhost:5173', isProduction: false, sessionSecret: 'learner-test-session-secret-that-is-at-least-32-characters' });
    instructorAgent = request.agent(app);
    learnerAAgent = request.agent(app);
    learnerBAgent = request.agent(app);
    await Promise.all([
      instructorAgent.post('/api/auth/login').send({ email: `progress-instructor-${runId}@test.local`, password }).expect(200),
      learnerAAgent.post('/api/auth/login').send({ email: `progress-learner-a-${runId}@test.local`, password }).expect(200),
      learnerBAgent.post('/api/auth/login').send({ email: `progress-learner-b-${runId}@test.local`, password }).expect(200)
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

  it('enrolls only the authenticated learner in a published course and rejects hostile inputs', async () => {
    const published = await createCourse('Published enrollment');
    const draft = await createCourse('Draft enrollment', CourseStatus.DRAFT);
    const archived = await createCourse('Archived enrollment', CourseStatus.ARCHIVED);
    await createLesson(published.id, 'Published lesson', 1);

    await request(app).post(`/api/courses/${published.id}/enroll`).send({}).expect(401);
    await instructorAgent.post(`/api/courses/${published.id}/enroll`).send({}).expect(403);
    await learnerAAgent.post(`/api/courses/${draft.id}/enroll`).send({}).expect(403);
    await learnerAAgent.post(`/api/courses/${archived.id}/enroll`).send({}).expect(403);
    await learnerAAgent.post(`/api/courses/${published.id}/enroll`).send({ learnerId: learnerB.id }).expect(400);
    const available = await learnerAAgent.get('/api/available-courses').expect(200);
    expect(available.body.courses.map((course: { id: string }) => course.id)).toContain(published.id);
    expect(available.body.courses.map((course: { id: string }) => course.id)).not.toContain(draft.id);
    expect(available.body.courses.map((course: { id: string }) => course.id)).not.toContain(archived.id);

    const response = await enroll(published.id);
    expect(response.body.enrollment).toMatchObject({ courseId: published.id, progressState: EnrollmentProgressState.NOT_STARTED });
    expect(response.body.enrollment.id).toBeTruthy();
    expect(await prisma.enrollment.findUnique({ where: { learnerId_courseId: { learnerId: learnerA.id, courseId: published.id } } })).toMatchObject({ learnerId: learnerA.id, courseId: published.id });
    expect(await prisma.enrollment.count({ where: { courseId: published.id } })).toBe(1);
    await learnerAAgent.post(`/api/courses/${published.id}/enroll`).send({}).expect(409);
    expect(await prisma.enrollment.count({ where: { courseId: published.id } })).toBe(1);
  });

  it('returns only the session learner enrolled courses and blocks unenrolled or archived lesson access', async () => {
    const course = await createCourse('Access and ordering');
    const [second, first] = await Promise.all([createLesson(course.id, 'Second', 2), createLesson(course.id, 'First', 1)]);
    await enroll(course.id);
    await enroll(course.id, learnerBAgent);
    const own = await learnerAAgent.get(`/api/me/courses?learnerId=${learnerB.id}`).expect(200);
    const ownItem = own.body.courses.find((item: { course: { id: string } }) => item.course.id === course.id);
    expect(ownItem).toBeDefined();
    expect(ownItem.enrollment.courseId).toBe(course.id);
    expect(ownItem.enrollment.id).not.toBe(
      (await prisma.enrollment.findUniqueOrThrow({ where: { learnerId_courseId: { learnerId: learnerB.id, courseId: course.id } } })).id
    );
    const lessons = await learnerAAgent.get(`/api/my-courses/${course.id}/lessons`).expect(200);
    expect(lessons.body.lessons.map((lesson: { id: string }) => lesson.id)).toEqual([first.id, second.id]);
    await learnerBAgent.get(`/api/my-courses/${(await createCourse('Unenrolled')).id}/lessons`).expect(403);
    await instructorAgent.get(`/api/my-courses/${course.id}/lessons`).expect(403);

    await instructorAgent.post(`/api/courses/${course.id}/archive`).expect(200);
    await learnerAAgent.get(`/api/my-courses/${course.id}/lessons`).expect(403).expect(({ body }) => {
      expect(body.error).toBe('This course was archived by the instructor.');
    });
    expect(await prisma.enrollment.count({ where: { courseId: course.id } })).toBe(2);
    await instructorAgent.post(`/api/courses/${course.id}/restore`).expect(200);
    await learnerAAgent.get(`/api/my-courses/${course.id}/lessons`).expect(200);
  });

  it('derives lesson and course progress from server timestamps without regression or duplicate rows', async () => {
    const course = await createCourse('Progress transitions');
    const [one, two, otherCourseLesson] = await Promise.all([
      createLesson(course.id, 'One', 1),
      createLesson(course.id, 'Two', 2),
      createLesson((await createCourse('Other lesson')).id, 'Other', 1)
    ]);
    await enroll(course.id);
    let progress = await learnerAAgent.get(`/api/my-courses/${course.id}/progress`).expect(200);
    expect(progress.body.courseProgress).toMatchObject({ state: 'NOT_STARTED', completedLessons: 0, totalLessons: 2, completionPercentage: 0 });
    expect(progress.body.lessons.map((lesson: { progressState: string }) => lesson.progressState)).toEqual(['NOT_STARTED', 'NOT_STARTED']);
    await learnerAAgent.post(`/api/my-courses/${course.id}/lessons/${one.id}/start`).send({ startedAt: '2000-01-01', state: 'COMPLETED' }).expect(400);
    await learnerAAgent.post(`/api/my-courses/${course.id}/lessons/${one.id}/start`).send({}).expect(200);
    progress = await learnerAAgent.get(`/api/my-courses/${course.id}/progress`).expect(200);
    expect(progress.body.lessons.find((lesson: { id: string }) => lesson.id === one.id).progressState).toBe('IN_PROGRESS');
    expect(progress.body.courseProgress).toMatchObject({ state: 'IN_PROGRESS', completionPercentage: 0 });
    await learnerAAgent.post(`/api/my-courses/${course.id}/lessons/${one.id}/complete`).send({}).expect(200);
    const currentEnrollment = await prisma.enrollment.findUniqueOrThrow({ where: { learnerId_courseId: { learnerId: learnerA.id, courseId: course.id } } });
    const completed = await prisma.lessonProgress.findUniqueOrThrow({ where: { enrollmentId_lessonId: { enrollmentId: currentEnrollment.id, lessonId: one.id } } });
    expect(completed.startedAt).not.toBeNull();
    expect(completed.completedAt).not.toBeNull();
    await learnerAAgent.post(`/api/my-courses/${course.id}/lessons/${one.id}/start`).send({}).expect(200);
    const revisited = await prisma.lessonProgress.findUniqueOrThrow({ where: { id: completed.id } });
    expect(revisited.completedAt).toEqual(completed.completedAt);
    await learnerAAgent.post(`/api/my-courses/${course.id}/lessons/${otherCourseLesson.id}/complete`).send({}).expect(404);
    await learnerBAgent.post(`/api/my-courses/${course.id}/lessons/${one.id}/complete`).send({}).expect(403);
    await Promise.all([learnerAAgent.post(`/api/my-courses/${course.id}/lessons/${two.id}/complete`).send({}), learnerAAgent.post(`/api/my-courses/${course.id}/lessons/${two.id}/complete`).send({})]);
    expect(await prisma.lessonProgress.count({ where: { lessonId: two.id } })).toBe(1);
    progress = await learnerAAgent.get(`/api/my-courses/${course.id}/progress`).expect(200);
    expect(progress.body.courseProgress).toMatchObject({ state: 'COMPLETED', completedLessons: 2, totalLessons: 2, completionPercentage: 100 });
  });

  it('preserves progress by stable lesson ID across reorder, deletion, addition, archive, and restore', async () => {
    const course = await createCourse('Current lesson set');
    const [a, b, c] = await Promise.all([createLesson(course.id, 'A', 1), createLesson(course.id, 'B', 2), createLesson(course.id, 'C', 3)]);
    await enroll(course.id);
    await learnerAAgent.post(`/api/my-courses/${course.id}/lessons/${a.id}/complete`).send({}).expect(200);
    await learnerAAgent.post(`/api/my-courses/${course.id}/lessons/${b.id}/start`).send({}).expect(200);
    await instructorAgent.patch(`/api/courses/${course.id}/lessons/reorder`).send({ lessonIds: [c.id, a.id, b.id] }).expect(200);
    let progress = await learnerAAgent.get(`/api/my-courses/${course.id}/progress`).expect(200);
    expect(progress.body.lessons.map((lesson: { id: string; progressState: string }) => [lesson.id, lesson.progressState])).toEqual([[c.id, 'NOT_STARTED'], [a.id, 'COMPLETED'], [b.id, 'IN_PROGRESS']]);
    const enrollment = await prisma.enrollment.findUniqueOrThrow({ where: { learnerId_courseId: { learnerId: learnerA.id, courseId: course.id } } });
    const progressA = await prisma.lessonProgress.findUniqueOrThrow({ where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: a.id } } });
    await learnerAAgent.post(`/api/my-courses/${course.id}/lessons/${b.id}/complete`).send({}).expect(200);
    await learnerAAgent.post(`/api/my-courses/${course.id}/lessons/${c.id}/complete`).send({}).expect(200);
    await instructorAgent.delete(`/api/courses/${course.id}/lessons/${c.id}`).expect(204);
    progress = await learnerAAgent.get(`/api/my-courses/${course.id}/progress`).expect(200);
    expect(progress.body.courseProgress).toMatchObject({ completionPercentage: 100, completedLessons: 2, totalLessons: 2 });
    expect(await prisma.lessonProgress.findUnique({ where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId: c.id } } })).toBeNull();
    expect(await prisma.lessonProgress.findUnique({ where: { id: progressA.id } })).toMatchObject({ lessonId: a.id });
    const added = await instructorAgent.post(`/api/courses/${course.id}/lessons`).send({ title: 'D', content: 'New lesson content' }).expect(201);
    progress = await learnerAAgent.get(`/api/my-courses/${course.id}/progress`).expect(200);
    expect(progress.body.courseProgress).toMatchObject({ completionPercentage: 66.67, completedLessons: 2, totalLessons: 3, state: 'IN_PROGRESS' });
    expect(progress.body.lessons.find((lesson: { id: string }) => lesson.id === added.body.lesson.id).progressState).toBe('NOT_STARTED');
    await instructorAgent.post(`/api/courses/${course.id}/archive`).expect(200);
    const archivedProgress = await prisma.lessonProgress.findUniqueOrThrow({ where: { id: progressA.id } });
    expect(archivedProgress.completedAt).toEqual(progressA.completedAt);
    expect(await prisma.enrollment.findUnique({ where: { id: enrollment.id } })).not.toBeNull();
    await instructorAgent.post(`/api/courses/${course.id}/restore`).expect(200);
    progress = await learnerAAgent.get(`/api/my-courses/${course.id}/progress`).expect(200);
    expect(progress.body.lessons.find((lesson: { id: string }) => lesson.id === a.id).progressState).toBe('COMPLETED');
  });
});

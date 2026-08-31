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
const password = 'CommentIntegration123!';
const createdCourseIds: string[] = [];
const createdUserIds: string[] = [];

let instructorA: { id: string };
let instructorB: { id: string };
let learnerA: { id: string };
let learnerB: { id: string };
let learnerC: { id: string };
let courseA: { id: string };
let app: ReturnType<typeof createApp>;
let instructorAAgent: ReturnType<typeof request.agent>;
let instructorBAgent: ReturnType<typeof request.agent>;
let learnerAAgent: ReturnType<typeof request.agent>;
let learnerBAgent: ReturnType<typeof request.agent>;
let learnerCAgent: ReturnType<typeof request.agent>;

integrationDescribe('course comments API with PostgreSQL', () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    [instructorA, instructorB, learnerA, learnerB, learnerC] = await Promise.all([
      prisma.user.create({ data: { email: `comment-instructor-a-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true } }),
      prisma.user.create({ data: { email: `comment-instructor-b-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true } }),
      prisma.user.create({ data: { email: `comment-learner-a-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true } }),
      prisma.user.create({ data: { email: `comment-learner-b-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true } }),
      prisma.user.create({ data: { email: `comment-learner-c-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true } })
    ]);
    createdUserIds.push(instructorA.id, instructorB.id, learnerA.id, learnerB.id, learnerC.id);
    courseA = await prisma.course.create({ data: { instructorId: instructorA.id, title: `Comment course ${runId}`, description: 'Comment test course.', category: 'Testing', status: CourseStatus.PUBLISHED } });
    createdCourseIds.push(courseA.id);
    await prisma.enrollment.createMany({ data: [{ learnerId: learnerA.id, courseId: courseA.id }, { learnerId: learnerB.id, courseId: courseA.id }] });
    app = createApp({ clientOrigin: 'http://localhost:5173', isProduction: false, sessionSecret: 'comment-test-session-secret-that-is-at-least-32-characters' });
    [instructorAAgent, instructorBAgent, learnerAAgent, learnerBAgent, learnerCAgent] = [instructorA, instructorB, learnerA, learnerB, learnerC].map(() => request.agent(app));
    await Promise.all([
      instructorAAgent.post('/api/auth/login').send({ email: `comment-instructor-a-${runId}@test.local`, password }).expect(200),
      instructorBAgent.post('/api/auth/login').send({ email: `comment-instructor-b-${runId}@test.local`, password }).expect(200),
      learnerAAgent.post('/api/auth/login').send({ email: `comment-learner-a-${runId}@test.local`, password }).expect(200),
      learnerBAgent.post('/api/auth/login').send({ email: `comment-learner-b-${runId}@test.local`, password }).expect(200),
      learnerCAgent.post('/api/auth/login').send({ email: `comment-learner-c-${runId}@test.local`, password }).expect(200)
    ]);
  });

  afterAll(async () => {
    await prisma.comment.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.lessonProgress.deleteMany({ where: { enrollment: { courseId: { in: createdCourseIds } } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.lesson.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it('allows only enrolled learners and the course owner to read and create course-level comments', async () => {
    await request(app).get(`/api/courses/${courseA.id}/comments`).expect(401);
    await request(app).post(`/api/courses/${courseA.id}/comments`).send({ body: 'Unauthenticated' }).expect(401);
    await learnerCAgent.get(`/api/courses/${courseA.id}/comments`).expect(403);
    await learnerCAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: 'Not enrolled' }).expect(403);
    await instructorBAgent.get(`/api/courses/${courseA.id}/comments`).expect(403);
    await instructorBAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: 'Not owner' }).expect(403);

    const learnerComment = await learnerAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: '  Learner A comment.  ' }).expect(201);
    expect(learnerComment.body.comment).toMatchObject({ courseId: courseA.id, body: 'Learner A comment.', author: { id: learnerA.id, email: `comment-learner-a-${runId}@test.local`, role: Role.LEARNER } });
    expect(learnerComment.body.comment).not.toHaveProperty('passwordHash');
    await learnerAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: 'Legitimate', authorId: learnerB.id }).expect(400);
    const learnerBComment = await learnerBAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: 'Learner B comment.' }).expect(201);
    const instructorComment = await instructorAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: 'Instructor comment.' }).expect(201);
    expect(learnerBComment.body.comment.author.id).toBe(learnerB.id);
    expect(instructorComment.body.comment.author.id).toBe(instructorA.id);
    const visibleToLearner = await learnerBAgent.get(`/api/courses/${courseA.id}/comments`).expect(200);
    expect(visibleToLearner.body.comments.map((comment: { id: string }) => comment.id)).toEqual([learnerComment.body.comment.id, learnerBComment.body.comment.id, instructorComment.body.comment.id]);
    expect(await instructorAAgent.get(`/api/courses/${courseA.id}/comments`)).toHaveProperty('status', 200);
    const concurrent = await Promise.all([
      learnerAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: 'Concurrent learner comment.' }),
      instructorAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: 'Concurrent instructor comment.' })
    ]);
    expect(concurrent.map((response) => response.status)).toEqual([201, 201]);
    expect(new Set(concurrent.map((response) => response.body.comment.id)).size).toBe(2);
  });

  it('enforces whitespace-token comment validation without impersonation or unlimited bodies', async () => {
    await learnerAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: '' }).expect(400);
    await learnerAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: ' \n\t ' }).expect(400);
    await learnerAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: 'one' }).expect(201);
    const fiftyWords = Array.from({ length: 50 }, (_, index) => `word${index + 1}`).join('  \n');
    await learnerAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: `  ${fiftyWords}  ` }).expect(201);
    const fiftyOneWords = Array.from({ length: 51 }, (_, index) => `word${index + 1}`).join(' ');
    await learnerAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: fiftyOneWords }).expect(400).expect(({ body }) => {
      expect(body.error).toBe('Comment body must contain at most 50 words.');
    });
  });

  it('uses createdAt/id chronology and preserves comments through archive and restore', async () => {
    const tieTime = new Date('2032-01-01T00:00:00.000Z');
    const [tieOne, tieTwo] = await Promise.all([
      prisma.comment.create({ data: { courseId: courseA.id, authorId: learnerA.id, content: 'Tie first', createdAt: tieTime } }),
      prisma.comment.create({ data: { courseId: courseA.id, authorId: learnerB.id, content: 'Tie second', createdAt: tieTime } })
    ]);
    const ordered = await learnerAAgent.get(`/api/courses/${courseA.id}/comments`).expect(200);
    const commentIds = ordered.body.comments.map((comment: { id: string }) => comment.id);
    expect(commentIds.filter((id: string) => id === tieOne.id || id === tieTwo.id)).toEqual([tieOne.id, tieTwo.id].sort());

    await instructorAAgent.post(`/api/courses/${courseA.id}/archive`).expect(200);
    expect(await prisma.comment.count({ where: { courseId: courseA.id } })).toBeGreaterThanOrEqual(6);
    await learnerAAgent.get(`/api/courses/${courseA.id}/comments`).expect(403);
    await learnerAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: 'Blocked after archive' }).expect(403);
    await instructorAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: 'Owner blocked after archive' }).expect(403);
    await instructorAAgent.get(`/api/courses/${courseA.id}/comments`).expect(200);
    await instructorAAgent.post(`/api/courses/${courseA.id}/restore`).expect(200);
    await learnerAAgent.get(`/api/courses/${courseA.id}/comments`).expect(200);
    await learnerAAgent.post(`/api/courses/${courseA.id}/comments`).send({ body: 'Comment after restore.' }).expect(201);
  });
});

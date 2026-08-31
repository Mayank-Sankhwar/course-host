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
const password = 'CatalogueIntegration123!';
const createdCourseIds: string[] = [];
const createdUserIds: string[] = [];
let createdAtOffset = 0;

let instructorA: { id: string };
let instructorB: { id: string };
let learner: { id: string };
let app: ReturnType<typeof createApp>;
let instructorAAgent: ReturnType<typeof request.agent>;
let instructorBAgent: ReturnType<typeof request.agent>;
let learnerAgent: ReturnType<typeof request.agent>;

async function createCourse(instructorId: string, title: string, options: { status?: CourseStatus; category?: string; description?: string } = {}) {
  const course = await prisma.course.create({
    data: {
      instructorId,
      title: `${title} ${runId}`,
      description: options.description ?? `Catalogue description ${runId}`,
      category: options.category ?? 'Programming',
      status: options.status ?? CourseStatus.PUBLISHED,
      createdAt: new Date(Date.UTC(2030, 0, 1, 0, 0, createdAtOffset++))
    }
  });
  createdCourseIds.push(course.id);
  return course;
}

async function addEnrollments(courseId: string, count: number) {
  const passwordHash = await hashPassword(password);
  for (let index = 0; index < count; index += 1) {
    const user = await prisma.user.create({
      data: { email: `catalogue-enrollee-${runId}-${courseId}-${index}@test.local`, passwordHash, role: Role.LEARNER },
      select: { id: true }
    });
    createdUserIds.push(user.id);
    await prisma.enrollment.create({ data: { learnerId: user.id, courseId } });
  }
}

function ids(response: { body: { courses: { id: string }[] } }) {
  return response.body.courses.map((course) => course.id);
}

integrationDescribe('full course catalogue API with PostgreSQL', () => {
  beforeAll(async () => {
    const passwordHash = await hashPassword(password);
    [instructorA, instructorB, learner] = await Promise.all([
      prisma.user.create({ data: { email: `catalogue-instructor-a-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true } }),
      prisma.user.create({ data: { email: `catalogue-instructor-b-${runId}@test.local`, passwordHash, role: Role.INSTRUCTOR }, select: { id: true } }),
      prisma.user.create({ data: { email: `catalogue-learner-${runId}@test.local`, passwordHash, role: Role.LEARNER }, select: { id: true } })
    ]);
    createdUserIds.push(instructorA.id, instructorB.id, learner.id);
    app = createApp({ clientOrigin: 'http://localhost:5173', isProduction: false, sessionSecret: 'catalogue-test-session-secret-that-is-at-least-32-characters' });
    instructorAAgent = request.agent(app);
    instructorBAgent = request.agent(app);
    learnerAgent = request.agent(app);
    await Promise.all([
      instructorAAgent.post('/api/auth/login').send({ email: `catalogue-instructor-a-${runId}@test.local`, password }).expect(200),
      instructorBAgent.post('/api/auth/login').send({ email: `catalogue-instructor-b-${runId}@test.local`, password }).expect(200),
      learnerAgent.post('/api/auth/login').send({ email: `catalogue-learner-${runId}@test.local`, password }).expect(200)
    ]);
  });

  afterAll(async () => {
    await prisma.lessonProgress.deleteMany({ where: { enrollment: { courseId: { in: createdCourseIds } } } });
    await prisma.enrollment.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.lesson.deleteMany({ where: { courseId: { in: createdCourseIds } } });
    await prisma.course.deleteMany({ where: { id: { in: createdCourseIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it('enforces learner published-only visibility while supporting database search and filters', async () => {
    const publishedTitle = await createCourse(instructorA.id, 'React title catalogue', { category: 'Engineering' });
    const publishedDescription = await createCourse(instructorB.id, 'Description catalogue', { category: 'Engineering', description: `Learn ReAcT server filters ${runId}` });
    const draft = await createCourse(instructorA.id, 'Draft catalogue', { status: CourseStatus.DRAFT, category: 'Engineering' });
    const archived = await createCourse(instructorB.id, 'Archived catalogue', { status: CourseStatus.ARCHIVED, category: 'Engineering' });

    await request(app).get('/api/available-courses').expect(401);
    const titleSearch = await learnerAgent.get(`/api/available-courses?search=REACT&category=Engineering&limit=50`).expect(200);
    expect(ids(titleSearch)).toEqual(expect.arrayContaining([publishedTitle.id, publishedDescription.id]));
    expect(ids(titleSearch)).not.toEqual(expect.arrayContaining([draft.id, archived.id]));
    expect(titleSearch.body.courses.every((course: { status: string }) => course.status === 'PUBLISHED')).toBe(true);
    expect(titleSearch.body.courses.find((course: { id: string }) => course.id === publishedTitle.id)).toMatchObject({ enrollmentCount: 0, instructor: { id: instructorA.id } });

    const bOnly = await learnerAgent.get(`/api/available-courses?search=${runId}&instructorId=${instructorB.id}&limit=50`).expect(200);
    expect(ids(bOnly)).toContain(publishedDescription.id);
    expect(ids(bOnly)).not.toEqual(expect.arrayContaining([archived.id]));
    const forcedDraft = await learnerAgent.get(`/api/available-courses?search=${runId}&status=DRAFT&limit=50`).expect(200);
    const forcedArchived = await learnerAgent.get(`/api/available-courses?search=${runId}&status=ARCHIVED&limit=50`).expect(200);
    expect(forcedDraft.body.courses.every((course: { status: string }) => course.status === 'PUBLISHED')).toBe(true);
    expect(forcedArchived.body.courses.every((course: { status: string }) => course.status === 'PUBLISHED')).toBe(true);
    await learnerAgent.get('/api/available-courses?status=INVALID').expect(400);
    await learnerAgent.get('/api/available-courses?limit=999999').expect(400);
    await learnerAgent.get('/api/available-courses?page=abc').expect(400);
    const empty = await learnerAgent.get('/api/available-courses?search=no-match-catalogue').expect(200);
    expect(empty.body).toMatchObject({ courses: [], total: 0, totalPages: 0 });
  });

  it('sorts relation-derived enrollment counts and paginates filtered learner results deterministically', async () => {
    const countOne = await createCourse(instructorA.id, 'Count one catalogue');
    const countThree = await createCourse(instructorA.id, 'Count three catalogue');
    const countFive = await createCourse(instructorA.id, 'Count five catalogue');
    await addEnrollments(countOne.id, 1);
    await addEnrollments(countThree.id, 3);
    await addEnrollments(countFive.id, 5);
    const descending = await learnerAgent.get(`/api/available-courses?search=Count&sortBy=enrollmentCount&sortOrder=desc&limit=50`).expect(200);
    expect(ids(descending).slice(0, 3)).toEqual([countFive.id, countThree.id, countOne.id]);
    expect(descending.body.courses.slice(0, 3).map((course: { enrollmentCount: number }) => course.enrollmentCount)).toEqual([5, 3, 1]);
    const ascending = await learnerAgent.get(`/api/available-courses?search=Count&sort=enrollmentCount&direction=asc&limit=50`).expect(200);
    expect(ids(ascending).slice(0, 3)).toEqual([countOne.id, countThree.id, countFive.id]);

    const createdAscending = await learnerAgent.get(`/api/available-courses?search=Count&sortBy=createdAt&sortOrder=asc&limit=50`).expect(200);
    const createdDescending = await learnerAgent.get(`/api/available-courses?search=Count&sortBy=createdAt&sortOrder=desc&limit=50`).expect(200);
    expect(ids(createdAscending).slice(0, 3)).toEqual([countOne.id, countThree.id, countFive.id]);
    expect(ids(createdDescending).slice(0, 3)).toEqual([countFive.id, countThree.id, countOne.id]);

    const tieOne = await createCourse(instructorA.id, 'Tie one catalogue');
    const tieTwo = await createCourse(instructorA.id, 'Tie two catalogue');
    const sharedTime = new Date('2031-01-01T00:00:00.000Z');
    await prisma.course.updateMany({ where: { id: { in: [tieOne.id, tieTwo.id] } }, data: { createdAt: sharedTime } });
    const ties = await learnerAgent.get(`/api/available-courses?search=Tie&sort=createdAt&direction=asc&limit=50`).expect(200);
    expect(ids(ties)).toEqual([tieOne.id, tieTwo.id].sort().reverse());

    const pages = await Promise.all(Array.from({ length: 13 }, (_, index) => createCourse(instructorA.id, `Paged ${String(index + 1).padStart(2, '0')} catalogue`, { category: 'Paged' })));
    const pageOne = await learnerAgent.get(`/api/available-courses?search=Paged&category=Paged&sort=title&direction=asc&page=1&limit=5`).expect(200);
    const pageTwo = await learnerAgent.get(`/api/available-courses?search=Paged&category=Paged&sort=title&direction=asc&page=2&limit=5`).expect(200);
    const pageThree = await learnerAgent.get(`/api/available-courses?search=Paged&category=Paged&sort=title&direction=asc&page=3&limit=5`).expect(200);
    expect(pageOne.body).toMatchObject({ total: 13, totalPages: 3, page: 1, limit: 5 });
    expect(pageOne.body.courses).toHaveLength(5);
    expect(pageTwo.body.courses).toHaveLength(5);
    expect(pageThree.body.courses).toHaveLength(3);
    expect(new Set([...ids(pageOne), ...ids(pageTwo), ...ids(pageThree)])).toEqual(new Set(pages.map((course) => course.id)));
    const titleDescending = await learnerAgent.get(`/api/available-courses?search=Paged&category=Paged&sort=title&direction=desc&limit=50`).expect(200);
    expect(titleDescending.body.courses[0].title).toContain('13');
  });

  it('keeps instructor catalogue ownership separate from instructorId filtering and includes all own statuses', async () => {
    const [aDraft, aPublished, aArchived, bDraft, bPublished, bArchived] = await Promise.all([
      createCourse(instructorA.id, 'Instructor A draft', { status: CourseStatus.DRAFT, category: 'Owner' }),
      createCourse(instructorA.id, 'Instructor A published', { status: CourseStatus.PUBLISHED, category: 'Owner' }),
      createCourse(instructorA.id, 'Instructor A archived', { status: CourseStatus.ARCHIVED, category: 'Owner' }),
      createCourse(instructorB.id, 'Instructor B draft', { status: CourseStatus.DRAFT, category: 'Owner' }),
      createCourse(instructorB.id, 'Instructor B published', { status: CourseStatus.PUBLISHED, category: 'Owner' }),
      createCourse(instructorB.id, 'Instructor B archived', { status: CourseStatus.ARCHIVED, category: 'Owner' })
    ]);
    await addEnrollments(aPublished.id, 2);
    const own = await instructorAAgent.get(`/api/courses?search=Instructor&category=Owner&instructorId=${instructorB.id}&sortBy=createdAt&sortOrder=asc&limit=50`).expect(200);
    expect(ids(own)).toEqual(expect.arrayContaining([aDraft.id, aPublished.id, aArchived.id]));
    expect(ids(own)).not.toEqual(expect.arrayContaining([bDraft.id, bPublished.id, bArchived.id]));
    expect(own.body.courses.find((course: { id: string }) => course.id === aPublished.id).enrollmentCount).toBe(2);
    const onlyArchived = await instructorAAgent.get('/api/courses?search=Instructor&status=ARCHIVED').expect(200);
    expect(ids(onlyArchived)).toEqual([aArchived.id]);
    const bOwn = await instructorBAgent.get('/api/courses?search=Instructor&status=PUBLISHED').expect(200);
    expect(ids(bOwn)).toEqual([bPublished.id]);
    await learnerAgent.get('/api/courses?search=Instructor').expect(403);
  });

  it('applies learner combined filters before count, sort, and pagination', async () => {
    const first = await createCourse(instructorB.id, 'Combined React A', { category: 'Combined', description: `React ${runId}` });
    const second = await createCourse(instructorB.id, 'Combined React B', { category: 'Combined', description: `React ${runId}` });
    await addEnrollments(first.id, 1);
    await addEnrollments(second.id, 2);
    const response = await learnerAgent.get(`/api/available-courses?search=React&category=Combined&instructorId=${instructorB.id}&sortBy=enrollmentCount&sortOrder=desc&page=1&limit=1`).expect(200);
    expect(response.body).toMatchObject({ total: 2, totalPages: 2, page: 1, limit: 1 });
    expect(ids(response)).toEqual([second.id]);
    expect(response.body.courses[0].enrollmentCount).toBe(2);
  });
});

import { CourseStatus, EnrollmentProgressState, PrismaClient, Role } from '@prisma/client';
import { isUniqueConstraintError } from '../auth/repository.js';
import { isValidEmail, normalizeEmail } from '../auth/validation.js';
import { prisma } from '../db/prisma.js';
import { calculatedProgress } from '../learner/service.js';

export type BulkEnrollmentStatus = 'ADDED' | 'ALREADY_ENROLLED' | 'LEARNER_NOT_FOUND' | 'NOT_A_LEARNER' | 'INVALID_EMAIL' | 'DUPLICATE_IN_FILE';
export type BulkEnrollmentResult = { email: string; status: BulkEnrollmentStatus };

export class InstructorEnrollmentError extends Error {
  constructor(readonly kind: 'COURSE_NOT_FOUND' | 'FORBIDDEN' | 'COURSE_NOT_PUBLISHED' | 'LEARNER_NOT_FOUND' | 'NOT_A_LEARNER' | 'ALREADY_ENROLLED') {
    super(kind);
  }
}

async function ownedCourse(client: PrismaClient, courseId: string, instructorId: string) {
  const course = await client.course.findUnique({ where: { id: courseId } });
  if (!course) throw new InstructorEnrollmentError('COURSE_NOT_FOUND');
  if (course.instructorId !== instructorId) throw new InstructorEnrollmentError('FORBIDDEN');
  return course;
}

async function ownedPublishedCourse(client: PrismaClient, courseId: string, instructorId: string) {
  const course = await ownedCourse(client, courseId, instructorId);
  if (course.status !== CourseStatus.PUBLISHED) throw new InstructorEnrollmentError('COURSE_NOT_PUBLISHED');
  return course;
}

function safeEnrollment(enrollment: { id: string; courseId: string; enrolledAt: Date; progressState: EnrollmentProgressState }, learner: { id: string; email: string }) {
  return { id: enrollment.id, courseId: enrollment.courseId, enrolledAt: enrollment.enrolledAt, progressState: enrollment.progressState, learner };
}

export function createInstructorEnrollmentService(client: PrismaClient = prisma) {
  async function addNormalized(courseId: string, instructorId: string, email: string, verifyCourse = true) {
    if (verifyCourse) await ownedPublishedCourse(client, courseId, instructorId);
    const learner = await client.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } });
    if (!learner) throw new InstructorEnrollmentError('LEARNER_NOT_FOUND');
    if (learner.role !== Role.LEARNER) throw new InstructorEnrollmentError('NOT_A_LEARNER');
    try {
      const enrollment = await client.enrollment.create({ data: { learnerId: learner.id, courseId, progressState: EnrollmentProgressState.NOT_STARTED } });
      return safeEnrollment(enrollment, learner);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new InstructorEnrollmentError('ALREADY_ENROLLED');
      throw error;
    }
  }

  return {
    async add(courseId: string, instructorId: string, email: string) {
      await ownedPublishedCourse(client, courseId, instructorId);
      return addNormalized(courseId, instructorId, email, false);
    },

    async bulk(courseId: string, instructorId: string, emails: string[]) {
      await ownedPublishedCourse(client, courseId, instructorId);
      const seen = new Set<string>();
      const results: BulkEnrollmentResult[] = [];
      for (const rawEmail of emails) {
        const email = normalizeEmail(rawEmail);
        if (!isValidEmail(email)) {
          results.push({ email: rawEmail.trim(), status: 'INVALID_EMAIL' });
          continue;
        }
        if (seen.has(email)) {
          results.push({ email, status: 'DUPLICATE_IN_FILE' });
          continue;
        }
        seen.add(email);
        try {
          await addNormalized(courseId, instructorId, email, false);
          results.push({ email, status: 'ADDED' });
        } catch (error) {
          if (!(error instanceof InstructorEnrollmentError)) throw error;
          const status: BulkEnrollmentStatus = error.kind === 'LEARNER_NOT_FOUND' ? 'LEARNER_NOT_FOUND'
            : error.kind === 'NOT_A_LEARNER' ? 'NOT_A_LEARNER'
              : error.kind === 'ALREADY_ENROLLED' ? 'ALREADY_ENROLLED' : 'INVALID_EMAIL';
          results.push({ email, status });
        }
      }
      const summary = {
        total: results.length,
        added: results.filter((result) => result.status === 'ADDED').length,
        alreadyEnrolled: results.filter((result) => result.status === 'ALREADY_ENROLLED').length,
        duplicateInFile: results.filter((result) => result.status === 'DUPLICATE_IN_FILE').length,
        learnerNotFound: results.filter((result) => result.status === 'LEARNER_NOT_FOUND').length,
        notALearner: results.filter((result) => result.status === 'NOT_A_LEARNER').length,
        invalidEmail: results.filter((result) => result.status === 'INVALID_EMAIL').length
      };
      return { summary, results };
    },

    async list(courseId: string, instructorId: string, skip: number, take: number) {
      await ownedCourse(client, courseId, instructorId);
      const where = { courseId };
      const [enrollments, total] = await Promise.all([
        client.enrollment.findMany({
          where,
          include: { learner: { select: { id: true, email: true } } },
          orderBy: [{ enrolledAt: 'desc' }, { id: 'desc' }],
          skip,
          take
        }),
        client.enrollment.count({ where })
      ]);
      return { enrollments: enrollments.map((enrollment) => safeEnrollment(enrollment, enrollment.learner)), total };
    },

    async progressExport(courseId: string, instructorId: string) {
      const course = await ownedCourse(client, courseId, instructorId);
      const [lessons, enrollments] = await Promise.all([
        client.lesson.findMany({ where: { courseId }, select: { id: true } }),
        client.enrollment.findMany({
          where: { courseId },
          select: {
            learner: { select: { email: true } },
            lessonProgress: { select: { lessonId: true, startedAt: true, completedAt: true } }
          },
          orderBy: [{ learner: { email: 'asc' } }, { id: 'asc' }]
        })
      ]);
      return {
        course: { id: course.id, status: course.status },
        rows: enrollments.map((enrollment) => ({ email: enrollment.learner.email, progress: calculatedProgress(lessons, enrollment.lessonProgress) }))
      };
    }
  };
}

export const instructorEnrollmentService = createInstructorEnrollmentService();

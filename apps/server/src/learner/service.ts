import { CourseStatus, EnrollmentProgressState, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import type { CourseListQuery } from '../courses/types.js';

const maxTransactionAttempts = 3;

export class LearnerAccessError extends Error {
  constructor(readonly kind: 'COURSE_NOT_FOUND' | 'COURSE_NOT_PUBLISHED' | 'COURSE_ARCHIVED' | 'NOT_ENROLLED' | 'LESSON_NOT_FOUND' | 'ALREADY_ENROLLED' | 'INVALID_PROGRESS_TRANSITION') {
    super(kind);
  }
}

export type CourseProgress = {
  state: EnrollmentProgressState;
  completedLessons: number;
  totalLessons: number;
  completionPercentage: number;
};

export type LearnerCatalogueQuery = Omit<CourseListQuery, 'instructorId' | 'status'> & { instructorId?: string };

function retryable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002');
}

export function lessonState(progress: { startedAt: Date | null; completedAt: Date | null } | undefined) {
  if (progress?.completedAt) return 'COMPLETED' as const;
  if (progress?.startedAt) return 'IN_PROGRESS' as const;
  return 'NOT_STARTED' as const;
}

export function calculatedProgress(lessons: { id: string }[], progressRows: { lessonId: string; startedAt: Date | null; completedAt: Date | null }[]): CourseProgress {
  const progressByLesson = new Map(progressRows.map((progress) => [progress.lessonId, progress]));
  const completedLessons = lessons.filter((lesson) => lessonState(progressByLesson.get(lesson.id)) === 'COMPLETED').length;
  const hasStartedLesson = lessons.some((lesson) => lessonState(progressByLesson.get(lesson.id)) !== 'NOT_STARTED');
  const totalLessons = lessons.length;
  const state = totalLessons > 0 && completedLessons === totalLessons
    ? EnrollmentProgressState.COMPLETED
    : hasStartedLesson ? EnrollmentProgressState.IN_PROGRESS : EnrollmentProgressState.NOT_STARTED;
  return {
    state,
    completedLessons,
    totalLessons,
    completionPercentage: totalLessons === 0 ? 0 : Number(((completedLessons / totalLessons) * 100).toFixed(2))
  };
}

async function calculateForEnrollment(tx: Prisma.TransactionClient, courseId: string, enrollmentId: string) {
  const lessons = await tx.lesson.findMany({ where: { courseId }, select: { id: true, position: true, title: true, content: true }, orderBy: { position: 'asc' } });
  const progressRows = lessons.length === 0 ? [] : await tx.lessonProgress.findMany({
    where: { enrollmentId, lessonId: { in: lessons.map((lesson) => lesson.id) } },
    select: { id: true, lessonId: true, startedAt: true, completedAt: true }
  });
  return { lessons, progressRows, courseProgress: calculatedProgress(lessons, progressRows) };
}

async function accessibleEnrollment(tx: Prisma.TransactionClient, courseId: string, learnerId: string) {
  const course = await tx.course.findUnique({ where: { id: courseId } });
  if (!course) throw new LearnerAccessError('COURSE_NOT_FOUND');
  if (course.status === CourseStatus.ARCHIVED) throw new LearnerAccessError('COURSE_ARCHIVED');
  if (course.status !== CourseStatus.PUBLISHED) throw new LearnerAccessError('COURSE_NOT_PUBLISHED');
  const enrollment = await tx.enrollment.findUnique({ where: { learnerId_courseId: { learnerId, courseId } } });
  if (!enrollment) throw new LearnerAccessError('NOT_ENROLLED');
  return { course, enrollment };
}

export function createLearnerService(client: PrismaClient = prisma) {
  async function transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxTransactionAttempts; attempt += 1) {
      try {
        return await client.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        lastError = error;
        if (!retryable(error) || attempt === maxTransactionAttempts - 1) throw error;
      }
    }
    throw lastError;
  }

  return {
    availableCourses: async (query: LearnerCatalogueQuery) => {
      const where: Prisma.CourseWhereInput = {
        status: CourseStatus.PUBLISHED,
        ...(query.instructorId ? { instructorId: query.instructorId } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.search ? {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } }
          ]
        } : {})
      };
      const [courses, total] = await Promise.all([
        client.course.findMany({
          where,
          orderBy: query.sort === 'enrollmentCount'
            ? [{ enrollments: { _count: query.direction } }, { id: 'desc' }]
            : [{ [query.sort]: query.direction }, { id: 'desc' }],
          include: { instructor: { select: { id: true, email: true } }, _count: { select: { enrollments: true } } },
          skip: query.skip,
          take: query.take
        }),
        client.course.count({ where })
      ]);
      return {
        courses: courses.map(({ _count, ...course }) => ({ ...course, enrollmentCount: _count.enrollments })),
        total
      };
    },

    enroll: (courseId: string, learnerId: string) => transaction(async (tx) => {
      const course = await tx.course.findUnique({ where: { id: courseId } });
      if (!course) throw new LearnerAccessError('COURSE_NOT_FOUND');
      if (course.status !== CourseStatus.PUBLISHED) throw new LearnerAccessError('COURSE_NOT_PUBLISHED');
      const existing = await tx.enrollment.findUnique({ where: { learnerId_courseId: { learnerId, courseId } } });
      if (existing) throw new LearnerAccessError('ALREADY_ENROLLED');
      return tx.enrollment.create({ data: { learnerId, courseId, progressState: EnrollmentProgressState.NOT_STARTED } });
    }),

    enrolledCourses: async (learnerId: string) => {
      const enrollments = await client.enrollment.findMany({
        where: { learnerId },
        include: { course: { include: { lessons: { select: { id: true } } } }, lessonProgress: { select: { lessonId: true, startedAt: true, completedAt: true } } },
        orderBy: { enrolledAt: 'desc' }
      });
      return enrollments.map((enrollment) => ({
        enrollment: { id: enrollment.id, courseId: enrollment.courseId, enrolledAt: enrollment.enrolledAt },
        course: { id: enrollment.course.id, title: enrollment.course.title, description: enrollment.course.description, category: enrollment.course.category, status: enrollment.course.status },
        progress: calculatedProgress(enrollment.course.lessons, enrollment.lessonProgress)
      }));
    },

    lessons: async (courseId: string, learnerId: string) => transaction(async (tx) => {
      const { enrollment } = await accessibleEnrollment(tx, courseId, learnerId);
      const { lessons, progressRows, courseProgress } = await calculateForEnrollment(tx, courseId, enrollment.id);
      const progressByLesson = new Map(progressRows.map((progress) => [progress.lessonId, progress]));
      return {
        lessons: lessons.map((lesson) => ({ ...lesson, progressState: lessonState(progressByLesson.get(lesson.id)) })),
        courseProgress
      };
    }),

    progress: async (courseId: string, learnerId: string) => transaction(async (tx) => {
      const { enrollment } = await accessibleEnrollment(tx, courseId, learnerId);
      const { lessons, progressRows, courseProgress } = await calculateForEnrollment(tx, courseId, enrollment.id);
      const progressByLesson = new Map(progressRows.map((progress) => [progress.lessonId, progress]));
      return {
        enrollment: { id: enrollment.id, courseId: enrollment.courseId, enrolledAt: enrollment.enrolledAt },
        lessons: lessons.map((lesson) => ({ ...lesson, progressState: lessonState(progressByLesson.get(lesson.id)) })),
        courseProgress
      };
    }),

    recordProgress: (courseId: string, lessonId: string, learnerId: string, action: 'start' | 'complete') => transaction(async (tx) => {
      const { enrollment } = await accessibleEnrollment(tx, courseId, learnerId);
      const lesson = await tx.lesson.findFirst({ where: { id: lessonId, courseId }, select: { id: true } });
      if (!lesson) throw new LearnerAccessError('LESSON_NOT_FOUND');
      const existing = await tx.lessonProgress.findUnique({ where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } } });
      if (action === 'complete' && enrollment.progressState === EnrollmentProgressState.NOT_STARTED) {
        throw new LearnerAccessError('INVALID_PROGRESS_TRANSITION');
      }
      let lessonProgress;
      let madeProgress = false;
      if (!existing) {
        const now = new Date();
        lessonProgress = await tx.lessonProgress.create({
          data: { enrollmentId: enrollment.id, lessonId, startedAt: now, completedAt: action === 'complete' ? now : null }
        });
        madeProgress = true;
      } else if (action === 'complete' && !existing.completedAt) {
        const now = new Date();
        lessonProgress = await tx.lessonProgress.update({
          where: { id: existing.id },
          data: { startedAt: existing.startedAt ?? now, completedAt: now }
        });
        madeProgress = true;
      } else if (action === 'start' && !existing.startedAt) {
        lessonProgress = await tx.lessonProgress.update({ where: { id: existing.id }, data: { startedAt: new Date() } });
        madeProgress = true;
      } else {
        lessonProgress = existing;
      }
      if (madeProgress) {
        const now = new Date();
        await tx.courseActivity.upsert({
          where: { learnerId_courseId: { learnerId, courseId } },
          create: { learnerId, courseId, lastProgressAt: now },
          update: { lastProgressAt: now }
        });
        // A later real progress event begins a new alert cycle; reopening/replaying does not.
        await tx.alertDismissal.deleteMany({ where: { learnerId, courseId } });
      }
      const { courseProgress } = await calculateForEnrollment(tx, courseId, enrollment.id);
      const updatedEnrollment = await tx.enrollment.update({
        where: { id: enrollment.id },
        data: {
          progressState: courseProgress.state,
          completedAt: courseProgress.state === EnrollmentProgressState.COMPLETED ? enrollment.completedAt ?? new Date() : null
        }
      });
      return { lessonProgress, courseProgress, enrollment: updatedEnrollment };
    })
  };
}

export const learnerService = createLearnerService();

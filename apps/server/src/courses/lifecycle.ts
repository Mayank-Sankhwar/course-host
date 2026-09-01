import { ActivityType, CourseStatus, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import type { Course } from './types.js';
import { writeActivityLog } from '../activity/log.js';

const maxTransactionAttempts = 3;

export type CourseLifecycleAction = 'publish' | 'archive' | 'restore';

export class CourseLifecycleError extends Error {
  constructor(readonly kind: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_TRANSITION' | 'PUBLISH_REQUIRES_LESSON') {
    super(kind);
  }
}

function transitionFor(action: CourseLifecycleAction) {
  switch (action) {
    case 'publish': return { expected: CourseStatus.DRAFT, next: CourseStatus.PUBLISHED };
    case 'archive': return { expected: CourseStatus.PUBLISHED, next: CourseStatus.ARCHIVED };
    case 'restore': return { expected: CourseStatus.ARCHIVED, next: CourseStatus.PUBLISHED };
  }
}

function retryable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002');
}

export function createCourseLifecycleService(client: PrismaClient = prisma) {
  return {
    async transition(courseId: string, instructorId: string, action: CourseLifecycleAction): Promise<Course> {
      let lastError: unknown;
      for (let attempt = 0; attempt < maxTransactionAttempts; attempt += 1) {
        try {
          return await client.$transaction(async (tx) => {
            const course = await tx.course.findUnique({ where: { id: courseId } });
            if (!course) throw new CourseLifecycleError('NOT_FOUND');
            if (course.instructorId !== instructorId) throw new CourseLifecycleError('FORBIDDEN');

            const transition = transitionFor(action);
            if (course.status !== transition.expected) throw new CourseLifecycleError('INVALID_TRANSITION');
            if (action === 'publish' && await tx.lesson.count({ where: { courseId } }) === 0) {
              throw new CourseLifecycleError('PUBLISH_REQUIRES_LESSON');
            }

            const updated = await tx.course.updateMany({
              where: { id: courseId, instructorId, status: transition.expected },
              data: { status: transition.next }
            });
            if (updated.count !== 1) throw new CourseLifecycleError('INVALID_TRANSITION');

            await writeActivityLog(tx, {
              courseId,
              actorId: instructorId,
              type: action === 'publish' ? ActivityType.COURSE_PUBLISHED : action === 'archive' ? ActivityType.COURSE_ARCHIVED : ActivityType.COURSE_RESTORED
            });

            return tx.course.findUniqueOrThrow({ where: { id: courseId } });
          }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        } catch (error) {
          lastError = error;
          if (!retryable(error) || attempt === maxTransactionAttempts - 1) throw error;
        }
      }
      throw lastError;
    }
  };
}

export const courseLifecycleService = createCourseLifecycleService();

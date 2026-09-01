import { CourseStatus, EnrollmentProgressState, PrismaClient, Role } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../auth/types.js';

const inactivityWindowMs = 14 * 24 * 60 * 60 * 1000;

export const inactivityThreshold = () => new Date(Date.now() - inactivityWindowMs);

export class InstructorActivityError extends Error {
  constructor(readonly kind: 'COURSE_NOT_FOUND' | 'FORBIDDEN' | 'NOT_INACTIVE') { super(kind); }
}

async function ownedCourse(client: PrismaClient, courseId: string, instructorId: string) {
  const course = await client.course.findUnique({ where: { id: courseId } });
  if (!course) throw new InstructorActivityError('COURSE_NOT_FOUND');
  if (course.instructorId !== instructorId) throw new InstructorActivityError('FORBIDDEN');
  return course;
}

function activityState(lastProgressAt: Date | null, now = new Date()) {
  if (!lastProgressAt) return 'NOT_STARTED' as const;
  return lastProgressAt.getTime() < now.getTime() - inactivityWindowMs ? 'INACTIVE' as const : 'ACTIVE' as const;
}

function safeActivity(activity: { learnerId: string; lastProgressAt: Date; learner: { id: string; email: string } }, now = new Date()) {
  const state = activityState(activity.lastProgressAt, now);
  return {
    learner: activity.learner,
    lastProgressAt: activity.lastProgressAt,
    state,
    daysSinceLastProgress: Number(((now.getTime() - activity.lastProgressAt.getTime()) / (24 * 60 * 60 * 1000)).toFixed(2))
  };
}

export function createInstructorActivityService(client: PrismaClient = prisma) {
  async function inactiveWhere(courseId?: string, instructorId?: string) {
    return {
      ...(courseId ? { courseId } : {}),
      lastProgressAt: { lt: inactivityThreshold() },
      alertDismissal: { is: null },
      enrollment: { is: { progressState: EnrollmentProgressState.IN_PROGRESS } },
      course: { ...(instructorId ? { instructorId } : {}), status: CourseStatus.PUBLISHED }
    };
  }

  return {
    async learnerActivity(courseId: string, user: AuthenticatedUser, skip: number, take: number) {
      if (user.role !== Role.INSTRUCTOR) throw new InstructorActivityError('FORBIDDEN');
      await ownedCourse(client, courseId, user.id);
      const [enrollments, total] = await Promise.all([
        client.enrollment.findMany({
          where: { courseId },
          include: { learner: { select: { id: true, email: true, courseActivities: { where: { courseId }, select: { lastProgressAt: true } } } } },
          orderBy: [{ enrolledAt: 'desc' }, { id: 'desc' }], skip, take
        }),
        client.enrollment.count({ where: { courseId } })
      ]);
      const now = new Date();
      return {
        total,
        learners: enrollments.map((enrollment) => {
          const lastProgressAt = enrollment.learner.courseActivities[0]?.lastProgressAt ?? null;
          return {
            enrollment: { id: enrollment.id, enrolledAt: enrollment.enrolledAt, progressState: enrollment.progressState },
            learner: { id: enrollment.learner.id, email: enrollment.learner.email },
            lastProgressAt,
            state: activityState(lastProgressAt, now)
          };
        })
      };
    },

    async alerts(courseId: string, user: AuthenticatedUser) {
      if (user.role !== Role.INSTRUCTOR) throw new InstructorActivityError('FORBIDDEN');
      await ownedCourse(client, courseId, user.id);
      const activities = await client.courseActivity.findMany({
        where: await inactiveWhere(courseId, user.id),
        include: { learner: { select: { id: true, email: true } } },
        orderBy: [{ lastProgressAt: 'asc' }, { learnerId: 'asc' }]
      });
      const now = new Date();
      return { alerts: activities.map((activity) => safeActivity(activity, now)) };
    },

    async alertCount(user: AuthenticatedUser) {
      if (user.role !== Role.INSTRUCTOR) throw new InstructorActivityError('FORBIDDEN');
      return client.courseActivity.count({ where: await inactiveWhere(undefined, user.id) });
    },

    async dismiss(courseId: string, learnerId: string, user: AuthenticatedUser) {
      if (user.role !== Role.INSTRUCTOR) throw new InstructorActivityError('FORBIDDEN');
      await ownedCourse(client, courseId, user.id);
      const activity = await client.courseActivity.findFirst({
        where: { ...(await inactiveWhere(courseId, user.id)), learnerId }, select: { learnerId: true, courseId: true }
      });
      if (!activity) throw new InstructorActivityError('NOT_INACTIVE');
      return client.alertDismissal.upsert({
        where: { courseId_learnerId: { courseId, learnerId } },
        create: { courseId, learnerId }, update: { dismissedAt: new Date() }
      });
    },

    async logs(courseId: string, user: AuthenticatedUser, skip: number, take: number) {
      if (user.role !== Role.INSTRUCTOR) throw new InstructorActivityError('FORBIDDEN');
      await ownedCourse(client, courseId, user.id);
      const [records, total] = await Promise.all([
        client.activityLog.findMany({
          where: { courseId }, include: { actor: { select: { id: true, email: true, role: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take
        }),
        client.activityLog.count({ where: { courseId } })
      ]);
      return { records: records.map(({ actor, ...record }) => ({ ...record, actor })), total };
    }
  };
}

export const instructorActivityService = createInstructorActivityService();

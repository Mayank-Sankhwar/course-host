import { EnrollmentProgressState, Role } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { AuthUserRepository } from '../auth/types.js';
import { prisma } from '../db/prisma.js';

export function createDashboardRouter(users: AuthUserRepository) {
  const router = Router();
  const instructorOnly = [requireAuth(users), requireRole(Role.INSTRUCTOR)];
  router.get('/dashboard', ...instructorOnly, async (request, response, next) => {
    try {
      const instructorId = request.authUser!.id;
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
      const courseWhere = { instructorId };
      const enrollmentWhere = { course: courseWhere };
      const [totalLearners, publishedCourses, completionsThisMonth, inProgress, byCourse, byState, completions] = await Promise.all([
        prisma.enrollment.count({ where: enrollmentWhere }),
        prisma.course.count({ where: { ...courseWhere, status: 'PUBLISHED' } }),
        prisma.enrollment.count({ where: { ...enrollmentWhere, completedAt: { gte: monthStart } } }),
        prisma.enrollment.count({ where: { ...enrollmentWhere, progressState: EnrollmentProgressState.IN_PROGRESS } }),
        prisma.course.findMany({ where: courseWhere, select: { id: true, title: true, _count: { select: { enrollments: true } } }, orderBy: { createdAt: 'desc' } }),
        prisma.enrollment.groupBy({ by: ['progressState'], where: enrollmentWhere, _count: { _all: true } }),
        prisma.enrollment.findMany({ where: { ...enrollmentWhere, completedAt: { gte: eightWeeksAgo } }, select: { completedAt: true } })
      ]);
      const weeks = Array.from({ length: 8 }, (_, index) => {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (7 - index) * 7));
        const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
        return { start: start.toISOString(), completed: completions.filter(({ completedAt }) => completedAt && completedAt >= start && completedAt < end).length };
      });
      response.json({
        totals: { totalLearners, publishedCourses, completionsThisMonth, inProgress },
        enrollmentByCourse: byCourse.map((course) => ({ id: course.id, title: course.title, enrollmentCount: course._count.enrollments })),
        enrollmentByState: Object.values(EnrollmentProgressState).map((state) => ({ state, count: byState.find((item) => item.progressState === state)?._count._all ?? 0 })),
        completionTrend: weeks
      });
    } catch (error) { next(error); }
  });
  return router;
}

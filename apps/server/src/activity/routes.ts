import { Role } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { AuthUserRepository } from '../auth/types.js';
import { InstructorActivityError, instructorActivityService } from './service.js';

function pagination(query: unknown) {
  const value = typeof query === 'object' && query !== null ? query as Record<string, unknown> : {};
  const page = value.page ?? '1'; const limit = value.limit ?? '20';
  if (typeof page !== 'string' || typeof limit !== 'string' || !/^\d+$/.test(page) || !/^\d+$/.test(limit)) return null;
  const parsedPage = Number(page); const parsedLimit = Number(limit);
  if (!Number.isSafeInteger(parsedPage) || !Number.isSafeInteger(parsedLimit) || parsedPage < 1 || parsedLimit < 1 || parsedLimit > 50) return null;
  return { page: parsedPage, limit: parsedLimit, skip: (parsedPage - 1) * parsedLimit };
}

function errorResponse(error: InstructorActivityError, response: import('express').Response) {
  if (error.kind === 'COURSE_NOT_FOUND') return response.status(404).json({ error: 'Course not found.' });
  if (error.kind === 'NOT_INACTIVE') return response.status(409).json({ error: 'This learner does not have an active inactivity alert.' });
  return response.status(403).json({ error: 'You do not have permission to perform this action.' });
}

export function createInstructorActivityRouter(users: AuthUserRepository) {
  const router = Router();
  const instructorOnly = [requireAuth(users), requireRole(Role.INSTRUCTOR)];
  router.get('/alerts/count', ...instructorOnly, async (request, response, next) => {
    try { response.json({ count: await instructorActivityService.alertCount(request.authUser!) }); }
    catch (error) { if (error instanceof InstructorActivityError) return errorResponse(error, response); next(error); }
  });
  router.get('/courses/:courseId/activity', ...instructorOnly, async (request, response, next) => {
    const values = pagination(request.query); if (!values) return response.status(400).json({ error: 'page and limit must be positive integers; limit must not exceed 50.' });
    if (typeof request.params.courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    try {
      const result = await instructorActivityService.learnerActivity(request.params.courseId, request.authUser!, values.skip, values.limit);
      response.json({ ...result, page: values.page, limit: values.limit, totalPages: Math.ceil(result.total / values.limit) });
    } catch (error) { if (error instanceof InstructorActivityError) return errorResponse(error, response); next(error); }
  });
  router.get('/courses/:courseId/alerts', ...instructorOnly, async (request, response, next) => {
    if (typeof request.params.courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    try { response.json(await instructorActivityService.alerts(request.params.courseId, request.authUser!)); }
    catch (error) { if (error instanceof InstructorActivityError) return errorResponse(error, response); next(error); }
  });
  router.post('/courses/:courseId/alerts/:learnerId/dismiss', ...instructorOnly, async (request, response, next) => {
    if (typeof request.params.courseId !== 'string' || typeof request.params.learnerId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    try { await instructorActivityService.dismiss(request.params.courseId, request.params.learnerId, request.authUser!); response.status(204).end(); }
    catch (error) { if (error instanceof InstructorActivityError) return errorResponse(error, response); next(error); }
  });
  router.get('/courses/:courseId/activity-log', ...instructorOnly, async (request, response, next) => {
    const values = pagination(request.query); if (!values) return response.status(400).json({ error: 'page and limit must be positive integers; limit must not exceed 50.' });
    if (typeof request.params.courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    try {
      const result = await instructorActivityService.logs(request.params.courseId, request.authUser!, values.skip, values.limit);
      response.json({ ...result, page: values.page, limit: values.limit, totalPages: Math.ceil(result.total / values.limit) });
    } catch (error) { if (error instanceof InstructorActivityError) return errorResponse(error, response); next(error); }
  });
  return router;
}

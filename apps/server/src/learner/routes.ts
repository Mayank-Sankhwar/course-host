import { Role } from '@prisma/client';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { AuthUserRepository } from '../auth/types.js';
import { LearnerAccessError, learnerService } from './service.js';
import { validateCourseListQuery } from '../courses/validation.js';

function noBody(request: Request): boolean {
  return request.body !== undefined && (typeof request.body !== 'object' || request.body === null || Array.isArray(request.body) || Object.keys(request.body).length > 0);
}

function errorResponse(error: LearnerAccessError, response: Response) {
  if (error.kind === 'COURSE_NOT_FOUND') return response.status(404).json({ error: 'Course not found.' });
  if (error.kind === 'COURSE_ARCHIVED') return response.status(403).json({ error: 'This course was archived by the instructor.' });
  if (error.kind === 'COURSE_NOT_PUBLISHED') return response.status(403).json({ error: 'This course is not currently available to learners.' });
  if (error.kind === 'NOT_ENROLLED') return response.status(403).json({ error: 'You do not have permission to perform this action.' });
  if (error.kind === 'LESSON_NOT_FOUND') return response.status(404).json({ error: 'Lesson not found.' });
  if (error.kind === 'INVALID_PROGRESS_TRANSITION') return response.status(409).json({ error: 'Start a lesson before completing it.' });
  return response.status(409).json({ error: 'You are already enrolled in this course.' });
}

export function createLearnerRouter(users: AuthUserRepository) {
  const router = Router();
  const learnerOnly = [requireAuth(users), requireRole(Role.LEARNER)];

  function run(operation: (request: Request) => Promise<unknown>) {
    return async (request: Request, response: Response, next: NextFunction) => {
      try {
        response.json(await operation(request));
      } catch (error) {
        if (error instanceof LearnerAccessError) return errorResponse(error, response);
        next(error);
      }
    };
  }

  router.get('/available-courses', ...learnerOnly, async (request, response, next) => {
    const validated = validateCourseListQuery(request.query, '');
    if (!validated.success) return response.status(400).json({ error: validated.message });
    const rawInstructorId = request.query.instructorId;
    if (rawInstructorId !== undefined && typeof rawInstructorId !== 'string') return response.status(400).json({ error: 'instructorId must be a string.' });
    const instructorId = rawInstructorId?.trim();
    if (instructorId && instructorId.length > 200) return response.status(400).json({ error: 'Filter value is too long.' });
    try {
      const catalogue = await learnerService.availableCourses({
        ...validated.data,
        ...(instructorId ? { instructorId } : {})
      });
      const page = Math.floor(validated.data.skip / validated.data.take) + 1;
      response.json({ ...catalogue, page, limit: validated.data.take, totalPages: Math.ceil(catalogue.total / validated.data.take) });
    } catch (error) { next(error); }
  });
  router.get('/me/courses', ...learnerOnly, run(async (request) => ({ courses: await learnerService.enrolledCourses(request.authUser!.id) })));

  router.post('/courses/:courseId/enroll', ...learnerOnly, async (request, response, next) => {
    if (noBody(request)) return response.status(400).json({ error: 'This endpoint does not accept request fields.' });
    const courseId = request.params.courseId;
    if (typeof courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    try {
      const enrollment = await learnerService.enroll(courseId, request.authUser!.id);
      response.status(201).json({ enrollment: { id: enrollment.id, courseId: enrollment.courseId, enrolledAt: enrollment.enrolledAt, progressState: enrollment.progressState } });
    } catch (error) {
      if (error instanceof LearnerAccessError) return errorResponse(error, response);
      next(error);
    }
  });

  router.get('/my-courses/:courseId/lessons', ...learnerOnly, run(async (request) => {
    const courseId = request.params.courseId;
    if (typeof courseId !== 'string') throw new LearnerAccessError('COURSE_NOT_FOUND');
    return learnerService.lessons(courseId, request.authUser!.id);
  }));
  router.get('/my-courses/:courseId/progress', ...learnerOnly, run(async (request) => {
    const courseId = request.params.courseId;
    if (typeof courseId !== 'string') throw new LearnerAccessError('COURSE_NOT_FOUND');
    return learnerService.progress(courseId, request.authUser!.id);
  }));

  for (const action of ['start', 'complete'] as const) {
    router.post(`/my-courses/:courseId/lessons/:lessonId/${action}`, ...learnerOnly, async (request, response, next) => {
      if (noBody(request)) return response.status(400).json({ error: 'This endpoint does not accept request fields.' });
      const { courseId, lessonId } = request.params;
      if (typeof courseId !== 'string' || typeof lessonId !== 'string') return response.status(404).json({ error: 'Lesson not found.' });
      try {
        const result = await learnerService.recordProgress(courseId, lessonId, request.authUser!.id, action);
        response.json({
          lessonProgress: { lessonId: result.lessonProgress.lessonId, startedAt: result.lessonProgress.startedAt, completedAt: result.lessonProgress.completedAt },
          courseProgress: result.courseProgress,
          enrollment: { id: result.enrollment.id, courseId: result.enrollment.courseId, progressState: result.enrollment.progressState }
        });
      } catch (error) {
        if (error instanceof LearnerAccessError) return errorResponse(error, response);
        next(error);
      }
    });
  }

  return router;
}

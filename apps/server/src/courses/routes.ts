import { ActivityType, Role } from '@prisma/client';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { AuthUserRepository } from '../auth/types.js';
import { courseRepository } from './repository.js';
import { CourseLifecycleError, courseLifecycleService, type CourseLifecycleAction } from './lifecycle.js';
import type { Course, CourseRepository } from './types.js';
import { validateCourseListQuery, validateCreateCourse, validateUpdateCourse } from './validation.js';
import { activityLogClient, writeActivityLog } from '../activity/log.js';

function safeCourse(course: Course) {
  return course;
}

export function createCourseRouter(users: AuthUserRepository, courses: CourseRepository = courseRepository) {
  const router = Router();
  const instructorOnly = [requireAuth(users), requireRole(Role.INSTRUCTOR)];

  router.post('/', ...instructorOnly, async (request, response, next) => {
    const result = validateCreateCourse(request.body);
    if (!result.success) return response.status(400).json({ error: result.message });
    try {
      const course = await courses.create({ ...result.data, instructorId: request.authUser!.id });
      if (courses === courseRepository) await writeActivityLog(activityLogClient, { courseId: course.id, actorId: request.authUser!.id, type: ActivityType.COURSE_CREATED });
      response.status(201).json({ course: safeCourse(course) });
    } catch (error) { next(error); }
  });

  router.get('/', ...instructorOnly, async (request, response, next) => {
    const result = validateCourseListQuery(request.query, request.authUser!.id);
    if (!result.success) return response.status(400).json({ error: result.message });
    try {
      const [courseRows, total] = await Promise.all([
        courses.list(result.data),
        courses.count(result.data)
      ]);
      const page = Math.floor(result.data.skip / result.data.take) + 1;
      response.json({ courses: courseRows, page, limit: result.data.take, total, totalPages: Math.ceil(total / result.data.take) });
    } catch (error) { next(error); }
  });

  router.get('/:courseId', ...instructorOnly, async (request, response, next) => {
    try {
      const courseId = request.params.courseId;
      if (typeof courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
      const course = await courses.findById(courseId);
      if (!course) return response.status(404).json({ error: 'Course not found.' });
      if (course.instructorId !== request.authUser!.id) return response.status(403).json({ error: 'You do not have permission to perform this action.' });
      response.json({ course: safeCourse(course) });
    } catch (error) { next(error); }
  });

  router.patch('/:courseId', ...instructorOnly, async (request, response, next) => {
    const result = validateUpdateCourse(request.body);
    if (!result.success) return response.status(400).json({ error: result.message });
    try {
      const courseId = request.params.courseId;
      if (typeof courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
      const course = await courses.findById(courseId);
      if (!course) return response.status(404).json({ error: 'Course not found.' });
      if (course.instructorId !== request.authUser!.id) return response.status(403).json({ error: 'You do not have permission to perform this action.' });
      const updated = await courses.update(course.id, result.data);
      if (courses === courseRepository) await writeActivityLog(activityLogClient, { courseId: course.id, actorId: request.authUser!.id, type: ActivityType.COURSE_UPDATED });
      response.json({ course: safeCourse(updated) });
    } catch (error) { next(error); }
  });

  function lifecycle(action: CourseLifecycleAction) {
    return async (request: Request, response: Response, next: NextFunction) => {
      const courseId = request.params.courseId;
      if (typeof courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
      try {
        const course = await courseLifecycleService.transition(courseId, request.authUser!.id, action);
        response.json({ course: safeCourse(course) });
      } catch (error) {
        if (error instanceof CourseLifecycleError) {
          if (error.kind === 'NOT_FOUND') return response.status(404).json({ error: 'Course not found.' });
          if (error.kind === 'FORBIDDEN') return response.status(403).json({ error: 'You do not have permission to perform this action.' });
          if (error.kind === 'PUBLISH_REQUIRES_LESSON') return response.status(409).json({ error: 'The course must contain at least one lesson before it can be published.' });
          return response.status(409).json({ error: 'The course lifecycle transition is not allowed from the current status.' });
        }
        next(error);
      }
    };
  }

  router.post('/:courseId/publish', ...instructorOnly, lifecycle('publish'));
  router.post('/:courseId/archive', ...instructorOnly, lifecycle('archive'));
  router.post('/:courseId/restore', ...instructorOnly, lifecycle('restore'));

  return router;
}

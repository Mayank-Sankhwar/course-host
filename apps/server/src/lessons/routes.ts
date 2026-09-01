import { ActivityType, Role } from '@prisma/client';
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { AuthUserRepository } from '../auth/types.js';
import { courseRepository } from '../courses/repository.js';
import type { CourseRepository } from '../courses/types.js';
import { lessonRepository } from './repository.js';
import { LastLessonDeletionError, LessonSetMismatchError, type LessonRepository } from './types.js';
import { validateCreateLesson, validateReorderLessonIds, validateUpdateLesson } from './validation.js';
import { activityLogClient, writeActivityLog } from '../activity/log.js';

export function createLessonRouter(users: AuthUserRepository, courses: CourseRepository = courseRepository, lessons: LessonRepository = lessonRepository) {
  const router = Router({ mergeParams: true });
  const instructorOnly = [requireAuth(users), requireRole(Role.INSTRUCTOR)];

  async function ownedCourse(courseId: string, instructorId: string) {
    const course = await courses.findById(courseId);
    if (!course) return { status: 404 as const, message: 'Course not found.' };
    if (course.instructorId !== instructorId) return { status: 403 as const, message: 'You do not have permission to perform this action.' };
    return { course };
  }

  router.patch('/reorder', ...instructorOnly, async (request, response, next) => {
    const courseId = request.params.courseId;
    if (typeof courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    const input = validateReorderLessonIds(request.body);
    if (!input.success) return response.status(400).json({ error: input.message });
    try {
      const ownership = await ownedCourse(courseId, request.authUser!.id);
      if (!('course' in ownership)) return response.status(ownership.status).json({ error: ownership.message });
      const orderedLessons = await lessons.reorder(courseId, input.data);
      if (lessons === lessonRepository) await writeActivityLog(activityLogClient, { courseId, actorId: request.authUser!.id, type: ActivityType.LESSON_REORDERED });
      response.json({ lessons: orderedLessons });
    } catch (error) {
      if (error instanceof LessonSetMismatchError) return response.status(400).json({ error: error.message });
      next(error);
    }
  });

  router.post('/', ...instructorOnly, async (request, response, next) => {
    const courseId = request.params.courseId;
    if (typeof courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    const input = validateCreateLesson(request.body);
    if (!input.success) return response.status(400).json({ error: input.message });
    try {
      const ownership = await ownedCourse(courseId, request.authUser!.id);
      if (!('course' in ownership)) return response.status(ownership.status).json({ error: ownership.message });
      const lesson = await lessons.createAtEnd(courseId, input.data);
      if (lessons === lessonRepository) await writeActivityLog(activityLogClient, { courseId, actorId: request.authUser!.id, type: ActivityType.LESSON_CREATED, details: { lessonId: lesson.id } });
      response.status(201).json({ lesson });
    } catch (error) { next(error); }
  });

  router.get('/', ...instructorOnly, async (request, response, next) => {
    const courseId = request.params.courseId;
    if (typeof courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    try {
      const ownership = await ownedCourse(courseId, request.authUser!.id);
      if (!('course' in ownership)) return response.status(ownership.status).json({ error: ownership.message });
      response.json({ lessons: await lessons.list(courseId) });
    } catch (error) { next(error); }
  });

  router.get('/:lessonId', ...instructorOnly, async (request, response, next) => {
    const { courseId, lessonId } = request.params;
    if (typeof courseId !== 'string' || typeof lessonId !== 'string') return response.status(404).json({ error: 'Lesson not found.' });
    try {
      const ownership = await ownedCourse(courseId, request.authUser!.id);
      if (!('course' in ownership)) return response.status(ownership.status).json({ error: ownership.message });
      const lesson = await lessons.findByIdAndCourse(lessonId, courseId);
      if (!lesson) return response.status(404).json({ error: 'Lesson not found.' });
      response.json({ lesson });
    } catch (error) { next(error); }
  });

  router.patch('/:lessonId', ...instructorOnly, async (request, response, next) => {
    const { courseId, lessonId } = request.params;
    if (typeof courseId !== 'string' || typeof lessonId !== 'string') return response.status(404).json({ error: 'Lesson not found.' });
    const input = validateUpdateLesson(request.body);
    if (!input.success) return response.status(400).json({ error: input.message });
    try {
      const ownership = await ownedCourse(courseId, request.authUser!.id);
      if (!('course' in ownership)) return response.status(ownership.status).json({ error: ownership.message });
      const lesson = await lessons.findByIdAndCourse(lessonId, courseId);
      if (!lesson) return response.status(404).json({ error: 'Lesson not found.' });
      const updated = await lessons.update(lesson.id, input.data);
      if (lessons === lessonRepository) await writeActivityLog(activityLogClient, { courseId, actorId: request.authUser!.id, type: ActivityType.LESSON_UPDATED, details: { lessonId: lesson.id } });
      response.json({ lesson: updated });
    } catch (error) { next(error); }
  });

  router.delete('/:lessonId', ...instructorOnly, async (request, response, next) => {
    const { courseId, lessonId } = request.params;
    if (typeof courseId !== 'string' || typeof lessonId !== 'string') return response.status(404).json({ error: 'Lesson not found.' });
    try {
      const ownership = await ownedCourse(courseId, request.authUser!.id);
      if (!('course' in ownership)) return response.status(ownership.status).json({ error: ownership.message });
      const lesson = await lessons.findByIdAndCourse(lessonId, courseId);
      if (!lesson) return response.status(404).json({ error: 'Lesson not found.' });
      await lessons.deleteAndNormalize(courseId, lessonId);
      if (lessons === lessonRepository) await writeActivityLog(activityLogClient, { courseId, actorId: request.authUser!.id, type: ActivityType.LESSON_DELETED, details: { lessonId } });
      response.status(204).end();
    } catch (error) {
      if (error instanceof LastLessonDeletionError) return response.status(409).json({ error: error.message });
      if (error instanceof LessonSetMismatchError) return response.status(404).json({ error: 'Lesson not found.' });
      next(error);
    }
  });

  return router;
}

import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import type { AuthUserRepository } from '../auth/types.js';
import { CommentAccessError, commentService } from './service.js';
import { validateComment } from './validation.js';

function accessError(error: CommentAccessError) {
  if (error.kind === 'COURSE_NOT_FOUND') return { status: 404, message: 'Course not found.' };
  if (error.kind === 'COURSE_ARCHIVED') return { status: 403, message: 'This course has been archived by the instructor.' };
  return { status: 403, message: 'You do not have permission to perform this action.' };
}

export function createCommentRouter(users: AuthUserRepository) {
  const router = Router();
  router.get('/:courseId/comments', requireAuth(users), async (request, response, next) => {
    const courseId = request.params.courseId;
    if (typeof courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    try {
      response.json({ comments: await commentService.list(courseId, request.authUser!) });
    } catch (error) {
      if (error instanceof CommentAccessError) {
        const result = accessError(error);
        return response.status(result.status).json({ error: result.message });
      }
      next(error);
    }
  });
  router.post('/:courseId/comments', requireAuth(users), async (request, response, next) => {
    const input = validateComment(request.body);
    if (!input.success) return response.status(400).json({ error: input.message });
    const courseId = request.params.courseId;
    if (typeof courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    try {
      response.status(201).json({ comment: await commentService.create(courseId, request.authUser!, input.data) });
    } catch (error) {
      if (error instanceof CommentAccessError) {
        const result = accessError(error);
        return response.status(result.status).json({ error: result.message });
      }
      next(error);
    }
  });
  return router;
}

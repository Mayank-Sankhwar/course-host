import { ActivityType, CourseStatus, PrismaClient, Role } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import type { AuthenticatedUser } from '../auth/types.js';
import { writeActivityLog } from '../activity/log.js';

export class CommentAccessError extends Error {
  constructor(readonly kind: 'COURSE_NOT_FOUND' | 'FORBIDDEN' | 'COURSE_ARCHIVED') {
    super(kind);
  }
}

export type CommentInput = { body: string };

async function accessCourse(client: PrismaClient, courseId: string, user: AuthenticatedUser, allowArchivedRead: boolean) {
  const course = await client.course.findUnique({ where: { id: courseId } });
  if (!course) throw new CommentAccessError('COURSE_NOT_FOUND');
  if (user.role === Role.INSTRUCTOR) {
    if (course.instructorId !== user.id) throw new CommentAccessError('FORBIDDEN');
  } else {
    const enrollment = await client.enrollment.findUnique({ where: { learnerId_courseId: { learnerId: user.id, courseId } } });
    if (!enrollment) throw new CommentAccessError('FORBIDDEN');
    if (course.status === CourseStatus.ARCHIVED) throw new CommentAccessError('COURSE_ARCHIVED');
    if (course.status !== CourseStatus.PUBLISHED) throw new CommentAccessError('FORBIDDEN');
  }
  if (!allowArchivedRead && course.status === CourseStatus.ARCHIVED) throw new CommentAccessError('COURSE_ARCHIVED');
  return course;
}

export function createCommentService(client: PrismaClient = prisma) {
  return {
    async list(courseId: string, user: AuthenticatedUser) {
      await accessCourse(client, courseId, user, user.role === Role.INSTRUCTOR);
      const comments = await client.comment.findMany({
        where: { courseId },
        include: { author: { select: { id: true, email: true, role: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]
      });
      return comments.map((comment) => ({
        id: comment.id,
        courseId: comment.courseId,
        body: comment.content,
        createdAt: comment.createdAt,
        author: comment.author
      }));
    },

    async create(courseId: string, user: AuthenticatedUser, input: CommentInput) {
      await accessCourse(client, courseId, user, false);
      const comment = await client.$transaction(async (tx) => {
        const created = await tx.comment.create({
          data: { courseId, authorId: user.id, content: input.body },
          include: { author: { select: { id: true, email: true, role: true } } }
        });
        await writeActivityLog(tx, { courseId, actorId: user.id, type: ActivityType.COMMENT_CREATED, details: { commentId: created.id } });
        return created;
      });
      return {
        id: comment.id,
        courseId: comment.courseId,
        body: comment.content,
        createdAt: comment.createdAt,
        author: comment.author
      };
    }
  };
}

export const commentService = createCommentService();

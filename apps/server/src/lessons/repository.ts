import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { LastLessonDeletionError, LessonSetMismatchError, type LessonFields, type LessonRepository } from './types.js';

const maxTransactionAttempts = 3;

function retryable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002');
}

async function serializable<T>(client: PrismaClient, operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
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

function hasExactLessonSet(existingIds: string[], requestedIds: string[]): boolean {
  return existingIds.length === requestedIds.length && existingIds.every((id) => requestedIds.includes(id));
}

export function createLessonRepository(client: PrismaClient = prisma): LessonRepository {
  return {
    createAtEnd: (courseId, input) => serializable(client, async (tx) => {
      const aggregate = await tx.lesson.aggregate({ where: { courseId }, _max: { position: true } });
      return tx.lesson.create({ data: { courseId, ...input, position: (aggregate._max.position ?? 0) + 1 } });
    }),
    list: (courseId) => client.lesson.findMany({ where: { courseId }, orderBy: { position: 'asc' } }),
    findByIdAndCourse: (id, courseId) => client.lesson.findFirst({ where: { id, courseId } }),
    update: (id, input) => client.lesson.update({ where: { id }, data: input }),
    deleteAndNormalize: (courseId, lessonId) => serializable(client, async (tx) => {
      const lessons = await tx.lesson.findMany({ where: { courseId }, select: { id: true, position: true }, orderBy: { position: 'asc' } });
      const lesson = lessons.find((candidate) => candidate.id === lessonId);
      if (!lesson) throw new LessonSetMismatchError();
      if (lessons.length <= 1) throw new LastLessonDeletionError();
      await tx.lesson.delete({ where: { id: lessonId } });
      const remaining = lessons.filter((candidate) => candidate.id !== lessonId);
      const temporaryOffset = Math.max(...lessons.map((candidate) => candidate.position)) + remaining.length;
      await Promise.all(remaining.map((candidate) => tx.lesson.update({
        where: { id: candidate.id }, data: { position: candidate.position + temporaryOffset }
      })));
      await Promise.all(remaining.map((candidate, index) => tx.lesson.update({
        where: { id: candidate.id }, data: { position: index + 1 }
      })));
    }),
    reorder: (courseId, lessonIds) => serializable(client, async (tx) => {
      const existing = await tx.lesson.findMany({ where: { courseId }, select: { id: true, position: true } });
      if (!hasExactLessonSet(existing.map((lesson) => lesson.id), lessonIds)) throw new LessonSetMismatchError();
      const offset = Math.max(...existing.map((lesson) => lesson.position)) + existing.length;
      await Promise.all(existing.map((lesson) => tx.lesson.update({ where: { id: lesson.id }, data: { position: lesson.position + offset } })));
      await Promise.all(lessonIds.map((id, index) => tx.lesson.update({ where: { id }, data: { position: index + 1 } })));
      return tx.lesson.findMany({ where: { courseId }, orderBy: { position: 'asc' } });
    })
  };
}

export const lessonRepository = createLessonRepository();

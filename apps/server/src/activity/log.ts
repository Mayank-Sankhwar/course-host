import { ActivityType, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma.js';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export async function writeActivityLog(
  client: DatabaseClient,
  input: { courseId: string; actorId: string; type: ActivityType; details?: Prisma.InputJsonValue }
) {
  return client.activityLog.create({
    data: { courseId: input.courseId, actorId: input.actorId, type: input.type, ...(input.details === undefined ? {} : { details: input.details }) }
  });
}

export const activityLogClient = prisma;

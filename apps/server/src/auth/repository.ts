import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import type { AuthUserRepository } from './types.js';

export const authUserRepository: AuthUserRepository = {
  create: ({ email, passwordHash, role }) => prisma.user.create({
    data: { email, passwordHash, role },
    select: { id: true, email: true, role: true }
  }),
  findByEmail: (email) => prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, passwordHash: true }
  }),
  findById: (id) => prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true }
  })
};

export function isUniqueConstraintError(error: unknown): boolean {
  return (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
    || (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002');
}

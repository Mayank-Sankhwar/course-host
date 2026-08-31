import { CourseStatus, type Prisma } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import type { CourseListQuery, CourseRepository } from './types.js';

function whereFor(query: Pick<CourseListQuery, 'instructorId' | 'search' | 'category' | 'status'>): Prisma.CourseWhereInput {
  return {
    instructorId: query.instructorId,
    ...(query.category ? { category: query.category } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? {
      OR: [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } }
      ]
    } : {})
  };
}

export const courseRepository: CourseRepository = {
  create: ({ instructorId, title, description, category }) => prisma.course.create({
    data: { instructorId, title, description, category, status: CourseStatus.DRAFT }
  }),
  findById: (id) => prisma.course.findUnique({ where: { id } }),
  update: (id, input) => prisma.course.update({ where: { id }, data: input }),
  list: async (query) => {
    const courses = await prisma.course.findMany({
    where: whereFor(query),
    orderBy: query.sort === 'enrollmentCount'
      ? [{ enrollments: { _count: query.direction } }, { id: 'desc' }]
      : [{ [query.sort]: query.direction }, { id: 'desc' }],
    include: { instructor: { select: { id: true, email: true } }, _count: { select: { enrollments: true } } },
    skip: query.skip,
    take: query.take
    });
    return courses.map(({ _count, ...course }) => ({ ...course, enrollmentCount: _count.enrollments }));
  },
  count: (query) => prisma.course.count({ where: whereFor(query) })
};

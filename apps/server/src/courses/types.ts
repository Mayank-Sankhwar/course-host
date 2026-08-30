import type { CourseStatus } from '@prisma/client';

export type Course = {
  id: string;
  instructorId: string;
  title: string;
  description: string;
  category: string;
  status: CourseStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CourseFields = Pick<Course, 'title' | 'description' | 'category'>;

export type CourseListQuery = {
  instructorId: string;
  search?: string;
  category?: string;
  status?: CourseStatus;
  sort: 'title' | 'createdAt';
  direction: 'asc' | 'desc';
  skip: number;
  take: number;
};

export type CourseRepository = {
  create(input: CourseFields & { instructorId: string }): Promise<Course>;
  findById(id: string): Promise<Course | null>;
  update(id: string, input: Partial<CourseFields>): Promise<Course>;
  list(query: CourseListQuery): Promise<Course[]>;
  count(query: Omit<CourseListQuery, 'skip' | 'take' | 'sort' | 'direction'>): Promise<number>;
};

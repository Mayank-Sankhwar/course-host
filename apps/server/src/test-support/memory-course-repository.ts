import { CourseStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Course, CourseFields, CourseListQuery, CourseRepository } from '../courses/types.js';

export class MemoryCourseRepository implements CourseRepository {
  private readonly courses = new Map<string, Course>();

  async create(input: CourseFields & { instructorId: string }): Promise<Course> {
    return this.seed(input);
  }

  async findById(id: string): Promise<Course | null> {
    return this.courses.get(id) ?? null;
  }

  async update(id: string, input: Partial<CourseFields>): Promise<Course> {
    const course = this.courses.get(id);
    if (!course) throw new Error('Course not found');
    const updated = { ...course, ...input, updatedAt: new Date() };
    this.courses.set(id, updated);
    return updated;
  }

  async list(query: CourseListQuery): Promise<Course[]> {
    const results = this.filtered(query);
    results.sort((left, right) => {
      const first = query.sort === 'title'
        ? left.title.localeCompare(right.title)
        : left.createdAt.getTime() - right.createdAt.getTime();
      const directional = query.direction === 'asc' ? first : -first;
      return directional || left.id.localeCompare(right.id);
    });
    return results.slice(query.skip, query.skip + query.take);
  }

  async count(query: Omit<CourseListQuery, 'skip' | 'take' | 'sort' | 'direction'>): Promise<number> {
    return this.filtered(query).length;
  }

  seed(input: CourseFields & { instructorId: string; status?: CourseStatus }): Course {
    const now = new Date();
    const course: Course = { id: randomUUID(), ...input, status: input.status ?? CourseStatus.DRAFT, createdAt: now, updatedAt: now };
    this.courses.set(course.id, course);
    return course;
  }

  private filtered(query: Pick<CourseListQuery, 'instructorId' | 'search' | 'category' | 'status'>): Course[] {
    const search = query.search?.toLowerCase();
    return [...this.courses.values()].filter((course) =>
      course.instructorId === query.instructorId
      && (!query.category || course.category === query.category)
      && (!query.status || course.status === query.status)
      && (!search || course.title.toLowerCase().includes(search) || course.description.toLowerCase().includes(search))
    );
  }
}

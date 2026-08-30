import { CourseStatus } from '@prisma/client';
import type { CourseFields, CourseListQuery } from './types.js';

const limits = { title: 200, description: 5_000, category: 100 };
const courseFieldNames = ['title', 'description', 'category'] as const;
const maxPageSize = 50;
const maxPageNumber = 10_000;

type Validation<T> = { success: true; data: T } | { success: false; message: string };

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function validateField(name: keyof CourseFields, value: unknown): Validation<string> {
  if (typeof value !== 'string') return { success: false, message: `${name} must be a string.` };
  const normalized = value.trim();
  if (!normalized) return { success: false, message: `${name} is required.` };
  if (normalized.length > limits[name]) return { success: false, message: `${name} must be at most ${limits[name]} characters.` };
  return { success: true, data: normalized };
}

function hasOnlyCourseFields(input: Record<string, unknown>): boolean {
  return Object.keys(input).every((key) => courseFieldNames.includes(key as keyof CourseFields));
}

export function validateCreateCourse(input: unknown): Validation<CourseFields> {
  if (!isObject(input) || !hasOnlyCourseFields(input)) {
    return { success: false, message: 'Only title, description, and category may be provided.' };
  }
  const title = validateField('title', input.title);
  const description = validateField('description', input.description);
  const category = validateField('category', input.category);
  if (!title.success) return title;
  if (!description.success) return description;
  if (!category.success) return category;
  return { success: true, data: { title: title.data, description: description.data, category: category.data } };
}

export function validateUpdateCourse(input: unknown): Validation<Partial<CourseFields>> {
  if (!isObject(input) || !hasOnlyCourseFields(input)) {
    return { success: false, message: 'Only title, description, and category may be updated.' };
  }
  const supplied = courseFieldNames.filter((field) => field in input);
  if (!supplied.length) return { success: false, message: 'Provide at least one field to update.' };
  const data: Partial<CourseFields> = {};
  for (const field of supplied) {
    const result = validateField(field, input[field]);
    if (!result.success) return result;
    data[field] = result.data;
  }
  return { success: true, data };
}

function positiveInteger(value: unknown, fallback: number, max: number): Validation<number> {
  if (value === undefined) return { success: true, data: fallback };
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return { success: false, message: 'Pagination values must be positive integers.' };
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) return { success: false, message: `Pagination values must be between 1 and ${max}.` };
  return { success: true, data: parsed };
}

export function validateCourseListQuery(input: unknown, instructorId: string): Validation<CourseListQuery> {
  const query = isObject(input) ? input : {};
  const page = positiveInteger(query.page, 1, maxPageNumber);
  const limit = positiveInteger(query.limit, 20, maxPageSize);
  if (!page.success) return page;
  if (!limit.success) return limit;
  const sort = query.sort ?? 'createdAt';
  const direction = query.direction ?? 'desc';
  if (sort !== 'title' && sort !== 'createdAt') return { success: false, message: 'sort must be title or createdAt.' };
  if (direction !== 'asc' && direction !== 'desc') return { success: false, message: 'direction must be asc or desc.' };
  if (query.status !== undefined && !Object.values(CourseStatus).includes(query.status as CourseStatus)) {
    return { success: false, message: 'status must be DRAFT, PUBLISHED, or ARCHIVED.' };
  }
  const search = typeof query.search === 'string' ? query.search.trim() : undefined;
  const category = typeof query.category === 'string' ? query.category.trim() : undefined;
  if (query.search !== undefined && typeof query.search !== 'string') return { success: false, message: 'search must be a string.' };
  if (query.category !== undefined && typeof query.category !== 'string') return { success: false, message: 'category must be a string.' };
  if ((search?.length ?? 0) > limits.description || (category?.length ?? 0) > limits.category) return { success: false, message: 'Filter value is too long.' };
  return {
    success: true,
    data: {
      instructorId,
      ...(search ? { search } : {}),
      ...(category ? { category } : {}),
      ...(query.status ? { status: query.status as CourseStatus } : {}),
      sort,
      direction,
      skip: (page.data - 1) * limit.data,
      take: limit.data
    }
  };
}

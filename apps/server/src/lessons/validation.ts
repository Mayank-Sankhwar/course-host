import type { LessonFields } from './types.js';

const limits = { title: 200, content: 10_000 };
const lessonFieldNames = ['title', 'content'] as const;

type Validation<T> = { success: true; data: T } | { success: false; message: string };

function isObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function validateField(name: keyof LessonFields, value: unknown): Validation<string> {
  if (typeof value !== 'string') return { success: false, message: `${name} must be a string.` };
  const normalized = value.trim();
  if (!normalized) return { success: false, message: `${name} is required.` };
  if (normalized.length > limits[name]) return { success: false, message: `${name} must be at most ${limits[name]} characters.` };
  return { success: true, data: normalized };
}

function onlyLessonFields(input: Record<string, unknown>): boolean {
  return Object.keys(input).every((key) => lessonFieldNames.includes(key as keyof LessonFields));
}

export function validateCreateLesson(input: unknown): Validation<LessonFields> {
  if (!isObject(input) || !onlyLessonFields(input)) return { success: false, message: 'Only title and content may be provided.' };
  const title = validateField('title', input.title);
  const content = validateField('content', input.content);
  if (!title.success) return title;
  if (!content.success) return content;
  return { success: true, data: { title: title.data, content: content.data } };
}

export function validateUpdateLesson(input: unknown): Validation<Partial<LessonFields>> {
  if (!isObject(input) || !onlyLessonFields(input)) return { success: false, message: 'Only title and content may be updated.' };
  const supplied = lessonFieldNames.filter((field) => field in input);
  if (!supplied.length) return { success: false, message: 'Provide at least one field to update.' };
  const data: Partial<LessonFields> = {};
  for (const field of supplied) {
    const result = validateField(field, input[field]);
    if (!result.success) return result;
    data[field] = result.data;
  }
  return { success: true, data };
}

export function validateReorderLessonIds(input: unknown): Validation<string[]> {
  if (!isObject(input) || Object.keys(input).length !== 1 || !('lessonIds' in input) || !Array.isArray(input.lessonIds)) {
    return { success: false, message: 'Provide lessonIds as the complete ordered lesson ID list.' };
  }
  if (!input.lessonIds.every((id) => typeof id === 'string' && id.length > 0)) {
    return { success: false, message: 'lessonIds must contain non-empty strings.' };
  }
  const lessonIds = input.lessonIds as string[];
  if (new Set(lessonIds).size !== lessonIds.length) return { success: false, message: 'lessonIds must not contain duplicates.' };
  return { success: true, data: lessonIds };
}

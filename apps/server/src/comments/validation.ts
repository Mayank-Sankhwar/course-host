import type { CommentInput } from './service.js';

const maxWords = 50;
const maxCharacters = 2_000;

type Validation<T> = { success: true; data: T } | { success: false; message: string };

export function validateComment(input: unknown): Validation<CommentInput> {
  if (typeof input !== 'object' || input === null || Array.isArray(input) || Object.keys(input).length !== 1 || !('body' in input)) {
    return { success: false, message: 'Only body may be provided.' };
  }
  const body = (input as Record<string, unknown>).body;
  if (typeof body !== 'string') return { success: false, message: 'body must be a string.' };
  const normalized = body.trim();
  if (!normalized) return { success: false, message: 'Comment body is required.' };
  if (normalized.length > maxCharacters) return { success: false, message: `Comment body must be at most ${maxCharacters} characters.` };
  if (normalized.split(/\s+/).length > maxWords) return { success: false, message: 'Comment body must contain at most 50 words.' };
  return { success: true, data: { body: normalized } };
}

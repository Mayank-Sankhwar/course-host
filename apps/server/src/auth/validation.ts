import { Role } from '@prisma/client';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const minimumPasswordLength = 8;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return emailPattern.test(email);
}

export type Credentials = { email: string; password: string };

export type ValidationResult =
  | { success: true; data: Credentials }
  | { success: false; message: string };

export function validateCredentials(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object') {
    return { success: false, message: 'Email and password are required.' };
  }

  const { email, password } = input as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return { success: false, message: 'Email and password are required.' };
  }

  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    return { success: false, message: 'Provide a valid email address.' };
  }
  if (password.length < minimumPasswordLength) {
    return { success: false, message: `Password must be at least ${minimumPasswordLength} characters.` };
  }

  return { success: true, data: { email: normalizedEmail, password } };
}

export function validateLearnerSignupRole(input: unknown): { success: true } | { success: false; status: number; message: string } {
  if (input === undefined || input === Role.LEARNER) {
    return { success: true };
  }
  if (input === Role.INSTRUCTOR) {
    return { success: false, status: 403, message: 'Instructor registration is not available.' };
  }
  return { success: false, status: 400, message: 'Role must be LEARNER.' };
}

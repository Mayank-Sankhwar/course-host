import express, { Router } from 'express';
import { Role } from '@prisma/client';
import { requireAuth, requireRole } from '../auth/middleware.js';
import type { AuthUserRepository } from '../auth/types.js';
import { isValidEmail, normalizeEmail } from '../auth/validation.js';
import { CsvValidationError, csvLimits, multipartCsv, parseEmailCsv } from './csv.js';
import { InstructorEnrollmentError, instructorEnrollmentService } from './service.js';

function errorResponse(error: InstructorEnrollmentError) {
  if (error.kind === 'COURSE_NOT_FOUND') return { status: 404, message: 'Course not found.' };
  if (error.kind === 'LEARNER_NOT_FOUND') return { status: 404, message: 'Learner is not registered.' };
  if (error.kind === 'NOT_A_LEARNER') return { status: 400, message: 'The specified user is not a learner.' };
  if (error.kind === 'ALREADY_ENROLLED') return { status: 409, message: 'Learner is already enrolled in this course.' };
  if (error.kind === 'COURSE_NOT_PUBLISHED') return { status: 409, message: 'Learners can only be enrolled in published courses.' };
  return { status: 403, message: 'You do not have permission to perform this action.' };
}

function pagination(query: unknown) {
  const input = typeof query === 'object' && query !== null ? query as Record<string, unknown> : {};
  const page = input.page ?? '1';
  const limit = input.limit ?? '20';
  if (typeof page !== 'string' || typeof limit !== 'string' || !/^\d+$/.test(page) || !/^\d+$/.test(limit)) return null;
  const parsedPage = Number(page); const parsedLimit = Number(limit);
  if (!Number.isSafeInteger(parsedPage) || !Number.isSafeInteger(parsedLimit) || parsedPage < 1 || parsedLimit < 1 || parsedLimit > 50) return null;
  return { page: parsedPage, limit: parsedLimit, skip: (parsedPage - 1) * parsedLimit };
}

export function createInstructorEnrollmentRouter(users: AuthUserRepository) {
  const router = Router();
  const instructorOnly = [requireAuth(users), requireRole(Role.INSTRUCTOR)];

  router.post('/:courseId/enrollments', ...instructorOnly, async (request, response, next) => {
    if (typeof request.body !== 'object' || request.body === null || Array.isArray(request.body) || Object.keys(request.body).length !== 1 || typeof request.body.email !== 'string') {
      return response.status(400).json({ error: 'Provide only an email address.' });
    }
    const email = normalizeEmail(request.body.email);
    if (!isValidEmail(email)) return response.status(400).json({ error: 'Provide a valid email address.' });
    const courseId = request.params.courseId;
    if (typeof courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    try {
      response.status(201).json({ enrollment: await instructorEnrollmentService.add(courseId, request.authUser!.id, email) });
    } catch (error) {
      if (error instanceof InstructorEnrollmentError) { const result = errorResponse(error); return response.status(result.status).json({ error: result.message }); }
      next(error);
    }
  });

  router.post('/:courseId/enrollments/bulk', ...instructorOnly, express.raw({ type: 'multipart/form-data', limit: '512kb' }), async (request, response, next) => {
    const courseId = request.params.courseId;
    if (typeof courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    try {
      if (!Buffer.isBuffer(request.body)) throw new CsvValidationError('A CSV file upload is required.');
      const csv = multipartCsv(request.body, request.headers['content-type']);
      if (Buffer.byteLength(csv, 'utf8') > csvLimits.maxFileBytes) return response.status(413).json({ error: 'CSV file is too large.' });
      const emails = parseEmailCsv(csv);
      response.json(await instructorEnrollmentService.bulk(courseId, request.authUser!.id, emails));
    } catch (error) {
      if (error instanceof CsvValidationError) return response.status(400).json({ error: error.message });
      if (error instanceof InstructorEnrollmentError) { const result = errorResponse(error); return response.status(result.status).json({ error: result.message }); }
      next(error);
    }
  });

  router.get('/:courseId/enrollments', ...instructorOnly, async (request, response, next) => {
    const values = pagination(request.query);
    if (!values) return response.status(400).json({ error: 'page and limit must be positive integers; limit must not exceed 50.' });
    const courseId = request.params.courseId;
    if (typeof courseId !== 'string') return response.status(404).json({ error: 'Course not found.' });
    try {
      const result = await instructorEnrollmentService.list(courseId, request.authUser!.id, values.skip, values.limit);
      response.json({ ...result, page: values.page, limit: values.limit, totalPages: Math.ceil(result.total / values.limit) });
    } catch (error) {
      if (error instanceof InstructorEnrollmentError) { const result = errorResponse(error); return response.status(result.status).json({ error: result.message }); }
      next(error);
    }
  });
  return router;
}

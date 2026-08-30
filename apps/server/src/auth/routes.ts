import { Role } from '@prisma/client';
import { Router } from 'express';
import { isUniqueConstraintError } from './repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { destroySession, regenerateSession } from './session.js';
import { requireAuth } from './middleware.js';
import type { AuthUserRepository } from './types.js';
import { validateCredentials, validateLearnerSignupRole } from './validation.js';

export function createAuthRouter(users: AuthUserRepository) {
  const router = Router();
  const authenticate = requireAuth(users);

  router.post('/signup', async (request, response, next) => {
    const credentials = validateCredentials(request.body);
    if (!credentials.success) {
      response.status(400).json({ error: credentials.message });
      return;
    }
    const roleResult = validateLearnerSignupRole((request.body as Record<string, unknown>).role);
    if (!roleResult.success) {
      response.status(roleResult.status).json({ error: roleResult.message });
      return;
    }

    try {
      const passwordHash = await hashPassword(credentials.data.password);
      const user = await users.create({ ...credentials.data, passwordHash, role: Role.LEARNER });
      await regenerateSession(request);
      request.session.userId = user.id;
      response.status(201).json({ user });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        response.status(409).json({ error: 'Unable to create an account with those details.' });
        return;
      }
      next(error);
    }
  });

  router.post('/login', async (request, response, next) => {
    const credentials = validateCredentials(request.body);
    if (!credentials.success) {
      response.status(400).json({ error: credentials.message });
      return;
    }

    try {
      const user = await users.findByEmail(credentials.data.email);
      const valid = user ? await verifyPassword(user.passwordHash, credentials.data.password) : false;
      if (!user || !valid) {
        response.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
      await regenerateSession(request);
      request.session.userId = user.id;
      response.status(200).json({ user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', authenticate, (request, response) => {
    response.status(200).json({ user: request.authUser });
  });

  router.post('/logout', async (request, response, next) => {
    try {
      if (request.session.userId) {
        await destroySession(request);
      }
      response.clearCookie('coursehost.sid');
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

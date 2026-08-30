import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUserRepository } from './types.js';

export function requireAuth(users: AuthUserRepository) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const userId = request.session.userId;
    if (!userId) {
      response.status(401).json({ error: 'Authentication required.' });
      return;
    }

    try {
      const user = await users.findById(userId);
      if (!user) {
        request.session.destroy(() => undefined);
        response.status(401).json({ error: 'Authentication required.' });
        return;
      }
      request.authUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roles: Role[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.authUser) {
      response.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(request.authUser.role)) {
      response.status(403).json({ error: 'You do not have permission to perform this action.' });
      return;
    }
    next();
  };
}

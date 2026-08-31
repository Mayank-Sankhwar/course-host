import cors from 'cors';
import express from 'express';
import session from 'express-session';
import { createAuthRouter } from './auth/routes.js';
import { authUserRepository } from './auth/repository.js';
import type { AuthUserRepository } from './auth/types.js';
import { createCourseRouter } from './courses/routes.js';
import { courseRepository } from './courses/repository.js';
import type { CourseRepository } from './courses/types.js';
import { createLessonRouter } from './lessons/routes.js';
import { createLearnerRouter } from './learner/routes.js';
import { createCommentRouter } from './comments/routes.js';

type AppOptions = {
  clientOrigin: string;
  isProduction: boolean;
  sessionSecret: string;
  userRepository?: AuthUserRepository;
  courseRepository?: CourseRepository;
  registerRoutes?: (app: express.Express) => void;
};

export function createApp(options: AppOptions) {
  const app = express();
  const users = options.userRepository ?? authUserRepository;
  const courses = options.courseRepository ?? courseRepository;

  app.use(cors({ origin: options.clientOrigin, credentials: true }));
  app.use(express.json());
  app.use(session({
    name: 'coursehost.sid',
    secret: options.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: options.isProduction,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  }));

  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });
  app.use('/api/auth', createAuthRouter(users));
  app.use('/api/courses', createCourseRouter(users, courses));
  app.use('/api/courses/:courseId/lessons', createLessonRouter(users, courses));
  app.use('/api/courses', createCommentRouter(users));
  app.use('/api', createLearnerRouter(users));
  options.registerRoutes?.(app);

  app.use((_request, response) => {
    response.status(404).json({ error: 'Not found.' });
  });
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error('Unexpected request error', error);
    response.status(500).json({ error: 'An unexpected error occurred.' });
  });

  return app;
}

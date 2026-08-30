import cors from 'cors';
import express from 'express';
import session from 'express-session';
import { createAuthRouter } from './auth/routes.js';
import { authUserRepository } from './auth/repository.js';
import type { AuthUserRepository } from './auth/types.js';

type AppOptions = {
  clientOrigin: string;
  isProduction: boolean;
  sessionSecret: string;
  userRepository?: AuthUserRepository;
  registerRoutes?: (app: express.Express) => void;
};

export function createApp(options: AppOptions) {
  const app = express();
  const users = options.userRepository ?? authUserRepository;

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

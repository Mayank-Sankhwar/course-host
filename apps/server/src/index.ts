import 'dotenv/config';
//console.log('DATABASE_URL:', process.env.DATABASE_URL);
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3001);
const sessionSecret = process.env.SESSION_SECRET;
const clientOrigin = process.env.CLIENT_ORIGIN;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be configured with at least 32 characters.');
}
if (process.env.NODE_ENV === 'production' && !clientOrigin) {
  throw new Error('CLIENT_ORIGIN must be configured in production.');
}

const app = createApp({
  clientOrigin: clientOrigin ?? 'http://localhost:5173',
  isProduction: process.env.NODE_ENV === 'production',
  sessionSecret
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

import cors from 'cors';
import express from 'express';

export const app = express();

app.use(cors());
app.use(express.json());

// Intentionally limited to a health check during the foundation phase.
app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

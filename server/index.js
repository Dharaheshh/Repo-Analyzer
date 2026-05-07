import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import connect from './config/db.js';
import analysisRoutes from './routes/analysisRoutes.js';
import { validateAIProviderOnStartup } from './services/aiProviderService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Routes
app.use('/api', analysisRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// 404 handler
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

connect()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);

      // Startup AI validation is intentionally non-fatal. If Gemini is down,
      // analysis requests still succeed through numeric fallback.
      validateAIProviderOnStartup().catch((err) => {
        console.warn('[ai] Startup validation failed:', err.message);
      });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `Port ${PORT} is already in use. Stop the existing dev server and run npm run dev again.`
        );
        process.exit(1);
      }

      console.error('Server failed to listen:', err.message);
      process.exit(1);
    });
  })
  .catch((err) => {
    console.error('Server startup failed:', err.message);
    process.exit(1);
  });

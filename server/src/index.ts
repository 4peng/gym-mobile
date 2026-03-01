import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

// Force Google DNS for MongoDB SRV resolution
dns.setServers(['8.8.8.8', '8.8.4.4']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import programRoutes from './routes/programs.js';
import workoutRoutes from './routes/workouts.js';

// Load env from root if not in server
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is not defined in .env');
  process.exit(1);
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint: list available endpoints
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Gym Tracker API',
    endpoints: {
      health: 'GET /health',
      programs: [
        'GET /programs?userId=...',
        'PUT /programs (Upsert)',
        'DELETE /programs/:id',
        'PUT /programs/batch (Batch Upsert)'
      ],
      workouts: [
        'GET /workouts?userId=...',
        'PUT /workouts (Upsert)',
        'PUT /workouts/batch (Batch Upsert)'
      ]
    }
  });
});

// Routes
app.use('/programs', programRoutes);
app.use('/workouts', workoutRoutes);

// Export the app for Vercel
export default app;

// Connect to MongoDB
if (process.env.NODE_ENV !== 'production') {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err);
    });
} else {
  // In production (Vercel), we still need to connect to MongoDB
  // Mongoose handles buffering, but top-level await or a middleware check is better for serverless
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB (Serverless)'))
    .catch(err => console.error('MongoDB connection error:', err));
}

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

// Fix for SRV lookup issues in some environments
dns.setServers(['8.8.8.8', '8.8.4.4']);

import programRoutes from './routes/programs.js';
import workoutRoutes from './routes/workouts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('CRITICAL: MONGODB_URI is not defined in environment variables!');
}

// 1. Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// 2. Health check (reachable even when Mongo is down; reports real connection state)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    readyState: mongoose.connection.readyState
  });
});

// 3. Database connection middleware (MUST be before routes, but after /health)
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  try {
    console.log('Database not connected. Connecting now...');
    await mongoose.connect(MONGODB_URI!, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Database connected successfully via middleware.');
    next();
  } catch (err) {
    console.error('Database connection error in middleware:', err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// 4. Routes
app.use('/programs', programRoutes);
app.use('/workouts', workoutRoutes);

// 5. Default Route
app.get('/', (req, res) => {
  res.send('Welcome to the Gym Tracker API');
});

// Connect to MongoDB for local dev
if (process.env.NODE_ENV !== 'production') {
  mongoose.connect(MONGODB_URI!)
    .then(() => {
      console.log('Connected to MongoDB (Local)');
      // Listen on 0.0.0.0 to allow local network access
      app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err);
    });
} else {
  console.log('Running in Production mode (Vercel).');
  mongoose.connect(MONGODB_URI!, {
    serverSelectionTimeoutMS: 5000,
  })
    .then(() => console.log('Connected to MongoDB (Serverless Early Connect)'))
    .catch(err => console.error('MongoDB early connection error:', err.message));
}

export default app;

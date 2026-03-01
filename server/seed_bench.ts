import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import Workout from './src/models/Workout.js';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: '../.env' });

const MONGODB_URI = process.env.MONGODB_URI;
const USER_ID = 'default-user';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in environment');
  process.exit(1);
}

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI!);
    console.log('Connected to MongoDB for 1-year Bench Press seeding...');

    const workouts = [];
    const now = new Date();
    
    // Simulate 52 weeks (1 year)
    for (let i = 52; i >= 0; i--) {
      const sessionDate = new Date(now);
      sessionDate.setDate(now.getDate() - (i * 7)); // Once a week
      sessionDate.setHours(17, 0, 0, 0);

      const completionDate = new Date(sessionDate);
      completionDate.setMinutes(sessionDate.getMinutes() + 60);

      // Strength progression: Start at 60kg, end around 100kg
      const weeksPassed = 52 - i;
      const baseWeight = 60 + (weeksPassed * 0.75); 
      
      const benchSets = [];
      for (let s = 0; s < 3; s++) {
        benchSets.push({
          id: uuidv4(),
          weight: Math.round(baseWeight + (Math.random() * 2.5)),
          reps: 8 + Math.floor(Math.random() * 3),
          completedAt: completionDate.toISOString()
        });
      }

      const otherExercises = [
        {
          id: uuidv4(),
          name: 'Push Ups',
          restSeconds: 60,
          notes: 'Secondary exercise',
          sets: [
            { id: uuidv4(), weight: 0, reps: 15, completedAt: completionDate.toISOString() },
            { id: uuidv4(), weight: 0, reps: 12, completedAt: completionDate.toISOString() }
          ]
        }
      ];

      workouts.push({
        _id: uuidv4(),
        userId: USER_ID,
        startedAt: sessionDate.toISOString(),
        completedAt: completionDate.toISOString(),
        updatedAt: sessionDate.getTime(),
        exercises: [
          {
            id: uuidv4(),
            name: 'Bench Press',
            restSeconds: 120,
            notes: 'Main lift',
            sets: benchSets,
            weightUnit: 'kg'
          },
          ...otherExercises
        ]
      });
    }

    // Optional: Clear previous bench data if you want a clean year
    // await Workout.deleteMany({ userId: USER_ID, "exercises.name": "Bench Press" });

    await Workout.insertMany(workouts);
    console.log(`Successfully injected ${workouts.length} Bench Press sessions over 1 year!`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();

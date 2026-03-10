import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Workout from './src/models/Workout.js';
import Program from './src/models/Program.js';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: '../.env' });

const MONGODB_URI = process.env.MONGODB_URI;
const USER_ID = 'default-user';

async function clearDb() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('--- CLEARING DATABASE ---');
    console.log(`User: ${USER_ID}`);
    
    const workoutResult = await Workout.deleteMany({ userId: USER_ID });
    console.log(`Deleted ${workoutResult.deletedCount} workouts`);

    const programResult = await Program.deleteMany({ userId: USER_ID });
    console.log(`Deleted ${programResult.deletedCount} programs`);

    console.log('\nDatabase cleared successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Clear failed:', err);
    process.exit(1);
  }
}

clearDb();

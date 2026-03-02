import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Workout from './src/models/Workout.js';
import Program from './src/models/Program.js';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config({ path: '../.env' });

const MONGODB_URI = process.env.MONGODB_URI;
const USER_ID = 'default-user';

async function diagnose() {
  try {
    await mongoose.connect(MONGODB_URI!);
    console.log('--- DATABASE DIAGNOSTICS ---');
    
    const workoutCount = await Workout.countDocuments({ userId: USER_ID });
    const deletedWorkoutCount = await Workout.countDocuments({ userId: USER_ID, deletedAt: { $ne: null } });
    const activeWorkoutCount = await Workout.countDocuments({ userId: USER_ID, deletedAt: null });

    console.log(`User: ${USER_ID}`);
    console.log(`Total Workouts: ${workoutCount}`);
    console.log(`Active Workouts: ${activeWorkoutCount}`);
    console.log(`Soft-Deleted Workouts: ${deletedWorkoutCount}`);

    if (activeWorkoutCount > 0) {
      const samples = await Workout.find({ userId: USER_ID, deletedAt: null }).limit(5);
      console.log('\nSample Active Workouts:');
      samples.forEach(w => {
        const firstEx = w.exercises[0]?.name || 'No exercises';
        console.log(`- ID: ${w._id} | Date: ${w.startedAt} | Ex: ${firstEx}... (${w.exercises.length} total)`);
      });
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Diag failed:', err);
    process.exit(1);
  }
}

diagnose();

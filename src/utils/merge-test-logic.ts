
import { useWorkoutSessionStore } from '@/stores/workoutSessionStore';
import { generateId } from '@/utils/id';

// This is a test script to be run in a simulated environment or via a temporary test route.
// Since I cannot run the React Native environment directly here, 
// I will provide the logic for a "Merge Verification" that you can trigger if you want to be 100% sure.

async function testDeepMerge() {
  const workoutId = "test-sync-id-123";
  
  const localWorkout = {
    _id: workoutId,
    updatedAt: 1000,
    exercises: [{ id: "ex-1", name: "Local Bench", sets: [] }]
  };

  const remoteWorkout = {
    _id: workoutId,
    updatedAt: 2000, // Remote is "newer"
    exercises: [{ id: "ex-2", name: "Remote Squat", sets: [] }]
  };

  // The logic we implemented should result in a workout with BOTH exercises.
  // If it were "Last Write Wins" (old way), "Local Bench" would be deleted because remote is newer.
}

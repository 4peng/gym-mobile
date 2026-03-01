import { Router } from 'express';
import Workout from '../models/Workout.js';

const router = Router();

// GET all workouts for a user
router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const workouts = await Workout.find({ userId: userId as string });
    res.json(workouts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
});

// PUT (Upsert) a workout
router.put('/', async (req, res) => {
  const workoutData = req.body;
  if (!workoutData._id || !workoutData.userId) {
    return res.status(400).json({ error: '_id and userId are required' });
  }

  try {
    const workout = await Workout.findOneAndUpdate(
      { _id: workoutData._id },
      workoutData,
      { upsert: true, new: true }
    );
    res.json(workout);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upsert workout' });
  }
});

// BATCH PUT (Upsert)
router.put('/batch', async (req, res) => {
  const { workouts } = req.body;
  if (!Array.isArray(workouts)) {
    return res.status(400).json({ error: 'workouts array is required' });
  }

  try {
    const ops = workouts.map((w) => ({
      updateOne: {
        filter: { _id: w._id },
        update: w,
        upsert: true,
      },
    }));

    await Workout.bulkWrite(ops);

    const ids = workouts.map(w => w._id);
    const updated = await Workout.find({ _id: { $in: ids } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to batch upsert workouts' });
  }
});

export default router;

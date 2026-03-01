import { Router } from 'express';
import Workout from '../models/Workout.js';

const router = Router();

// GET workouts for a user (with Delta Sync and Pagination support)
router.get('/', async (req, res) => {
  const { userId, limit, skip, since } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const query: any = { userId: userId as string };
    
    if (since) {
      // Delta Sync: Fetch everything modified since last sync (including deleted)
      query.updatedAt = { $gt: parseInt(since as string) };
    } else {
      // Initial Sync: Only fetch active (non-deleted) workouts
      query.deletedAt = null;
    }

    const mQuery = Workout.find(query).sort({ completedAt: -1, startedAt: -1 });

    if (limit) mQuery.limit(parseInt(limit as string));
    if (skip) mQuery.skip(parseInt(skip as string));

    const workouts = await mQuery.exec();
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
      { ...workoutData, deletedAt: null }, // Ensure it's not marked deleted if re-uploaded
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
        update: { ...w, deletedAt: null },
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

// DELETE a workout (Soft Delete)
router.delete('/:id', async (req, res) => {
  try {
    await Workout.updateOne(
      { _id: req.params.id },
      { 
        deletedAt: Date.now(),
        updatedAt: Date.now()
      }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to soft delete workout' });
  }
});

export default router;

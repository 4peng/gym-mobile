import { Router } from 'express';
import Workout from '../models/Workout.js';

const router = Router();

function isIncomingWriteStale(
  existingUpdatedAt: unknown,
  incomingUpdatedAt: unknown
): boolean {
  return (
    typeof existingUpdatedAt === 'number' &&
    Number.isFinite(existingUpdatedAt) &&
    typeof incomingUpdatedAt === 'number' &&
    Number.isFinite(incomingUpdatedAt) &&
    existingUpdatedAt > incomingUpdatedAt
  );
}

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
    const existing = await Workout.findOne({
      _id: workoutData._id,
      userId: workoutData.userId,
    });

    if (existing && isIncomingWriteStale(existing.updatedAt, workoutData.updatedAt)) {
      return res.json(existing);
    }

    const serverUpdatedAt = Date.now();
    const workout = await Workout.findOneAndUpdate(
      { _id: workoutData._id, userId: workoutData.userId },
      { ...workoutData, updatedAt: serverUpdatedAt }, // Server assigns the accepted version timestamp.
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
    if (workouts.length === 0) {
      return res.json([]);
    }

    const existingWorkouts = await Workout.find({
      $or: workouts.map((w) => ({ _id: w._id, userId: w.userId })),
    });
    const existingByKey = new Map(
      existingWorkouts.map((workout) => [`${workout.userId}:${workout._id}`, workout])
    );
    const serverUpdatedAt = Date.now();

    const ops = workouts
      .filter((workout) => {
        const existing = existingByKey.get(`${workout.userId}:${workout._id}`);
        return !existing || !isIncomingWriteStale(existing.updatedAt, workout.updatedAt);
      })
      .map((workout) => ({
        updateOne: {
          filter: { _id: workout._id, userId: workout.userId },
          update: { ...workout, updatedAt: serverUpdatedAt },
          upsert: true,
        },
      }));

    if (ops.length > 0) {
      await Workout.bulkWrite(ops);
    }

    const updated = await Workout.find({
      $or: workouts.map((w) => ({ _id: w._id, userId: w.userId })),
    });
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

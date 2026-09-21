import { Router } from 'express';
import { z } from 'zod';
import { workoutSchema, batchWorkoutSchema, deleteQuerySchema, validateOrError } from '../validation/schemas.js';
import * as workoutService from '../services/workoutService.js';

const router = Router();

// GET workouts for a user (with Delta Sync and Pagination support)
router.get('/', async (req, res) => {
  const { userId, limit, skip, since } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const workouts = await workoutService.findAll(
      userId as string,
      limit as string | undefined,
      skip as string | undefined,
      since as string | undefined,
    );
    res.json(workouts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
});

// PUT (Upsert) a workout
router.put('/', async (req, res) => {
  const validation = validateOrError(workoutSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const workout = await workoutService.upsertOne(validation.data);
    res.json(workout);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upsert workout' });
  }
});

// BATCH PUT (Upsert)
router.put('/batch', async (req, res) => {
  const validation = validateOrError(batchWorkoutSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const { workouts } = validation.data;
    if (workouts.length === 0) {
      return res.json([]);
    }
    const updated = await workoutService.batchUpsert(workouts);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to batch upsert workouts' });
  }
});

// DELETE /batch — Soft delete multiple workouts in one bulkWrite
router.delete('/batch', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array is required' });
  }

  const userValidation = validateOrError(deleteQuerySchema, { userId: req.query.userId ?? req.headers['x-user-id'] });
  if (!userValidation.success) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const count = await workoutService.softDeleteBatch(ids, userValidation.data.userId);
    res.json({ ok: true, deleted: count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to batch delete workouts' });
  }
});

// DELETE a workout (Soft Delete)
router.delete('/:id', async (req, res) => {
  const userValidation = validateOrError(deleteQuerySchema, {
    userId: typeof req.query.userId === 'string'
      ? req.query.userId
      : typeof req.headers['x-user-id'] === 'string'
        ? req.headers['x-user-id']
        : undefined,
  });
  if (!userValidation.success) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const updated = await workoutService.softDelete(req.params.id, userValidation.data.userId);
    if (!updated) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to soft delete workout' });
  }
});

export default router;

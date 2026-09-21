import { Router } from 'express';
import { z } from 'zod';
import { programSchema, batchProgramSchema, deleteQuerySchema, validateOrError } from '../validation/schemas.js';
import * as programService from '../services/programService.js';

const router = Router();

// GET all programs for a user (with Delta Sync support)
router.get('/', async (req, res) => {
  const { userId, since } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const programs = await programService.findAll(userId as string, since as string | undefined);
    res.json(programs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
});

// PUT (Upsert) a program
router.put('/', async (req, res) => {
  const validation = validateOrError(programSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const program = await programService.upsertOne(validation.data);
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upsert program' });
  }
});

// BATCH PUT (Upsert)
router.put('/batch', async (req, res) => {
  const validation = validateOrError(batchProgramSchema, req.body);
  if (!validation.success) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const { programs } = validation.data;
    if (programs.length === 0) {
      return res.json([]);
    }
    const updated = await programService.batchUpsert(programs);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to batch upsert programs' });
  }
});

// DELETE /batch — Soft delete multiple programs in one bulkWrite
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
    const count = await programService.softDeleteBatch(ids, userValidation.data.userId);
    res.json({ ok: true, deleted: count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to batch delete programs' });
  }
});

// DELETE a program (supports soft-delete and permanent delete)
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
    if (req.query.permanent === 'true') {
      const deleted = await programService.permanentDelete(req.params.id, userValidation.data.userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Program not found' });
      }
      return res.json({ ok: true, permanent: true });
    }

    // Mobile sync relies on tombstones for deletions, so soft-delete remains default.
    const updated = await programService.softDelete(req.params.id, userValidation.data.userId);
    if (!updated) {
      return res.status(404).json({ error: 'Program not found' });
    }
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete program' });
  }
});

export default router;

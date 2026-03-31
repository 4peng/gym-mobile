import { Router } from 'express';
import Program from '../models/Program.js';

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

// GET all programs for a user (with Delta Sync support)
router.get('/', async (req, res) => {
  const { userId, since } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const query: any = { userId: userId as string };
    
    if (since) {
      // Delta Sync: Return everything modified since 'since' (including soft-deleted ones)
      query.updatedAt = { $gt: parseInt(since as string) };
    } else {
      // Initial Sync: Only return active (non-deleted) programs
      query.deletedAt = null;
    }

    const programs = await Program.find(query);
    res.json(programs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
});

// PUT (Upsert) a program
router.put('/', async (req, res) => {
  const programData = req.body;
  if (!programData._id || !programData.userId) {
    return res.status(400).json({ error: '_id and userId are required' });
  }

  try {
    const existing = await Program.findOne({
      _id: programData._id,
      userId: programData.userId,
    });

    if (existing && isIncomingWriteStale(existing.updatedAt, programData.updatedAt)) {
      return res.json(existing);
    }

    const serverUpdatedAt = Date.now();
    const program = await Program.findOneAndUpdate(
      { _id: programData._id, userId: programData.userId },
      { ...programData, updatedAt: serverUpdatedAt }, // Server assigns the accepted version timestamp.
      { upsert: true, new: true }
    );
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upsert program' });
  }
});

// BATCH PUT (Upsert)
router.put('/batch', async (req, res) => {
  const { programs } = req.body;
  if (!Array.isArray(programs)) {
    return res.status(400).json({ error: 'programs array is required' });
  }

  try {
    if (programs.length === 0) {
      return res.json([]);
    }

    const existingPrograms = await Program.find({
      $or: programs.map((p) => ({ _id: p._id, userId: p.userId })),
    });
    const existingByKey = new Map(
      existingPrograms.map((program) => [`${program.userId}:${program._id}`, program])
    );
    const serverUpdatedAt = Date.now();

    const ops = programs
      .filter((program) => {
        const existing = existingByKey.get(`${program.userId}:${program._id}`);
        return !existing || !isIncomingWriteStale(existing.updatedAt, program.updatedAt);
      })
      .map((program) => ({
        updateOne: {
          filter: { _id: program._id, userId: program.userId },
          update: { ...program, updatedAt: serverUpdatedAt },
          upsert: true,
        },
      }));

    if (ops.length > 0) {
      await Program.bulkWrite(ops);
    }

    const updated = await Program.find({
      $or: programs.map((p) => ({ _id: p._id, userId: p.userId })),
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to batch upsert programs' });
  }
});

// DELETE a program
router.delete('/:id', async (req, res) => {
  try {
    const requestedUserId =
      typeof req.query.userId === 'string'
        ? req.query.userId
        : typeof req.headers['x-user-id'] === 'string'
          ? req.headers['x-user-id']
          : undefined;
    const filter: Record<string, string> = { _id: req.params.id };
    if (requestedUserId) {
      filter.userId = requestedUserId;
    }

    if (req.query.permanent === 'true') {
      const deleted = await Program.findOneAndDelete(filter);
      if (!deleted) {
        return res.status(404).json({ error: 'Program not found' });
      }
      return res.json({ ok: true, permanent: true });
    }

    // Mobile sync relies on tombstones for deletions, so soft-delete remains default.
    const updated = await Program.findOneAndUpdate(
      filter,
      {
        deletedAt: Date.now(),
        updatedAt: Date.now()
      },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Program not found' });
    }
    return res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete program' });
  }
});

export default router;

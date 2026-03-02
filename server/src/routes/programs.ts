import { Router } from 'express';
import Program from '../models/Program.js';

const router = Router();

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
    const program = await Program.findOneAndUpdate(
      { _id: programData._id },
      { ...programData }, // Respect deletedAt
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
    const ops = programs.map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: { ...p },
        upsert: true,
      },
    }));

    await Program.bulkWrite(ops);

    const ids = programs.map(p => p._id);
    const updated = await Program.find({ _id: { $in: ids } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to batch upsert programs' });
  }
});

// DELETE a program (Soft Delete)
router.delete('/:id', async (req, res) => {
  try {
    // We update deletedAt and updatedAt so clients know to remove it.
    await Program.updateOne(
      { _id: req.params.id },
      { 
        deletedAt: Date.now(),
        updatedAt: Date.now()
      }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to soft delete program' });
  }
});

export default router;

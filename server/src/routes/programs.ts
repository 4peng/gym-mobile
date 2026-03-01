import { Router } from 'express';
import Program from '../models/Program.js';

const router = Router();

// GET all programs for a user
router.get('/', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const programs = await Program.find({ userId: userId as string });
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
      programData,
      { upsert: true, new: true }
    );
    res.json(program);
  } catch (err) {
    res.status(500).json({ error: 'Failed to upsert program' });
  }
});

// DELETE a program
router.delete('/:id', async (req, res) => {
  try {
    await Program.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete program' });
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
        update: p,
        upsert: true,
      },
    }));

    await Program.bulkWrite(ops);
    
    // Return the updated list (optional, but sync engine might expect it)
    const ids = programs.map(p => p._id);
    const updated = await Program.find({ _id: { $in: ids } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to batch upsert programs' });
  }
});

export default router;

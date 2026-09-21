import Program from '../models/Program.js';
import { isIncomingWriteStale } from '../utils/sync.js';

// ──────────────────────────────────────────────
// Program service — all Mongoose operations
// ──────────────────────────────────────────────

export async function findAll(userId: string, since?: string) {
  const query: any = { userId };

  if (since) {
    const sinceNum = parseInt(since, 10);
    query.updatedAt = { $gt: Number.isFinite(sinceNum) && sinceNum > 0 ? sinceNum : 0 };
  } else {
    query.deletedAt = null;
  }

  return Program.find(query);
}

export async function upsertOne(programData: any) {
  const existing = await Program.findOne({
    _id: programData._id,
    userId: programData.userId,
  });

  if (existing && isIncomingWriteStale(existing.updatedAt, programData.updatedAt)) {
    return existing;
  }

  const serverUpdatedAt = Date.now();
  return Program.findOneAndUpdate(
    { _id: programData._id, userId: programData.userId },
    { ...programData, updatedAt: serverUpdatedAt },
    { upsert: true, new: true }
  );
}

export async function batchUpsert(programs: any[]) {
  if (programs.length === 0) return [];

  const existingPrograms = await Program.find({
    $or: programs.map((p) => ({ _id: p._id, userId: p.userId })),
  });
  const existingByKey = new Map(
    existingPrograms.map((p) => [`${p.userId}:${p._id}`, p])
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

  return Program.find({
    $or: programs.map((p) => ({ _id: p._id, userId: p.userId })),
  });
}

export async function softDelete(id: string, userId: string) {
  const now = Date.now();
  return Program.findOneAndUpdate(
    { _id: id, userId },
    { $set: { deletedAt: now, updatedAt: now } },
    { new: true }
  );
}

export async function permanentDelete(id: string, userId: string) {
  return Program.findOneAndDelete({ _id: id, userId });
}

export async function softDeleteBatch(ids: string[], userId: string) {
  const now = Date.now();
  const result = await Program.bulkWrite(
    ids.map((id) => ({
      updateOne: {
        filter: { _id: id, userId },
        update: { $set: { deletedAt: now, updatedAt: now } },
      },
    }))
  );
  return result.modifiedCount ?? 0;
}

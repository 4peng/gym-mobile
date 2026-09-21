import Workout from '../models/Workout.js';
import { isIncomingWriteStale } from '../utils/sync.js';

// ──────────────────────────────────────────────
// Workout service — all Mongoose operations
// ──────────────────────────────────────────────

export async function findAll(userId: string, limit?: string, skip?: string, since?: string) {
  const query: any = { userId };

  if (since) {
    const sinceNum = parseInt(since, 10);
    query.updatedAt = { $gt: Number.isFinite(sinceNum) && sinceNum > 0 ? sinceNum : 0 };
  } else {
    query.deletedAt = null;
  }

  const mQuery = Workout.find(query).sort({ completedAt: -1, startedAt: -1 });

  if (limit) mQuery.limit(parseInt(limit, 10));
  if (skip) mQuery.skip(parseInt(skip, 10));

  return mQuery.exec();
}

export async function upsertOne(workoutData: any) {
  const existing = await Workout.findOne({
    _id: workoutData._id,
    userId: workoutData.userId,
  });

  if (existing && isIncomingWriteStale(existing.updatedAt, workoutData.updatedAt)) {
    return existing;
  }

  const serverUpdatedAt = Date.now();
  return Workout.findOneAndUpdate(
    { _id: workoutData._id, userId: workoutData.userId },
    { ...workoutData, updatedAt: serverUpdatedAt },
    { upsert: true, new: true }
  );
}

export async function batchUpsert(workouts: any[]) {
  if (workouts.length === 0) return [];

  const existingWorkouts = await Workout.find({
    $or: workouts.map((w) => ({ _id: w._id, userId: w.userId })),
  });
  const existingByKey = new Map(
    existingWorkouts.map((w) => [`${w.userId}:${w._id}`, w])
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

  return Workout.find({
    $or: workouts.map((w) => ({ _id: w._id, userId: w.userId })),
  });
}

export async function softDelete(id: string, userId: string) {
  const now = Date.now();
  return Workout.findOneAndUpdate(
    { _id: id, userId },
    { $set: { deletedAt: now, updatedAt: now } },
    { new: true }
  );
}

export async function softDeleteBatch(ids: string[], userId: string) {
  const now = Date.now();
  const result = await Workout.bulkWrite(
    ids.map((id) => ({
      updateOne: {
        filter: { _id: id, userId },
        update: { $set: { deletedAt: now, updatedAt: now } },
      },
    }))
  );
  return result.modifiedCount ?? 0;
}

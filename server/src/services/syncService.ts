import type { Model, SortOrder } from "mongoose";

// ──────────────────────────────────────────────
// Sync service: the same three operations for every synced collection
// (delta fetch, last-write-wins batch upsert, batch soft-delete).
// ──────────────────────────────────────────────

interface SyncedDoc {
  _id: string;
  userId: string;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface FindAllOptions {
  since?: string;
  limit?: string;
  skip?: string;
}

/** Server wins when its copy is strictly newer than the incoming write. */
function isIncomingWriteStale(existing: unknown, incoming: unknown): boolean {
  return typeof existing === "number" && typeof incoming === "number" && existing > incoming;
}

export function makeSyncService<T extends SyncedDoc>(
  Model: Model<T>,
  sort?: Record<string, SortOrder>,
) {
  return {
    findAll(userId: string, { since, limit, skip }: FindAllOptions) {
      const query: Record<string, unknown> = { userId };
      if (since) {
        const sinceNum = parseInt(since, 10);
        // Delta sync returns tombstones too, so the client can drop them.
        query.updatedAt = { $gt: Number.isFinite(sinceNum) && sinceNum > 0 ? sinceNum : 0 };
      } else {
        query.deletedAt = null;
      }

      let q = Model.find(query);
      if (sort) q = q.sort(sort);
      if (limit) q = q.limit(parseInt(limit, 10));
      if (skip) q = q.skip(parseInt(skip, 10));
      return q.exec();
    },

    async batchUpsert(docs: T[]) {
      if (docs.length === 0) return [];

      const keys = docs.map((d) => ({ _id: d._id, userId: d.userId }));
      const existing = await Model.find({ $or: keys });
      const existingByKey = new Map(existing.map((d) => [`${d.userId}:${d._id}`, d]));
      const serverUpdatedAt = Date.now();

      const ops = docs
        .filter((doc) => {
          const prev = existingByKey.get(`${doc.userId}:${doc._id}`);
          return !prev || !isIncomingWriteStale(prev.updatedAt, doc.updatedAt);
        })
        .map((doc) => ({
          updateOne: {
            filter: { _id: doc._id, userId: doc.userId },
            update: { ...doc, updatedAt: serverUpdatedAt },
            upsert: true,
          },
        }));

      if (ops.length > 0) {
        await Model.bulkWrite(ops as never);
      }

      return Model.find({ $or: keys });
    },

    async softDeleteBatch(ids: string[], userId: string) {
      const now = Date.now();
      const result = await Model.bulkWrite(
        ids.map((id) => ({
          updateOne: {
            filter: { _id: id, userId },
            update: { $set: { deletedAt: now, updatedAt: now } },
          },
        })) as never,
      );
      return result.modifiedCount ?? 0;
    },
  };
}

export type SyncService = ReturnType<typeof makeSyncService>;

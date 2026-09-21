import type { Model, SortOrder } from "mongoose";

// ──────────────────────────────────────────────
// Backup service: the same three operations for every mirrored collection.
// The phone is the source of truth, so upserts always win and deletes are hard.
// ──────────────────────────────────────────────

interface MirroredDoc {
  _id: string;
  userId: string;
}

export interface FindAllOptions {
  limit?: string;
  skip?: string;
}

export function makeSyncService<T extends MirroredDoc>(
  Model: Model<T>,
  sort?: Record<string, SortOrder>,
) {
  return {
    /** Every live document for the user, optionally paged. Legacy tombstones (deletedAt set) are excluded. */
    findAll(userId: string, { limit, skip }: FindAllOptions) {
      let q = Model.find({ userId, deletedAt: null } as never);
      if (sort) q = q.sort(sort);
      if (skip) q = q.skip(parseInt(skip, 10));
      if (limit) q = q.limit(parseInt(limit, 10));
      return q.exec();
    },

    async batchUpsert(docs: T[]) {
      if (docs.length === 0) return [];
      await Model.bulkWrite(
        docs.map((doc) => ({
          replaceOne: {
            filter: { _id: doc._id, userId: doc.userId },
            replacement: doc,
            upsert: true,
          },
        })) as never,
      );
      return Model.find({ $or: docs.map((d) => ({ _id: d._id, userId: d.userId })) } as never);
    },

    async deleteBatch(ids: string[], userId: string) {
      const result = await Model.deleteMany({ _id: { $in: ids }, userId } as never);
      return result.deletedCount ?? 0;
    },
  };
}

export type SyncService = ReturnType<typeof makeSyncService>;

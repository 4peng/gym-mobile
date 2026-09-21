import { Router } from "express";
import type { ZodSchema } from "zod";
import { deleteBatchSchema, validateOrError } from "../validation/schemas.js";
import type { SyncService } from "../services/syncService.js";

// ──────────────────────────────────────────────
// Sync router: GET / (delta fetch), PUT /batch (upsert), DELETE /batch (soft delete).
// The mobile client only ever calls these three.
// ──────────────────────────────────────────────

export function makeSyncRouter<K extends string>(
  service: SyncService,
  batchSchema: ZodSchema<Record<K, unknown[]>>,
  key: K,
) {
  const router = Router();

  router.get("/", async (req, res) => {
    const { userId, since, limit, skip } = req.query as Record<string, string | undefined>;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    try {
      res.json(await service.findAll(userId, { since, limit, skip }));
    } catch {
      res.status(500).json({ error: `Failed to fetch ${key}` });
    }
  });

  router.put("/batch", async (req, res) => {
    const validation = validateOrError(batchSchema, req.body);
    if (!validation.success) return res.status(400).json({ error: validation.error });

    try {
      res.json(await service.batchUpsert(validation.data[key] as never));
    } catch {
      res.status(500).json({ error: `Failed to batch upsert ${key}` });
    }
  });

  router.delete("/batch", async (req, res) => {
    const body = validateOrError(deleteBatchSchema, req.body);
    if (!body.success) return res.status(400).json({ error: body.error });

    const userId = req.headers["x-user-id"] ?? req.query.userId;
    if (typeof userId !== "string" || !userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    try {
      const deleted = await service.softDeleteBatch(body.data.ids, userId);
      res.json({ ok: true, deleted });
    } catch {
      res.status(500).json({ error: `Failed to batch delete ${key}` });
    }
  });

  return router;
}

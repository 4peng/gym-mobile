import { Schema } from 'mongoose';

function applyUpdatedAt(update: Record<string, any>, updatedAt: number) {
  const hasMongoOperators = Object.keys(update).some((key) => key.startsWith('$'));
  if (hasMongoOperators) {
    update.$set = {
      ...(update.$set ?? {}),
      updatedAt,
    };
    return;
  }

  update.updatedAt = updatedAt;
}

export { applyUpdatedAt };

export default function updatedAtPlugin(schema: Schema) {
  schema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
  });

  for (const operation of ['findOneAndUpdate', 'updateOne', 'updateMany', 'replaceOne'] as const) {
    schema.pre(operation, function (next) {
      const update = this.getUpdate();
      if (update && typeof update === 'object' && !Array.isArray(update)) {
        applyUpdatedAt(update as Record<string, any>, Date.now());
        this.setUpdate(update);
      }
      next();
    });
  }
}

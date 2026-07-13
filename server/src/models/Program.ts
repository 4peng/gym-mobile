import mongoose, { Schema, Document } from 'mongoose';

export interface IProgramSetTemplate {
  type: 'working' | 'warmup' | 'dropset';
}

export interface IProgramExercise {
  id: string;
  exerciseDefinitionId?: string;
  trackingMode?: 'strength' | 'timed' | 'cardio';
  name: string;
  // Legacy docs store a plain set count (number). Current docs store the
  // set-type template array so warmup/dropset markers survive sync. The
  // schema field below uses Mixed so hydrating old numeric documents
  // doesn't throw a cast error.
  defaultSets: number | IProgramSetTemplate[];
  restSeconds: number;
  notes: string;
  weightUnit?: 'kg' | 'lbs';
  initialWeight?: number | null;
  muscles: string[];
  isBodyweight?: boolean;
}

export interface IProgram extends Document<string> {
  _id: string;
  userId: string;
  name: string;
  exercises: IProgramExercise[];
  createdAt: string;
  updatedAt: number;
}

const ProgramExerciseSchema = new Schema({
  id: { type: String, required: true },
  exerciseDefinitionId: { type: String },
  trackingMode: { type: String, enum: ['strength', 'timed', 'cardio'], default: 'strength' },
  name: { type: String, required: true },
  // Mixed (not a typed array of subdocuments) so that legacy documents
  // storing a plain number don't fail to cast/hydrate. New writes are the
  // array-of-{type} shape ('working' | 'warmup' | 'dropset'); converters.ts
  // on the client tolerantly reads both.
  defaultSets: { type: Schema.Types.Mixed, required: true },
  restSeconds: { type: Number, required: true },
  notes: { type: String, default: '' },
  weightUnit: { type: String, enum: ['kg', 'lbs'], default: 'kg' },
  initialWeight: { type: Number, default: null },
  muscles: { type: [String], default: [] },
  isBodyweight: { type: Boolean, default: false },
}, { _id: false });

const ProgramSchema = new Schema({
  _id: { type: String, required: true }, // Using client-side UUID
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  exercises: [ProgramExerciseSchema],
  createdAt: { type: String, required: true },
  updatedAt: { type: Number, required: true, index: true },
  deletedAt: { type: Number, default: null },
}, { _id: false });

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

ProgramSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

for (const operation of ['findOneAndUpdate', 'updateOne', 'updateMany', 'replaceOne'] as const) {
  ProgramSchema.pre(operation, function(next) {
    const update = this.getUpdate();
    if (update && typeof update === 'object' && !Array.isArray(update)) {
      applyUpdatedAt(update as Record<string, any>, Date.now());
      this.setUpdate(update);
    }
    next();
  });
}

// Export the model (resetting it to ensure schema update)
if (mongoose.models.Program) {
  delete (mongoose.models as any).Program;
}
export default mongoose.model<IProgram>('Program', ProgramSchema);

// ──────────────────────────────────────────────
// Program Mongoose model
// CANONICAL EXERCISE NORMALIZATION: shared/programs.js
// Keep this schema's exercise subdoc in sync with normalizeExercise there
// (defaultSets is a template array of { type: 'working'|'warmup'|'dropset' }).
// ──────────────────────────────────────────────

import mongoose, { Schema, type InferSchemaType } from "mongoose";

const ProgramExerciseSchema = new Schema(
  {
    id: { type: String, required: true },
    exerciseDefinitionId: { type: String },
    trackingMode: { type: String, enum: ["strength", "timed", "cardio"], default: "strength" },
    name: { type: String, required: true },
    // Mixed so legacy docs storing a plain set count (number) still hydrate.
    // New writes are the array-of-{type} shape; converters.ts on the client
    // tolerantly reads both.
    defaultSets: { type: Schema.Types.Mixed, required: true },
    restSeconds: { type: Number, required: true },
    notes: { type: String, default: "" },
    weightUnit: { type: String, enum: ["kg", "lbs"], default: "kg" },
    initialWeight: { type: Number, default: null },
    muscles: { type: [String], default: [] },
    isBodyweight: { type: Boolean, default: false },
  },
  { _id: false },
);

const ProgramSchema = new Schema(
  {
    _id: { type: String, required: true }, // client-side UUID
    userId: { type: String, required: true },
    name: { type: String, required: true },
    exercises: [ProgramExerciseSchema],
    createdAt: { type: String, required: true },
    updatedAt: { type: Number, required: true, index: true },
    deletedAt: { type: Number, default: null },
  },
  { _id: false },
);

ProgramSchema.index({ userId: 1, updatedAt: 1 });

export type ProgramDoc = InferSchemaType<typeof ProgramSchema>;

export default mongoose.model("Program", ProgramSchema);

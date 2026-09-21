// ──────────────────────────────────────────────
// Workout Mongoose model
// CANONICAL EXERCISE NORMALIZATION: shared/programs.js
// Keep workout exercise subdoc shapes in sync with the normalization
// functions there (trackingMode, set types, etc.).
// ──────────────────────────────────────────────

import mongoose, { Schema, type InferSchemaType } from "mongoose";

const WorkoutSetSchema = new Schema(
  {
    id: { type: String, required: true },
    weight: { type: Number, default: null },
    reps: { type: Number, default: null },
    type: { type: String, enum: ["working", "warmup", "dropset"], default: "working" },
    durationSeconds: { type: Number, default: null },
    distance: { type: Number, default: null },
    completedAt: { type: String },
  },
  { _id: false },
);

const WorkoutExerciseSchema = new Schema(
  {
    id: { type: String, required: true },
    exerciseDefinitionId: { type: String },
    trackingMode: { type: String, enum: ["strength", "timed", "cardio"], default: "strength" },
    name: { type: String, required: true },
    restSeconds: { type: Number, required: true },
    timerStartedAt: { type: String },
    notes: { type: String, default: "" },
    sets: [WorkoutSetSchema],
    weightUnit: { type: String, enum: ["kg", "lbs"], default: "kg" },
    muscles: { type: [String], default: [] },
    isBodyweight: { type: Boolean, default: false },
  },
  { _id: false },
);

const WorkoutSchema = new Schema(
  {
    _id: { type: String, required: true }, // client-side UUID
    userId: { type: String, required: true },
    programId: { type: String },
    startedAt: { type: String, required: true },
    completedAt: { type: String },
    updatedAt: { type: Number, required: true, index: true },
    deletedAt: { type: Number, default: null },
    notes: { type: String, default: "" },
    exercises: [WorkoutExerciseSchema],
  },
  { _id: false },
);

WorkoutSchema.index({ userId: 1, updatedAt: 1 });

export type WorkoutDoc = InferSchemaType<typeof WorkoutSchema>;

export default mongoose.model("Workout", WorkoutSchema);

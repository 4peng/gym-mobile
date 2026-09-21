// ──────────────────────────────────────────────
// Workout Mongoose model
// CANONICAL EXERCISE NORMALIZATION: shared/programs.js
// Keep workout exercise subdoc shapes in sync with the normalization
// functions in shared/programs.js (trackingMode, set types, etc.).
// ──────────────────────────────────────────────

import mongoose, { Schema, Document } from 'mongoose';
import updatedAtPlugin from '../plugins/updatedAtPlugin.js';

export interface IWorkoutSet {
  id: string;
  weight: number | null;
  reps: number | null;
  type?: 'working' | 'warmup' | 'dropset';
  durationSeconds?: number | null;
  distance?: number | null;
  completedAt?: string;
}

export interface IWorkoutExercise {
  id: string;
  exerciseDefinitionId?: string;
  trackingMode?: 'strength' | 'timed' | 'cardio';
  name: string;
  restSeconds: number;
  timerStartedAt?: string;
  notes: string;
  sets: IWorkoutSet[];
  weightUnit?: 'kg' | 'lbs';
  muscles: string[];
  isBodyweight?: boolean;
}

export interface IWorkout extends Document<string> {
  _id: string;
  userId: string;
  programId?: string;
  startedAt: string;
  completedAt?: string;
  updatedAt: number;
  notes: string;
  exercises: IWorkoutExercise[];
}

const WorkoutSetSchema = new Schema({
  id: { type: String, required: true },
  weight: { type: Number, default: null },
  reps: { type: Number, default: null },
  type: { type: String, enum: ['working', 'warmup', 'dropset'], default: 'working' },
  durationSeconds: { type: Number, default: null },
  distance: { type: Number, default: null },
  completedAt: { type: String },
}, { _id: false });

const WorkoutExerciseSchema = new Schema({
  id: { type: String, required: true },
  exerciseDefinitionId: { type: String },
  trackingMode: { type: String, enum: ['strength', 'timed', 'cardio'], default: 'strength' },
  name: { type: String, required: true },
  restSeconds: { type: Number, required: true },
  timerStartedAt: { type: String },
  notes: { type: String, default: '' },
  sets: [WorkoutSetSchema],
  weightUnit: { type: String, enum: ['kg', 'lbs'], default: 'kg' },
  muscles: { type: [String], default: [] },
  isBodyweight: { type: Boolean, default: false },
}, { _id: false });

const WorkoutSchema = new Schema({
  _id: { type: String, required: true }, // Using client-side UUID
  userId: { type: String, required: true, index: true },
  programId: { type: String },
  startedAt: { type: String, required: true },
  completedAt: { type: String },
  updatedAt: { type: Number, required: true, index: true },
  deletedAt: { type: Number, default: null },
  notes: { type: String, default: '' },
  exercises: [WorkoutExerciseSchema],
}, { _id: false });

WorkoutSchema.plugin(updatedAtPlugin);
WorkoutSchema.index({ userId: 1, updatedAt: 1 });

// Export the model (resetting it to ensure schema update)
if (mongoose.models.Workout) {
  delete (mongoose.models as any).Workout;
}
export default mongoose.model<IWorkout>('Workout', WorkoutSchema);

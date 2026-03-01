import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkoutSet {
  id: string;
  weight: number | null;
  reps: number | null;
  completedAt?: string;
}

export interface IWorkoutExercise {
  id: string;
  name: string;
  restSeconds: number;
  timerStartedAt?: string;
  notes: string;
  sets: IWorkoutSet[];
}

export interface IWorkout extends Document<string> {
  _id: string;
  userId: string;
  programId?: string;
  startedAt: string;
  completedAt?: string;
  updatedAt: number;
  exercises: IWorkoutExercise[];
}

const WorkoutSetSchema = new Schema({
  id: { type: String, required: true },
  weight: { type: Number, default: null },
  reps: { type: Number, default: null },
  completedAt: { type: String },
});

const WorkoutExerciseSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  restSeconds: { type: Number, required: true },
  timerStartedAt: { type: String },
  notes: { type: String, default: '' },
  sets: [WorkoutSetSchema],
});

const WorkoutSchema = new Schema({
  _id: { type: String, required: true }, // Using client-side UUID
  userId: { type: String, required: true, index: true },
  programId: { type: String },
  startedAt: { type: String, required: true },
  completedAt: { type: String },
  updatedAt: { type: Number, required: true, index: true },
  deletedAt: { type: Number, default: null },
  exercises: [WorkoutExerciseSchema],
}, { _id: false });

export default mongoose.model<IWorkout>('Workout', WorkoutSchema);

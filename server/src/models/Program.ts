import mongoose, { Schema, Document } from 'mongoose';

export interface IProgramExercise {
  id: string;
  name: string;
  defaultSets: number;
  restSeconds: number;
  notes: string;
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
  name: { type: String, required: true },
  defaultSets: { type: Number, required: true },
  restSeconds: { type: Number, required: true },
  notes: { type: String, default: '' },
});

const ProgramSchema = new Schema({
  _id: { type: String, required: true }, // Using client-side UUID
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  exercises: [ProgramExerciseSchema],
  createdAt: { type: String, required: true },
  updatedAt: { type: Number, required: true, index: true },
  deletedAt: { type: Number, default: null },
}, { _id: false });

export default mongoose.model<IProgram>('Program', ProgramSchema);

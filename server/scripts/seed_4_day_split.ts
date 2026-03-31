import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";
import Program from "../src/models/Program.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGODB_URI = process.env.MONGODB_URI;
const USER_ID = process.env.SEED_USER_ID ?? "default-user";
const SEED_PREFIX = process.env.SEED_PREFIX ?? "seed-4-day-split-v1";
const REPLACE = process.env.SEED_REPLACE === "1";

type SeedExercise = {
  id: string;
  name: string;
  defaultSets: number;
  restSeconds: number;
  notes: string;
  weightUnit: "kg" | "lbs";
  initialWeight: number | null;
  muscles: string[];
};

type SeedProgram = {
  code: string;
  name: string;
  exercises: SeedExercise[];
};

const seedPrograms: SeedProgram[] = [
  {
    code: "day-1-upper-push",
    name: "Your 4-Day Split - Day 1 Upper (Push Focus)",
    exercises: [
      { id: "incline-bench-press", name: "Incline Bench Press", defaultSets: 3, restSeconds: 120, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["chest", "shoulder", "arms"] },
      { id: "flat-bench-press", name: "Flat Bench Press", defaultSets: 3, restSeconds: 120, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["chest", "shoulder", "arms"] },
      { id: "lateral-raise", name: "Lateral Raise", defaultSets: 3, restSeconds: 60, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["shoulder"] },
      { id: "overhead-tricep-extension", name: "Overhead Tricep Extension", defaultSets: 3, restSeconds: 60, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["arms"] },
      { id: "face-pull", name: "Face Pull", defaultSets: 3, restSeconds: 60, notes: "Clean push day. No heavy pulling = better recovery.", weightUnit: "kg", initialWeight: null, muscles: ["shoulder", "back"] },
    ],
  },
  {
    code: "day-2-upper-pull-climbing",
    name: "Your 4-Day Split - Day 2 Upper (Pull + Climbing Focus)",
    exercises: [
      { id: "pull-ups", name: "Pull-ups", defaultSets: 4, restSeconds: 120, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["back", "arms"] },
      { id: "wide-grip-barbell-row", name: "Wide Grip Barbell Row", defaultSets: 3, restSeconds: 120, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["back", "arms"] },
      { id: "close-grip-cable-row", name: "Close Grip Cable Row (lighter)", defaultSets: 3, restSeconds: 75, notes: "This is your bouldering support day.", weightUnit: "kg", initialWeight: null, muscles: ["back", "arms"] },
      { id: "bayesian-curl", name: "Bayesian Curl", defaultSets: 3, restSeconds: 60, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["arms"] },
      { id: "dead-hang", name: "Dead Hang", defaultSets: 3, restSeconds: 45, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["mobility", "back"] },
      { id: "scapular-pull-up", name: "Scapular Pull-up", defaultSets: 3, restSeconds: 60, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["mobility", "back", "shoulder"] },
    ],
  },
  {
    code: "day-3-lower-squat-mobility",
    name: "Your 4-Day Split - Day 3 Lower (Squat + Mobility Focus)",
    exercises: [
      { id: "squat", name: "Squat", defaultSets: 4, restSeconds: 150, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["quads", "glutes", "core"] },
      { id: "romanian-deadlift", name: "Romanian Deadlift", defaultSets: 3, restSeconds: 120, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["hamstrings", "glutes", "back"] },
      { id: "leg-raise", name: "Leg Raise", defaultSets: 3, restSeconds: 60, notes: "Controlled, not exhausting -> keeps CNS fresh.", weightUnit: "kg", initialWeight: null, muscles: ["core"] },
      { id: "90-90-hip-stretch", name: "90/90 Hip Stretch", defaultSets: 2, restSeconds: 45, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["mobility"] },
    ],
  },
  {
    code: "day-4-lower-hinge-conditioning",
    name: "Your 4-Day Split - Day 4 Lower (Hinge + Conditioning)",
    exercises: [
      { id: "deadlift", name: "Deadlift (main lift)", defaultSets: 3, restSeconds: 180, notes: "This is your intensity day.", weightUnit: "kg", initialWeight: null, muscles: ["back", "hamstrings", "glutes"] },
      { id: "farmers-walk", name: "Farmer's Walk", defaultSets: 4, restSeconds: 90, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["arms", "core"] },
      { id: "light-leg-raises", name: "Light leg raises (optional)", defaultSets: 2, restSeconds: 45, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["core"] },
      { id: "optional-mobility", name: "Optional mobility", defaultSets: 2, restSeconds: 45, notes: "", weightUnit: "kg", initialWeight: null, muscles: ["mobility"] },
    ],
  },
];

function buildProgramDocument(template: SeedProgram, index: number, existingCreatedAt?: string) {
  const now = Date.now() + index;
  return {
    _id: `${SEED_PREFIX}-program-${template.code}`,
    userId: USER_ID,
    name: template.name,
    exercises: template.exercises,
    createdAt: existingCreatedAt ?? new Date(now).toISOString(),
    updatedAt: now,
    deletedAt: null,
  };
}

async function seed4DaySplit() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in environment");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);

  try {
    let inserted = 0;
    let revived = 0;
    let replaced = 0;
    let existing = 0;

    for (const [index, template] of seedPrograms.entries()) {
      const existingProgram = await Program.findOne({ userId: USER_ID, name: template.name })
        .sort({ updatedAt: -1 })
        .lean();

      if (existingProgram && !existingProgram.deletedAt && !REPLACE) {
        existing += 1;
        continue;
      }

      if (existingProgram) {
        const payload = buildProgramDocument(template, index, existingProgram.createdAt);
        await Program.updateOne(
          { _id: existingProgram._id },
          {
            $set: {
              name: payload.name,
              exercises: payload.exercises,
              updatedAt: payload.updatedAt,
              deletedAt: null,
            },
            $setOnInsert: {
              userId: payload.userId,
              createdAt: payload.createdAt,
            },
          },
          { upsert: true }
        );

        if (existingProgram.deletedAt) {
          revived += 1;
        } else {
          replaced += 1;
        }
        continue;
      }

      await Program.create(buildProgramDocument(template, index));
      inserted += 1;
    }

    console.log("--- 4-DAY SPLIT PROGRAMS SEEDED ---");
    console.log(`User: ${USER_ID}`);
    console.log(`Prefix: ${SEED_PREFIX}`);
    console.log(`Replace existing active routines: ${REPLACE ? "yes" : "no"}`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Revived soft-deleted: ${revived}`);
    console.log(`Replaced existing active: ${replaced}`);
    console.log(`Already present and left untouched: ${existing}`);
    console.log("Done.");
  } finally {
    await mongoose.disconnect();
  }
}

seed4DaySplit()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
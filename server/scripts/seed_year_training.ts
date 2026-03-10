import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";
import Program from "../src/models/Program.js";
import Workout from "../src/models/Workout.js";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

const MONGODB_URI = process.env.MONGODB_URI;
const USER_ID = process.env.SEED_USER_ID ?? "default-user";
const SEED_PREFIX = process.env.SEED_PREFIX ?? "seed-training-year-v1";
const SEED_DAYS = Math.max(1, Number(process.env.SEED_DAYS ?? "365"));
const FORCE = process.env.SEED_FORCE === "1";
const UPDATED_AT_MODE = process.env.SEED_UPDATED_AT_MODE ?? "now";
if (UPDATED_AT_MODE !== "now" && UPDATED_AT_MODE !== "historical") {
  throw new Error(
    `Invalid SEED_UPDATED_AT_MODE: ${UPDATED_AT_MODE}. Use "now" or "historical".`
  );
}

type ExerciseTemplate = {
  name: string;
  restSeconds: number;
  defaultSets: number;
  repMin: number;
  repMax: number;
  baseWeight: number;
  weeklyIncrease: number;
  muscles: string[];
};

type DayTemplate = {
  code: string;
  name: string;
  weekday: number;
  startHourUtc: number;
  durationMin: [number, number];
  exercises: ExerciseTemplate[];
};

const dayTemplates: DayTemplate[] = [
  {
    code: "push",
    name: "[Seed] Push Day",
    weekday: 1,
    startHourUtc: 18,
    durationMin: [50, 75],
    exercises: [
      { name: "Bench Press", restSeconds: 150, defaultSets: 4, repMin: 5, repMax: 8, baseWeight: 55, weeklyIncrease: 0.35, muscles: ["chest", "arms", "shoulder"] },
      { name: "Incline Dumbbell Press", restSeconds: 120, defaultSets: 3, repMin: 8, repMax: 12, baseWeight: 20, weeklyIncrease: 0.2, muscles: ["chest", "shoulder", "arms"] },
      { name: "Overhead Press", restSeconds: 120, defaultSets: 3, repMin: 6, repMax: 10, baseWeight: 35, weeklyIncrease: 0.25, muscles: ["shoulder", "arms"] },
      { name: "Lateral Raises", restSeconds: 75, defaultSets: 3, repMin: 12, repMax: 18, baseWeight: 8, weeklyIncrease: 0.1, muscles: ["shoulder"] },
      { name: "Triceps Pushdown", restSeconds: 75, defaultSets: 3, repMin: 10, repMax: 15, baseWeight: 18, weeklyIncrease: 0.15, muscles: ["arms"] },
    ],
  },
  {
    code: "pull",
    name: "[Seed] Pull Day",
    weekday: 2,
    startHourUtc: 18,
    durationMin: [50, 75],
    exercises: [
      { name: "Barbell Row", restSeconds: 150, defaultSets: 4, repMin: 6, repMax: 10, baseWeight: 50, weeklyIncrease: 0.35, muscles: ["back", "arms"] },
      { name: "Lat Pulldown", restSeconds: 120, defaultSets: 4, repMin: 8, repMax: 12, baseWeight: 45, weeklyIncrease: 0.25, muscles: ["back", "arms"] },
      { name: "Cable Row", restSeconds: 90, defaultSets: 3, repMin: 10, repMax: 14, baseWeight: 38, weeklyIncrease: 0.2, muscles: ["back"] },
      { name: "Face Pull", restSeconds: 75, defaultSets: 3, repMin: 12, repMax: 18, baseWeight: 20, weeklyIncrease: 0.15, muscles: ["shoulder", "back"] },
      { name: "EZ Bar Curl", restSeconds: 75, defaultSets: 3, repMin: 10, repMax: 15, baseWeight: 20, weeklyIncrease: 0.1, muscles: ["arms"] },
    ],
  },
  {
    code: "legs",
    name: "[Seed] Legs Day",
    weekday: 4,
    startHourUtc: 18,
    durationMin: [55, 85],
    exercises: [
      { name: "Back Squat", restSeconds: 180, defaultSets: 4, repMin: 5, repMax: 8, baseWeight: 70, weeklyIncrease: 0.45, muscles: ["quads", "glutes", "core"] },
      { name: "Romanian Deadlift", restSeconds: 150, defaultSets: 4, repMin: 6, repMax: 10, baseWeight: 65, weeklyIncrease: 0.4, muscles: ["hamstrings", "glutes", "back"] },
      { name: "Leg Press", restSeconds: 120, defaultSets: 3, repMin: 10, repMax: 15, baseWeight: 120, weeklyIncrease: 0.8, muscles: ["quads", "glutes"] },
      { name: "Leg Curl", restSeconds: 90, defaultSets: 3, repMin: 10, repMax: 14, baseWeight: 35, weeklyIncrease: 0.25, muscles: ["hamstrings"] },
      { name: "Standing Calf Raise", restSeconds: 75, defaultSets: 4, repMin: 12, repMax: 20, baseWeight: 40, weeklyIncrease: 0.2, muscles: ["calves"] },
    ],
  },
  {
    code: "upper",
    name: "[Seed] Upper Mix",
    weekday: 6,
    startHourUtc: 10,
    durationMin: [45, 70],
    exercises: [
      { name: "Incline Bench Press", restSeconds: 120, defaultSets: 4, repMin: 6, repMax: 10, baseWeight: 50, weeklyIncrease: 0.3, muscles: ["chest", "shoulder", "arms"] },
      { name: "Seated Row", restSeconds: 120, defaultSets: 4, repMin: 8, repMax: 12, baseWeight: 42, weeklyIncrease: 0.25, muscles: ["back", "arms"] },
      { name: "Machine Shoulder Press", restSeconds: 90, defaultSets: 3, repMin: 8, repMax: 12, baseWeight: 32, weeklyIncrease: 0.2, muscles: ["shoulder", "arms"] },
      { name: "Chest Fly", restSeconds: 75, defaultSets: 3, repMin: 10, repMax: 15, baseWeight: 25, weeklyIncrease: 0.15, muscles: ["chest"] },
      { name: "Hammer Curl", restSeconds: 75, defaultSets: 3, repMin: 10, repMax: 15, baseWeight: 12, weeklyIncrease: 0.1, muscles: ["arms"] },
    ],
  },
];

function parseEndDate(): Date {
  const raw = process.env.SEED_END_DATE;
  if (!raw) return stripTime(new Date());
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid SEED_END_DATE: ${raw}. Use YYYY-MM-DD.`);
  }
  return parsed;
}

function stripTime(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, delta: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

function intInRange(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function progressionMultiplier(weekIndex: number): number {
  const cycleWeek = weekIndex % 8;
  if (cycleWeek === 7) return 0.92;
  return 1;
}

async function seedYearTraining() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in environment");
    process.exit(1);
  }

  const endDate = parseEndDate();
  const startDate = addDays(endDate, -(SEED_DAYS - 1));
  const regex = new RegExp(`^${SEED_PREFIX}-`);

  await mongoose.connect(MONGODB_URI);

  try {
    const existingWorkouts = await Workout.countDocuments({ userId: USER_ID, _id: regex });
    const existingPrograms = await Program.countDocuments({ userId: USER_ID, _id: regex });

    if (!FORCE && (existingWorkouts > 0 || existingPrograms > 0)) {
      console.error(
        `Seed data already exists (${existingPrograms} programs, ${existingWorkouts} workouts). ` +
          "Run remove script first or set SEED_FORCE=1."
      );
      process.exit(1);
    }

    if (FORCE) {
      await Workout.deleteMany({ userId: USER_ID, _id: regex });
      await Program.deleteMany({ userId: USER_ID, _id: regex });
    }

    const now = Date.now();
    let updateTick = 0;
    const nextUpdatedAt = (fallbackEpochMs: number) => {
      if (UPDATED_AT_MODE === "historical") {
        return fallbackEpochMs;
      }
      updateTick += 1;
      return now + updateTick;
    };

    const programDocs = dayTemplates.map((template, index) => ({
      _id: `${SEED_PREFIX}-program-${template.code}`,
      userId: USER_ID,
      name: template.name,
      exercises: template.exercises.map((exercise, exerciseIndex) => ({
        id: `${SEED_PREFIX}-program-${template.code}-ex-${exerciseIndex + 1}`,
        name: exercise.name,
        defaultSets: exercise.defaultSets,
        restSeconds: exercise.restSeconds,
        notes: "Auto-generated seed template",
        weightUnit: "kg",
        muscles: exercise.muscles,
      })),
      createdAt: addDays(startDate, index).toISOString(),
      updatedAt: nextUpdatedAt(now + index),
      deletedAt: null,
    }));

    const workouts: any[] = [];
    for (let date = new Date(startDate); date <= endDate; date = addDays(date, 1)) {
      const template = dayTemplates.find((d) => d.weekday === date.getUTCDay());
      if (!template) continue;

      const weekIndex = Math.floor((date.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const seedInt = Number(dayKey(date).slice(-6));
      const rng = createRng(seedInt + weekIndex * 131 + template.weekday * 977);

      if (rng() < 0.1) continue;

      const startAt = new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        template.startHourUtc,
        intInRange(rng, 0, 30),
        0,
        0
      ));

      const workoutId = `${SEED_PREFIX}-workout-${dayKey(date)}-${template.code}`;
      const durationMin = intInRange(rng, template.durationMin[0], template.durationMin[1]);
      const completedAt = new Date(startAt.getTime() + durationMin * 60 * 1000);

      let exerciseOffsetMin = 0;
      const exercises = template.exercises.map((exercise, exerciseIndex) => {
        const setVariance = rng() < 0.2 ? 1 : 0;
        const setCount = exercise.defaultSets + setVariance;
        const progress = progressionMultiplier(weekIndex);
        const rawWeight = (exercise.baseWeight + weekIndex * exercise.weeklyIncrease) * progress;
        const workWeight = Math.max(5, roundToHalf(rawWeight + (rng() - 0.5) * 2));

        const sets = Array.from({ length: setCount }).map((_, setIndex) => {
          const targetReps = intInRange(rng, exercise.repMin, exercise.repMax);
          const fatiguePenalty = Math.min(2, setIndex);
          const reps = Math.max(exercise.repMin - 1, targetReps - fatiguePenalty);
          const setCompletedAt = new Date(startAt.getTime() + (exerciseOffsetMin + setIndex * 3 + 1) * 60 * 1000);

          return {
            id: `${workoutId}-e${exerciseIndex + 1}-s${setIndex + 1}`,
            weight: workWeight,
            reps,
            completedAt: setCompletedAt.toISOString(),
          };
        });

        exerciseOffsetMin += setCount * 3 + 2;

        return {
          id: `${workoutId}-e${exerciseIndex + 1}`,
          name: exercise.name,
          restSeconds: exercise.restSeconds,
          notes: "",
          sets,
          weightUnit: "kg",
          muscles: exercise.muscles,
        };
      });

      workouts.push({
        _id: workoutId,
        userId: USER_ID,
        programId: `${SEED_PREFIX}-program-${template.code}`,
        startedAt: startAt.toISOString(),
        completedAt: completedAt.toISOString(),
        updatedAt: nextUpdatedAt(completedAt.getTime()),
        deletedAt: null,
        exercises,
      });
    }

    await Program.insertMany(programDocs, { ordered: true });
    await Workout.insertMany(workouts, { ordered: true });

    console.log("--- YEAR TRAINING DATA SEEDED ---");
    console.log(`User: ${USER_ID}`);
    console.log(`Prefix: ${SEED_PREFIX}`);
    console.log(`updatedAt mode: ${UPDATED_AT_MODE}`);
    console.log(`Date range: ${startDate.toISOString().slice(0, 10)} -> ${endDate.toISOString().slice(0, 10)}`);
    console.log(`Programs inserted: ${programDocs.length}`);
    console.log(`Workouts inserted: ${workouts.length}`);
    console.log("Done.");
  } finally {
    await mongoose.disconnect();
  }
}

seedYearTraining()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });

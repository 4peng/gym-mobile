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

async function removeSeedYearTraining() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in environment");
    process.exit(1);
  }

  const regex = new RegExp(`^${SEED_PREFIX}-`);

  await mongoose.connect(MONGODB_URI);

  try {
    const [beforePrograms, beforeWorkouts] = await Promise.all([
      Program.countDocuments({ userId: USER_ID, _id: regex }),
      Workout.countDocuments({ userId: USER_ID, _id: regex }),
    ]);

    const [programResult, workoutResult] = await Promise.all([
      Program.deleteMany({ userId: USER_ID, _id: regex }),
      Workout.deleteMany({ userId: USER_ID, _id: regex }),
    ]);

    console.log("--- SEEDED TRAINING DATA REMOVED ---");
    console.log(`User: ${USER_ID}`);
    console.log(`Prefix: ${SEED_PREFIX}`);
    console.log(`Programs matched: ${beforePrograms}, deleted: ${programResult.deletedCount}`);
    console.log(`Workouts matched: ${beforeWorkouts}, deleted: ${workoutResult.deletedCount}`);
    console.log("Done.");
  } finally {
    await mongoose.disconnect();
  }
}

removeSeedYearTraining()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Remove failed:", error);
    process.exit(1);
  });

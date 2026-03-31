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

const PROGRAM_NAMES = [
  "Your 4-Day Split - Day 1 Upper (Push Focus)",
  "Your 4-Day Split - Day 2 Upper (Pull + Climbing Focus)",
  "Your 4-Day Split - Day 3 Lower (Squat + Mobility Focus)",
  "Your 4-Day Split - Day 4 Lower (Hinge + Conditioning)",
];

async function remove4DaySplit() {
  if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in environment");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);

  try {
    const regex = new RegExp(`^${SEED_PREFIX}-program-`);
    const query = {
      userId: USER_ID,
      $or: [
        { _id: regex },
        { name: { $in: PROGRAM_NAMES } },
      ],
    };

    const beforeCount = await Program.countDocuments(query);
    const result = await Program.deleteMany(query);

    console.log("--- 4-DAY SPLIT PROGRAMS REMOVED ---");
    console.log(`User: ${USER_ID}`);
    console.log(`Prefix: ${SEED_PREFIX}`);
    console.log(`Programs matched: ${beforeCount}`);
    console.log(`Programs deleted: ${result.deletedCount}`);
    console.log("Done.");
  } finally {
    await mongoose.disconnect();
  }
}

remove4DaySplit()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Remove failed:", error);
    process.exit(1);
  });
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import dns from "dns";
import rateLimit from "express-rate-limit";

// Fix for SRV lookup issues in some environments
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import Program from "./models/Program.js";
import Workout from "./models/Workout.js";
import { makeSyncService } from "./services/syncService.js";
import { makeSyncRouter } from "./routes/syncRouter.js";
import { batchProgramSchema, batchWorkoutSchema } from "./validation/schemas.js";

const programRoutes = makeSyncRouter(makeSyncService(Program), batchProgramSchema, "programs");
const workoutRoutes = makeSyncRouter(
  makeSyncService(Workout, { completedAt: -1, startedAt: -1 }),
  batchWorkoutSchema,
  "workouts",
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../../.env") });

const app = express();
const PORT = process.env.PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("CRITICAL: MONGODB_URI is not defined in environment variables!");
}

// Connect to MongoDB at startup (single connection for all environments)
mongoose
  .connect(MONGODB_URI!, { serverSelectionTimeoutMS: 5000 })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err.message));

// 1. Middlewares
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN || (process.env.NODE_ENV === "production" ? false : "*"),
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));

// 2. Health check (reachable even when Mongo is down; reports real connection state)
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    readyState: mongoose.connection.readyState,
  });
});

// 3. Rate limiter for sync endpoints
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/programs", limiter);
app.use("/workouts", limiter);

// 4. Routes
app.use("/programs", programRoutes);
app.use("/workouts", workoutRoutes);

// 5. Default Route
app.get("/", (req, res) => {
  res.send("Welcome to the Gym Tracker API");
});

// Start server (local dev only; Vercel handles this for production)
if (process.env.NODE_ENV !== "production") {
  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;

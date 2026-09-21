import { openDatabaseSync, type SQLiteDatabase } from "expo-sqlite";
import { USER_ID } from "@/constants/user";
import { applySchema, type SqlDriver, type SqlParam } from "./driver";
import { createWorkoutRepo } from "./workoutRepo";

let handle: SQLiteDatabase | null = null;
const conn = (): SQLiteDatabase => {
  if (!handle) {
    handle = openDatabaseSync("gym.db");
    handle.execSync("PRAGMA journal_mode = WAL;");
    applySchema(appDriver);
  }
  return handle;
};

/** expo-sqlite bound to the app database; opened lazily on first use. */
const appDriver: SqlDriver = {
  all: <T>(sql: string, params: SqlParam[] = []) => conn().getAllSync<T>(sql, params),
  first: <T>(sql: string, params: SqlParam[] = []) => conn().getFirstSync<T>(sql, params),
  run: (sql, params = []) => {
    conn().runSync(sql, params);
  },
  exec: (sql) => conn().execSync(sql),
  transaction: (fn) => conn().withTransactionSync(fn),
};

export const workoutRepo = createWorkoutRepo(appDriver, USER_ID);
export type { ExerciseRow } from "./workoutRepo";

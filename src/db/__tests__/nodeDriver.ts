/* eslint-disable @typescript-eslint/no-require-imports -- node:sqlite is only available inside Jest (Node ≥ 22) */
import { applySchema, type SqlDriver, type SqlParam } from "../driver";

interface NodeStatement {
  all(...params: SqlParam[]): unknown[];
  get(...params: SqlParam[]): unknown;
  run(...params: SqlParam[]): unknown;
}
interface NodeDatabase {
  prepare(sql: string): NodeStatement;
  exec(sql: string): void;
}

/** In-memory SQLite backed by Node's built-in `node:sqlite`, with the app schema applied. */
export function createNodeDriver(): SqlDriver {
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (path: string) => NodeDatabase;
  };
  const db = new DatabaseSync(":memory:");
  const driver: SqlDriver = {
    all: <T>(sql: string, params: SqlParam[] = []) => db.prepare(sql).all(...params) as T[],
    first: <T>(sql: string, params: SqlParam[] = []) =>
      (db.prepare(sql).get(...params) as T | undefined) ?? null,
    run: (sql, params = []) => {
      db.prepare(sql).run(...params);
    },
    exec: (sql) => db.exec(sql),
    transaction: (fn) => {
      db.exec("BEGIN");
      try {
        fn();
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
  };
  applySchema(driver);
  return driver;
}

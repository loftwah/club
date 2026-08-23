// Loads every .sql file under migrations/ into a MockD1Database so that
// the tests can run domain services against a real-ish schema.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { MockD1Database } from "./mock-d1.js";

export function loadSchema(db: MockD1Database, migrationsDir?: string): void {
  const dir = migrationsDir ?? resolve(process.cwd(), "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf-8");
    db.loadSchema(sql);
  }
}

export function rawSchemaSql(): string {
  const dir = resolve(process.cwd(), "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf-8"))
    .join("\n\n");
}

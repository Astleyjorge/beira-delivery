import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const DB_PATH = path.join(process.cwd(), "data", "beira-delivery.db");

// Ensure the data/ folder exists before SQLite tries to create the file in it
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// A single shared connection for the whole app.
// SQLite is file-based and fine with this for a learning project / small scale.
export const db = new DatabaseSync(DB_PATH);

// Enforce foreign key constraints (SQLite has them off by default per-connection)
db.exec("PRAGMA foreign_keys = ON;");

import { db } from "./connection";
import fs from "node:fs";
import path from "node:path";

const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf-8");

db.exec(schema);

console.log("✅ Database initialized at data/beira-delivery.db");

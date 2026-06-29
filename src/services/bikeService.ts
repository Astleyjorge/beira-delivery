import { db } from "../db/connection";
import type { Bike, BikeRow, CreateBikeInput, UpdateBikeInput } from "../types/Bike";

function mapRowToBike(row: BikeRow): Bike {
  return {
    id: row.id,
    plate: row.plate,
    status: row.status as Bike["status"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BikeAlreadyExistsError extends Error {}
export class BikeNotFoundError extends Error {}

export function getAllBikes(): Bike[] {
  const rows = db
    .prepare("SELECT * FROM bikes ORDER BY created_at DESC")
    .all() as unknown as BikeRow[];
  return rows.map(mapRowToBike);
}

export function getBikeById(id: number): Bike | null {
  const row = db
    .prepare("SELECT * FROM bikes WHERE id = ?")
    .get(id) as unknown as BikeRow | undefined;
  return row ? mapRowToBike(row) : null;
}

export function createBike(input: CreateBikeInput): Bike {
  const existing = db
    .prepare("SELECT id FROM bikes WHERE plate = ?")
    .get(input.plate) as unknown as { id: number } | undefined;

  if (existing) {
    throw new BikeAlreadyExistsError(`A bike with plate "${input.plate}" already exists`);
  }

  const result = db.prepare("INSERT INTO bikes (plate) VALUES (?)").run(input.plate);

  const bike = getBikeById(Number(result.lastInsertRowid));
  if (!bike) throw new Error("Failed to load bike immediately after creation");
  return bike;
}

export function updateBike(id: number, input: UpdateBikeInput): Bike {
  const bike = getBikeById(id);
  if (!bike) {
    throw new BikeNotFoundError(`Bike ${id} not found`);
  }

  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (input.plate !== undefined) {
    fields.push("plate = ?");
    values.push(input.plate);
  }
  if (input.status !== undefined) {
    fields.push("status = ?");
    values.push(input.status);
  }

  if (fields.length === 0) return bike;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE bikes SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  const updated = getBikeById(id);
  if (!updated) throw new Error("Failed to load bike after update");
  return updated;
}

export type BikeStatus = "active" | "maintenance" | "retired";

export interface Bike {
  id: number;
  plate: string;
  status: BikeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BikeRow {
  id: number;
  plate: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBikeInput {
  plate: string;
}

export interface UpdateBikeInput {
  plate?: string;
  status?: BikeStatus;
}

// Database Repository Layer - Room Repository
// Split dari hotel-service.ts untuk better organization

import type { RoomRecord, RoomType } from "@/lib/hotel-types";

interface SqliteDatabase {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => { lastInsertRowid?: number | bigint; changes?: number };
    get: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
  };
}

let dbInstance: SqliteDatabase | null = null;

export function setDbInstance(db: SqliteDatabase): void {
  dbInstance = db;
}

export function getDb(): SqliteDatabase {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call setDbInstance first.");
  }
  return dbInstance;
}

export interface CreateRoomInput {
  roomNumberName: string;
  type: RoomType;
  capacity: number;
  description?: string;
}

export interface UpdateRoomInput {
  roomNumberName: string;
  type: RoomType;
  capacity: number;
  description?: string;
}

export interface ListRoomsFilter {
  search?: string;
  type?: RoomType;
  includeDeleted?: boolean;
}

export function roomRepository() {
  const db = getDb();

  function nowIso(): string {
    return new Date().toISOString();
  }

  async function create(input: CreateRoomInput): Promise<RoomRecord> {
    const roomNumberName = input.roomNumberName.trim();

    if (!roomNumberName) {
      throw new Error("Nama/nomor ruangan wajib diisi.");
    }

    db.prepare(`
      INSERT INTO rooms (
        room_number_name,
        type,
        capacity,
        description,
        created_at
      ) VALUES (@roomNumberName, @type, @capacity, @description, @createdAt)
    `).run({
      roomNumberName,
      type: input.type,
      capacity: Math.max(0, Math.floor(input.capacity)),
      description: input.description?.trim() || null,
      createdAt: nowIso(),
    });

    const created = db.prepare(
      `SELECT id, room_number_name, type, capacity, description, created_at FROM rooms WHERE room_number_name = ?`
    ).get(roomNumberName) as RoomRecord | undefined;

    if (!created) {
      throw new Error("Gagal membuat data room.");
    }

    return created;
  }

  function findById(id: number): RoomRecord | null {
    const row = db.prepare(
      `SELECT id, room_number_name, type, capacity, description, created_at, deleted_at FROM rooms WHERE id = ?`
    ).get(id) as (RoomRecord & { deleted_at?: string }) | undefined;

    if (!row) return null;
    const { deleted_at, ...room } = row;
    return room as RoomRecord;
  }

  function findByName(name: string): RoomRecord | null {
    const row = db.prepare(
      `SELECT id, room_number_name, type, capacity, description, created_at, deleted_at FROM rooms WHERE room_number_name = ?`
    ).get(name.trim()) as (RoomRecord & { deleted_at?: string }) | undefined;

    if (!row) return null;
    const { deleted_at, ...room } = row;
    return room as RoomRecord;
  }

  async function update(id: number, input: UpdateRoomInput): Promise<RoomRecord> {
    const roomNumberName = input.roomNumberName.trim();

    if (!roomNumberName) {
      throw new Error("Nama/nomor ruangan wajib diisi.");
    }

    const existing = findById(id);
    if (!existing) {
      throw new Error("Room tidak ditemukan.");
    }

    const conflictCheck = db.prepare(
      "SELECT id FROM rooms WHERE room_number_name = ? AND id != ?"
    ).get(roomNumberName, id);

    if (conflictCheck) {
      throw new Error("Room dengan nama yang sama sudah ada.");
    }

    db.prepare(`
      UPDATE rooms
      SET room_number_name = @roomNumberName,
          type = @type,
          capacity = @capacity,
          description = @description,
          updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id,
      roomNumberName,
      type: input.type,
      capacity: Math.max(0, Math.floor(input.capacity)),
      description: input.description?.trim() || null,
      updatedAt: nowIso(),
    });

    const updated = findById(id);
    if (!updated) {
      throw new Error("Gagal memperbarui data room.");
    }

    return updated;
  }

  async function softDelete(id: number): Promise<void> {
    const existing = findById(id);
    if (!existing) {
      throw new Error("Room tidak ditemukan.");
    }

    db.prepare("UPDATE rooms SET deleted_at = ? WHERE id = ?").run(nowIso(), id);
  }

  async function hardDelete(id: number): Promise<void> {
    const existing = findById(id);
    if (!existing) {
      throw new Error("Room tidak ditemukan.");
    }

    const transactionCount = db.prepare(
      "SELECT COUNT(*) as count FROM transactions WHERE room_id = ?"
    ).get(id) as { count: number };

    if (transactionCount.count > 0) {
      throw new Error(`Room tidak bisa dihapus karena masih terhubung dengan ${transactionCount.count} transaction.`);
    }

    db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
  }

  async function restore(id: number): Promise<RoomRecord> {
    const row = db.prepare(
      `SELECT id FROM rooms WHERE id = ? AND deleted_at IS NOT NULL`
    ).get(id);

    if (!row) {
      throw new Error("Room tidak ditemukan atau belum dihapus.");
    }

    db.prepare("UPDATE rooms SET deleted_at = NULL WHERE id = ?").run(id);

    const restored = findById(id);
    if (!restored) {
      throw new Error("Gagal mengembalikan room.");
    }

    return restored;
  }

  function list(filter: ListRoomsFilter = {}): {
    data: RoomRecord[];
    total: number;
  } {
    const { search = "", type, includeDeleted = false } = filter;

    let whereClause = includeDeleted ? "WHERE 1=1" : "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (search.trim()) {
      whereClause += " AND room_number_name LIKE ?";
      params.push(`%${search.trim()}%`);
    }

    if (type) {
      whereClause += " AND type = ?";
      params.push(type);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM rooms ${whereClause}`).get(...params) as { count: number };

    const data = db.prepare(
      `SELECT id, room_number_name, type, capacity, description, created_at FROM rooms ${whereClause} ORDER BY room_number_name ASC`
    ).all(...params) as RoomRecord[];

    return { data, total: countRow.count };
  }

  function getAll(includeDeleted = false): RoomRecord[] {
    const whereClause = includeDeleted ? "" : "WHERE deleted_at IS NULL";
    return db.prepare(
      `SELECT id, room_number_name, type, capacity, description, created_at FROM rooms ${whereClause} ORDER BY room_number_name ASC`
    ).all() as RoomRecord[];
  }

  return {
    create,
    findById,
    findByName,
    update,
    softDelete,
    hardDelete,
    restore,
    list,
    getAll,
  };
}

export type RoomRepository = ReturnType<typeof roomRepository>;
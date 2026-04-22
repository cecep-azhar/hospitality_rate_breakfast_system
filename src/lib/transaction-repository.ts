// Database Repository Layer - Transaction Repository

import type { TransactionRecord, RoomType } from "@/lib/hotel-types";
import { normalizePhoneNumber, toDateOnly } from "@/lib/hotel-service";

interface SqliteDatabase {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => { lastInsertRowid?: number | bigint; changes?: number };
    get: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
  };
}

export function transactionRepository(db: SqliteDatabase) {
  function nowIso(): string {
    return new Date().toISOString();
  }

  function toPositiveNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (parsed < 0) return fallback;
    return Math.floor(parsed);
  }

  async function create(input: {
    guestName: string;
    phoneNumber: string;
    email?: string;
    roomId?: number;
    roomName?: string;
    roomType?: RoomType;
    checkInDate: string;
    checkOutDate: string;
    paxAdult: number;
    paxChild: number;
    sourceBooking?: string;
  }): Promise<TransactionRecord> {
    const guestName = input.guestName.trim();
    const phoneNumber = normalizePhoneNumber(input.phoneNumber);

    if (!guestName) {
      throw new Error("Nama tamu wajib diisi.");
    }

    if (!phoneNumber) {
      throw new Error("Nomor telepon tamu tidak valid.");
    }

    const checkInDate = toDateOnly(input.checkInDate);
    const checkOutDate = toDateOnly(input.checkOutDate);

    if (checkInDate > checkOutDate) {
      throw new Error("Tanggal check-in tidak boleh lebih besar dari check-out.");
    }

    let roomId = input.roomId;
    if (!roomId) {
      const roomName = input.roomName?.trim();
      if (!roomName) {
        throw new Error("Room wajib dipilih atau diisi.");
      }

      // Try to find existing room or create new one
      const existingRoom = db.prepare(
        "SELECT id FROM rooms WHERE room_number_name = ?"
      ).get(roomName.trim()) as { id: number } | undefined;

      if (existingRoom) {
        roomId = existingRoom.id;
      } else {
        // Create new room
        const insertResult = db.prepare(`
          INSERT INTO rooms (room_number_name, type, capacity, description, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          roomName.trim(),
          input.roomType ?? "Kamar",
          0,
          "Auto-generated from transaction import",
          nowIso()
        );
        roomId = Number(insertResult.lastInsertRowid);
      }
    }

    const roomExists = db.prepare("SELECT id FROM rooms WHERE id = ?").get(roomId);
    if (!roomExists) {
      throw new Error("Room yang dipilih tidak ditemukan.");
    }

    const result = db.prepare(`
      INSERT INTO transactions (
        guest_name,
        phone_number,
        email,
        room_id,
        check_in_date,
        check_out_date,
        pax_adult,
        pax_child,
        source_booking,
        created_at
      ) VALUES (
        @guestName,
        @phoneNumber,
        @email,
        @roomId,
        @checkInDate,
        @checkOutDate,
        @paxAdult,
        @paxChild,
        @sourceBooking,
        @createdAt
      )
    `).run({
      guestName,
      phoneNumber,
      email: input.email?.trim() || null,
      roomId,
      checkInDate,
      checkOutDate,
      paxAdult: Math.max(0, toPositiveNumber(input.paxAdult, 1)),
      paxChild: Math.max(0, toPositiveNumber(input.paxChild, 0)),
      sourceBooking: input.sourceBooking?.trim() || null,
      createdAt: nowIso(),
    });

    const created = db.prepare(`
      SELECT
        t.id,
        t.guest_name,
        t.phone_number,
        t.email,
        t.room_id,
        r.room_number_name AS room_name,
        r.type AS room_type,
        t.check_in_date,
        t.check_out_date,
        t.pax_adult,
        t.pax_child,
        t.source_booking,
        t.created_at
      FROM transactions t
      INNER JOIN rooms r ON r.id = t.room_id
      WHERE t.id = ?
    `).get(result.lastInsertRowid) as TransactionRecord | undefined;

    if (!created) {
      throw new Error("Gagal membuat transaction.");
    }

    return created;
  }

  function findById(id: number): TransactionRecord | null {
    const row = db.prepare(`
      SELECT
        t.id,
        t.guest_name,
        t.phone_number,
        t.email,
        t.room_id,
        r.room_number_name AS room_name,
        r.type AS room_type,
        t.check_in_date,
        t.check_out_date,
        t.pax_adult,
        t.pax_child,
        t.source_booking,
        t.created_at,
        t.deleted_at
      FROM transactions t
      INNER JOIN rooms r ON r.id = t.room_id
      WHERE t.id = ?
    `).get(id) as (TransactionRecord & { deleted_at?: string }) | undefined;

    if (!row) return null;
    const { deleted_at, ...tx } = row;
    return tx as TransactionRecord;
  }

  async function update(id: number, input: {
    guestName: string;
    phoneNumber: string;
    email?: string;
    roomId?: number;
    checkInDate: string;
    checkOutDate: string;
    paxAdult: number;
    paxChild: number;
    sourceBooking?: string;
  }): Promise<TransactionRecord> {
    const guestName = input.guestName.trim();
    const phoneNumber = normalizePhoneNumber(input.phoneNumber);

    if (!guestName) {
      throw new Error("Nama tamu wajib diisi.");
    }

    if (!phoneNumber) {
      throw new Error("Nomor telepon tamu tidak valid.");
    }

    const existing = db.prepare("SELECT id, room_id FROM transactions WHERE id = ? AND deleted_at IS NULL").get(id) as { id: number; room_id: number } | undefined;
    if (!existing) {
      throw new Error("Transaction tidak ditemukan.");
    }

    const checkInDate = toDateOnly(input.checkInDate);
    const checkOutDate = toDateOnly(input.checkOutDate);

    if (checkInDate > checkOutDate) {
      throw new Error("Tanggal check-in tidak boleh lebih besar dari check-out.");
    }

    const roomId = input.roomId ?? existing.room_id;

    const roomExists = db.prepare("SELECT id FROM rooms WHERE id = ?").get(roomId);
    if (!roomExists) {
      throw new Error("Room yang dipilih tidak ditemukan.");
    }

    db.prepare(`
      UPDATE transactions
      SET guest_name = @guestName,
          phone_number = @phoneNumber,
          email = @email,
          room_id = @roomId,
          check_in_date = @checkInDate,
          check_out_date = @checkOutDate,
          pax_adult = @paxAdult,
          pax_child = @paxChild,
          source_booking = @sourceBooking,
          updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id,
      guestName,
      phoneNumber,
      email: input.email?.trim() || null,
      roomId,
      checkInDate,
      checkOutDate,
      paxAdult: Math.max(0, toPositiveNumber(input.paxAdult, 1)),
      paxChild: Math.max(0, toPositiveNumber(input.paxChild, 0)),
      sourceBooking: input.sourceBooking?.trim() || null,
      updatedAt: nowIso(),
    });

    const updated = findById(id);
    if (!updated) {
      throw new Error("Gagal memperbarui transaction.");
    }

    return updated;
  }

  async function softDelete(id: number): Promise<void> {
    const existing = findById(id);
    if (!existing) {
      throw new Error("Transaction tidak ditemukan.");
    }

    db.prepare("UPDATE transactions SET deleted_at = ? WHERE id = ?").run(nowIso(), id);
  }

  async function hardDelete(id: number): Promise<void> {
    const existing = findById(id);
    if (!existing) {
      throw new Error("Transaction tidak ditemukan.");
    }

    db.prepare("DELETE FROM transactions WHERE id = ?").run(id);
  }

  async function restore(id: number): Promise<TransactionRecord> {
    const row = db.prepare(
      "SELECT id FROM transactions WHERE id = ? AND deleted_at IS NOT NULL"
    ).get(id);

    if (!row) {
      throw new Error("Transaction tidak ditemukan atau belum dihapus.");
    }

    db.prepare("UPDATE transactions SET deleted_at = NULL WHERE id = ?").run(id);

    const restored = findById(id);
    if (!restored) {
      throw new Error("Gagal mengembalikan transaction.");
    }

    return restored;
  }

  function list(filter: {
    search?: string;
    roomId?: number;
    checkInDate?: string;
    checkOutDate?: string;
    includeDeleted?: boolean;
  } = {}): { data: TransactionRecord[]; total: number } {
    const { search = "", roomId, checkInDate, checkOutDate, includeDeleted = false } = filter;

    let whereClause = includeDeleted ? "WHERE 1=1" : "WHERE t.deleted_at IS NULL";
    const params: unknown[] = [];

    if (search.trim()) {
      whereClause += " AND (t.guest_name LIKE ? OR t.phone_number LIKE ? OR t.email LIKE ?)";
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (roomId) {
      whereClause += " AND t.room_id = ?";
      params.push(roomId);
    }

    if (checkInDate) {
      whereClause += " AND date(t.check_in_date) = date(?)";
      params.push(checkInDate);
    }

    if (checkOutDate) {
      whereClause += " AND date(t.check_out_date) = date(?)";
      params.push(checkOutDate);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM transactions t ${whereClause}`).get(...params) as { count: number };

    const data = db.prepare(`
      SELECT
        t.id,
        t.guest_name,
        t.phone_number,
        t.email,
        t.room_id,
        r.room_number_name AS room_name,
        r.type AS room_type,
        t.check_in_date,
        t.check_out_date,
        t.pax_adult,
        t.pax_child,
        t.source_booking,
        t.created_at
      FROM transactions t
      INNER JOIN rooms r ON r.id = t.room_id
      ${whereClause}
      ORDER BY t.check_in_date DESC, t.id DESC
    `).all(...params) as TransactionRecord[];

    return { data, total: countRow.count };
  }

  function getInHouseGuests(date: string): TransactionRecord[] {
    return db.prepare(`
      SELECT
        t.id,
        t.guest_name,
        t.phone_number,
        t.email,
        t.room_id,
        r.room_number_name AS room_name,
        r.type AS room_type,
        t.check_in_date,
        t.check_out_date,
        t.pax_adult,
        t.pax_child,
        t.source_booking,
        t.created_at
      FROM transactions t
      INNER JOIN rooms r ON r.id = t.room_id
      WHERE date(t.check_in_date) <= date(?)
        AND date(t.check_out_date) >= date(?)
        AND t.deleted_at IS NULL
      ORDER BY t.check_in_date DESC, t.id DESC
    `).all(date, date) as TransactionRecord[];
  }

  return {
    create,
    findById,
    update,
    softDelete,
    hardDelete,
    restore,
    list,
    getInHouseGuests,
  };
}

export type TransactionRepository = ReturnType<typeof transactionRepository>;
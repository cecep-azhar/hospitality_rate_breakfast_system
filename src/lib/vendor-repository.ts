// Database Repository Layer - Vendor Repository

import type { VendorRecord } from "@/lib/hotel-types";
import { normalizePhoneNumber } from "@/lib/hotel-service";

interface SqliteDatabase {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => { lastInsertRowid?: number | bigint; changes?: number };
    get: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
  };
}

export function vendorRepository(db: SqliteDatabase) {
  function nowIso(): string {
    return new Date().toISOString();
  }

  async function create(input: {
    vendorName: string;
    companyName?: string;
    contactPerson?: string;
    phoneNumber?: string;
  }): Promise<VendorRecord> {
    const vendorName = input.vendorName.trim();

    if (!vendorName) {
      throw new Error("Nama vendor wajib diisi.");
    }

    const normalizedPhone = normalizePhoneNumber(input.phoneNumber ?? "");

    const result = db.prepare(`
      INSERT INTO vendors (
        vendor_name,
        company_name,
        contact_person,
        phone_number,
        created_at
      ) VALUES (@vendorName, @companyName, @contactPerson, @phoneNumber, @createdAt)
    `).run({
      vendorName,
      companyName: input.companyName?.trim() || null,
      contactPerson: input.contactPerson?.trim() || null,
      phoneNumber: normalizedPhone || null,
      createdAt: nowIso(),
    });

    const created = db.prepare(
      `SELECT id, vendor_name, company_name, contact_person, phone_number, created_at FROM vendors WHERE id = ?`
    ).get(result.lastInsertRowid) as VendorRecord | undefined;

    if (!created) {
      throw new Error("Gagal membuat data vendor.");
    }

    return created;
  }

  function findById(id: number): VendorRecord | null {
    const row = db.prepare(
      `SELECT id, vendor_name, company_name, contact_person, phone_number, created_at, deleted_at FROM vendors WHERE id = ?`
    ).get(id) as (VendorRecord & { deleted_at?: string }) | undefined;

    if (!row) return null;
    const { deleted_at, ...vendor } = row;
    return vendor as VendorRecord;
  }

  async function update(id: number, input: {
    vendorName: string;
    companyName?: string;
    contactPerson?: string;
    phoneNumber?: string;
  }): Promise<VendorRecord> {
    const vendorName = input.vendorName.trim();

    if (!vendorName) {
      throw new Error("Nama vendor wajib diisi.");
    }

    const existing = findById(id);
    if (!existing) {
      throw new Error("Vendor tidak ditemukan.");
    }

    const normalizedPhone = normalizePhoneNumber(input.phoneNumber ?? "");

    db.prepare(`
      UPDATE vendors
      SET vendor_name = @vendorName,
          company_name = @companyName,
          contact_person = @contactPerson,
          phone_number = @phoneNumber,
          updated_at = @updatedAt
      WHERE id = @id
    `).run({
      id,
      vendorName,
      companyName: input.companyName?.trim() || null,
      contactPerson: input.contactPerson?.trim() || null,
      phoneNumber: normalizedPhone || null,
      updatedAt: nowIso(),
    });

    const updated = findById(id);
    if (!updated) {
      throw new Error("Gagal memperbarui data vendor.");
    }

    return updated;
  }

  async function softDelete(id: number): Promise<void> {
    const existing = findById(id);
    if (!existing) {
      throw new Error("Vendor tidak ditemukan.");
    }

    db.prepare("UPDATE vendors SET deleted_at = ? WHERE id = ?").run(nowIso(), id);
  }

  async function hardDelete(id: number): Promise<void> {
    const existing = findById(id);
    if (!existing) {
      throw new Error("Vendor tidak ditemukan.");
    }

    db.prepare("DELETE FROM vendors WHERE id = ?").run(id);
  }

  async function restore(id: number): Promise<VendorRecord> {
    const row = db.prepare(
      `SELECT id FROM vendors WHERE id = ? AND deleted_at IS NOT NULL`
    ).get(id);

    if (!row) {
      throw new Error("Vendor tidak ditemukan atau belum dihapus.");
    }

    db.prepare("UPDATE vendors SET deleted_at = NULL WHERE id = ?").run(id);

    const restored = findById(id);
    if (!restored) {
      throw new Error("Gagal mengembalikan vendor.");
    }

    return restored;
  }

  function list(filter: {
    search?: string;
    includeDeleted?: boolean;
  } = {}): { data: VendorRecord[]; total: number } {
    const { search = "", includeDeleted = false } = filter;

    let whereClause = includeDeleted ? "WHERE 1=1" : "WHERE deleted_at IS NULL";
    const params: unknown[] = [];

    if (search.trim()) {
      whereClause += " AND (vendor_name LIKE ? OR company_name LIKE ? OR contact_person LIKE ?)";
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const countRow = db.prepare(`SELECT COUNT(*) as count FROM vendors ${whereClause}`).get(...params) as { count: number };

    const data = db.prepare(
      `SELECT id, vendor_name, company_name, contact_person, phone_number, created_at FROM vendors ${whereClause} ORDER BY vendor_name ASC`
    ).all(...params) as VendorRecord[];

    return { data, total: countRow.count };
  }

  function getAll(includeDeleted = false): VendorRecord[] {
    const whereClause = includeDeleted ? "" : "WHERE deleted_at IS NULL";
    return db.prepare(
      `SELECT id, vendor_name, company_name, contact_person, phone_number, created_at FROM vendors ${whereClause} ORDER BY vendor_name ASC`
    ).all() as VendorRecord[];
  }

  return {
    create,
    findById,
    update,
    softDelete,
    hardDelete,
    restore,
    list,
    getAll,
  };
}

export type VendorRepository = ReturnType<typeof vendorRepository>;
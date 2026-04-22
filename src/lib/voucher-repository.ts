// Database Repository Layer - Voucher Repository

import type { VoucherRecord, VoucherPaxType, VoucherStatus } from "@/lib/hotel-types";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode";
import path from "node:path";
import fs from "node:fs";

interface SqliteDatabase {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => { lastInsertRowid?: number | bigint; changes?: number };
    get: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
  };
}

const randomCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);

export function voucherRepository(db: SqliteDatabase) {
  const qrDirectory = path.join(process.cwd(), "public", "generated-qr");

  function nowIso(): string {
    return new Date().toISOString();
  }

  function findById(id: number): (VoucherRecord & { deleted_at?: string }) | null {
    const row = db.prepare(`
      SELECT
        v.id,
        v.transaction_id,
        t.guest_name,
        v.voucher_code,
        v.valid_date,
        v.pax_type,
        v.pax_index,
        v.qr_image_key,
        v.status,
        v.scanned_at,
        v.created_at
      FROM vouchers v
      INNER JOIN transactions t ON t.id = v.transaction_id
      WHERE v.id = ?
    `).get(id) as (VoucherRecord & { deleted_at?: string }) | undefined;

    return row || null;
  }

  function findByCode(code: string): (VoucherRecord & { guest_name: string }) | null {
    const row = db.prepare(`
      SELECT
        v.id,
        v.transaction_id,
        t.guest_name,
        v.voucher_code,
        v.valid_date,
        v.pax_type,
        v.pax_index,
        v.qr_image_key,
        v.status,
        v.scanned_at,
        v.created_at
      FROM vouchers v
      INNER JOIN transactions t ON t.id = v.transaction_id
      WHERE v.voucher_code = ?
    `).get(code.trim()) as (VoucherRecord & { guest_name: string }) | undefined;

    return row || null;
  }

  async function create(input: {
    transactionId: number;
    validDate: string;
    paxType: VoucherPaxType;
    paxIndex: number;
  }): Promise<VoucherRecord> {
    const voucherCode = `GS-${input.validDate.replace(/-/g, "")}-${input.transactionId}-${input.paxType[0]}${input.paxIndex}-${randomCode()}`;

    const fileName = `${input.validDate}-${input.transactionId}-${input.paxType.toLowerCase()}-${input.paxIndex}-${Date.now()}.png`;
    const relativePath = `generated-qr/${fileName}`;
    const absolutePath = path.join(process.cwd(), "public", relativePath);

    // Ensure directory exists
    if (!fs.existsSync(qrDirectory)) {
      fs.mkdirSync(qrDirectory, { recursive: true });
    }

    // Generate QR code
    await QRCode.toFile(absolutePath, voucherCode, {
      width: 300,
      margin: 1,
      color: {
        dark: "#0a4f44",
        light: "#ffffff",
      },
    });

    db.prepare(`
      INSERT INTO vouchers (
        transaction_id,
        voucher_code,
        valid_date,
        pax_type,
        pax_index,
        qr_image_key,
        status,
        created_at
      ) VALUES (
        @transactionId,
        @voucherCode,
        @validDate,
        @paxType,
        @paxIndex,
        @qrImageKey,
        @status,
        @createdAt
      )
    `).run({
      transactionId: input.transactionId,
      voucherCode,
      validDate: input.validDate,
      paxType: input.paxType,
      paxIndex: input.paxIndex,
      qrImageKey: relativePath,
      status: "Generated",
      createdAt: nowIso(),
    });

    const result = db.prepare("SELECT last_insert_rowid() as id").get() as { id: number };
    const created = findById(result.id);

    if (!created) {
      throw new Error("Gagal membuat voucher.");
    }

    return created;
  }

  function updateStatus(id: number, status: VoucherStatus, scannedAt?: string): void {
    const updates: Record<string, unknown> = { status };

    if (scannedAt) {
      updates.scanned_at = scannedAt;
    }

    if (status === "Expired") {
      updates.scanned_at = null;
    }

    const setClauses = Object.keys(updates).map((key) => `${key} = @${key}`).join(", ");

    db.prepare(`UPDATE vouchers SET ${setClauses} WHERE id = @id`).run({
      ...updates,
      id,
    });
  }

  function list(filter: {
    search?: string;
    status?: VoucherStatus;
    validDate?: string;
    transactionId?: number;
    includeExpired?: boolean;
  } = {}): { data: VoucherRecord[]; total: number } {
    const { search = "", status, validDate, transactionId, includeExpired = false } = filter;

    let whereClause = "WHERE 1=1";
    const params: unknown[] = [];

    if (search.trim()) {
      whereClause += " AND (v.voucher_code LIKE ? OR t.guest_name LIKE ?)";
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern);
    }

    if (status) {
      whereClause += " AND v.status = ?";
      params.push(status);
    }

    if (validDate) {
      whereClause += " AND v.valid_date = ?";
      params.push(validDate);
    }

    if (transactionId) {
      whereClause += " AND v.transaction_id = ?";
      params.push(transactionId);
    }

    if (!includeExpired) {
      whereClause += " AND v.status != 'Expired'";
    }

    const countRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM vouchers v
      INNER JOIN transactions t ON t.id = v.transaction_id
      ${whereClause}
    `).get(...params) as { count: number };

    const data = db.prepare(`
      SELECT
        v.id,
        v.transaction_id,
        t.guest_name,
        v.voucher_code,
        v.valid_date,
        v.pax_type,
        v.pax_index,
        v.qr_image_key,
        v.status,
        v.scanned_at,
        v.created_at
      FROM vouchers v
      INNER JOIN transactions t ON t.id = v.transaction_id
      ${whereClause}
      ORDER BY v.valid_date DESC, v.id DESC
    `).all(...params) as VoucherRecord[];

    return { data, total: countRow.count };
  }

  function getForTransaction(transactionId: number, validDate: string): VoucherRecord[] {
    return db.prepare(`
      SELECT
        v.id,
        v.transaction_id,
        t.guest_name,
        v.voucher_code,
        v.valid_date,
        v.pax_type,
        v.pax_index,
        v.qr_image_key,
        v.status,
        v.scanned_at,
        v.created_at
      FROM vouchers v
      INNER JOIN transactions t ON t.id = v.transaction_id
      WHERE v.transaction_id = ? AND v.valid_date = ?
      ORDER BY v.pax_type ASC, v.pax_index ASC
    `).all(transactionId, validDate) as VoucherRecord[];
  }

  function getFailedNotifications(): VoucherRecord[] {
    return db.prepare(`
      SELECT
        v.id,
        v.transaction_id,
        t.guest_name,
        v.voucher_code,
        v.valid_date,
        v.pax_type,
        v.pax_index,
        v.qr_image_key,
        v.status,
        v.scanned_at,
        v.created_at
      FROM vouchers v
      INNER JOIN transactions t ON t.id = v.transaction_id
      WHERE v.status IN ('Generated', 'Sent_WA')
        AND v.valid_date < date('now')
      ORDER BY v.valid_date ASC
    `).all() as VoucherRecord[];
  }

  function bulkUpdateStatus(ids: number[], status: VoucherStatus): number {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");
    const result = db.prepare(`
      UPDATE vouchers
      SET status = ?
      WHERE id IN (${placeholders})
    `).run(status, ...ids);

    return result.changes || 0;
  }

  return {
    findById,
    findByCode,
    create,
    updateStatus,
    list,
    getForTransaction,
    getFailedNotifications,
    bulkUpdateStatus,
  };
}

export type VoucherRepository = ReturnType<typeof voucherRepository>;
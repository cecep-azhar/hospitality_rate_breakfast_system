import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { customAlphabet } from "nanoid";
import QRCode from "qrcode";
import * as XLSX from "xlsx";

import type {
  DashboardSummary,
  GatewaySettings,
  NotificationLogRecord,
  NotificationMessageType,
  RatingRecord,
  RatingScale,
  RatingType,
  RatingTypeSummary,
  RoomRecord,
  RoomType,
  TransactionRecord,
  VendorRecord,
  VoucherPaxType,
  VoucherRecord,
} from "@/lib/hotel-types";

interface SqliteStatement {
  run: (...params: unknown[]) => { lastInsertRowid?: number | bigint; changes?: number };
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
}

interface SqliteDatabase {
  exec: (sql: string) => unknown;
  prepare: (sql: string) => SqliteStatement;
}

type UserRole = "Super Admin" | "Resto Checker" | "Manager";

export interface AuthenticatedAdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

const randomCode = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "hospitality.db");
const qrDirectory = path.join(process.cwd(), "public", "generated-qr");

const globalForHotelDb = globalThis as unknown as {
  hotelDb?: SqliteDatabase;
};

function nowIso(): string {
  return new Date().toISOString();
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hashed = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hashed}`;
}

function verifyPassword(password: string, storedPassword: string): boolean {
  const [salt, storedHash] = storedPassword.split(":");

  if (!salt || !storedHash) {
    return password === storedPassword;
  }

  const generatedHash = scryptSync(password, salt, 64).toString("hex");
  const storedBuffer = Buffer.from(storedHash, "hex");
  const generatedBuffer = Buffer.from(generatedHash, "hex");

  if (storedBuffer.length !== generatedBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, generatedBuffer);
}

export function toDateOnly(input: Date | string = new Date()): string {
  if (input instanceof Date) {
    return input.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Format tanggal tidak valid. Gunakan YYYY-MM-DD.");
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizePhoneNumber(input: string): string {
  const digits = input.replace(/\D+/g, "");

  if (!digits) {
    return "";
  }

  if (digits.startsWith("62")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }

  if (digits.startsWith("8")) {
    return `62${digits}`;
  }

  return digits;
}

function parseDateInput(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toDateOnly(value);
  }

  if (typeof value === "number") {
    const excelDate = XLSX.SSF.parse_date_code(value);
    if (excelDate) {
      const month = `${excelDate.m}`.padStart(2, "0");
      const day = `${excelDate.d}`.padStart(2, "0");
      return `${excelDate.y}-${month}-${day}`;
    }
  }

  if (typeof value === "string") {
    const clean = value.trim();
    if (!clean) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }

    const dmy = clean.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    const parsed = new Date(clean.replace(/\./g, "-"));
    if (!Number.isNaN(parsed.getTime())) {
      return toDateOnly(parsed);
    }
  }

  return null;
}

function toPositiveNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function pickText(
  row: Record<string, unknown>,
  candidates: string[],
): string {
  for (const key of candidates) {
    if (key in row) {
      const value = row[key];
      if (value !== null && value !== undefined && `${value}`.trim()) {
        return `${value}`.trim();
      }
    }
  }

  return "";
}

function createDatabase(): SqliteDatabase {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.mkdirSync(qrDirectory, { recursive: true });

  const db = new DatabaseSync(databasePath) as unknown as SqliteDatabase;
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Super Admin', 'Resto Checker', 'Manager')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number_name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('Kamar', 'Meeting Room')),
      capacity INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_name TEXT NOT NULL,
      company_name TEXT,
      contact_person TEXT,
      phone_number TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      email TEXT,
      room_id INTEGER NOT NULL,
      check_in_date TEXT NOT NULL,
      check_out_date TEXT NOT NULL,
      pax_adult INTEGER NOT NULL DEFAULT 1,
      pax_child INTEGER NOT NULL DEFAULT 0,
      source_booking TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      voucher_code TEXT NOT NULL UNIQUE,
      valid_date TEXT NOT NULL,
      pax_type TEXT NOT NULL CHECK(pax_type IN ('Adult', 'Child')),
      pax_index INTEGER NOT NULL,
      qr_image_key TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Generated', 'Sent_WA', 'Scanned', 'Expired')) DEFAULT 'Generated',
      scanned_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      UNIQUE(transaction_id, valid_date, pax_type, pax_index)
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rating_type TEXT NOT NULL CHECK(rating_type IN ('Room', 'Meeting', 'Vendor')),
      reference_type TEXT NOT NULL CHECK(reference_type IN ('Transaction', 'Vendor')),
      reference_id INTEGER NOT NULL,
      quality_of_service TEXT NOT NULL CHECK(quality_of_service IN ('Poor', 'Good', 'Excellent')),
      facilities TEXT NOT NULL CHECK(facilities IN ('Poor', 'Good', 'Excellent')),
      food_quality TEXT NOT NULL CHECK(food_quality IN ('Poor', 'Good', 'Excellent')),
      cleanliness TEXT NOT NULL CHECK(cleanliness IN ('Poor', 'Good', 'Excellent')),
      source_awareness TEXT NOT NULL,
      general_rating INTEGER NOT NULL CHECK(general_rating BETWEEN 1 AND 5),
      comment TEXT,
      submitter_phone TEXT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_phone TEXT NOT NULL,
      message_type TEXT NOT NULL CHECK(message_type IN ('Voucher_Delivery', 'Rating_ThankYou', 'Manager_Alert')),
      payload TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Pending', 'Success', 'Failed')),
      sent_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gateway_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      wa_endpoint_voucher TEXT NOT NULL DEFAULT '',
      wa_token_voucher TEXT NOT NULL DEFAULT '',
      wa_endpoint_rating TEXT NOT NULL DEFAULT '',
      wa_token_rating TEXT NOT NULL DEFAULT '',
      manager_phone_numbers TEXT NOT NULL DEFAULT '[]',
      video_ads_url TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_checkout_date ON transactions(check_out_date);
    CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notification_logs(sent_at);
    CREATE INDEX IF NOT EXISTS idx_vouchers_valid_date ON vouchers(valid_date);
    CREATE INDEX IF NOT EXISTS idx_ratings_submitted_at ON ratings(submitted_at);
  `);

  db.prepare(
    `
      INSERT INTO gateway_settings (
        id,
        wa_endpoint_voucher,
        wa_token_voucher,
        wa_endpoint_rating,
        wa_token_rating,
        manager_phone_numbers,
        video_ads_url
      ) VALUES (1, '', '', '', '', '[]', '')
      ON CONFLICT(id) DO NOTHING
    `,
  ).run();

  return db;
}

const db = globalForHotelDb.hotelDb ?? createDatabase();
if (!globalForHotelDb.hotelDb) {
  globalForHotelDb.hotelDb = db;
}

function parseManagerPhones(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalizePhoneNumber(String(item ?? "")))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function ensureDefaultAdminUser() {
  const defaultName = process.env.DEFAULT_ADMIN_NAME?.trim() || "Grand Sunshine Admin";
  const defaultEmail =
    process.env.DEFAULT_ADMIN_EMAIL?.trim().toLowerCase() || "admin@grandsunshine.local";
  const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD?.trim() || "Admin123!";

  db.prepare(
    `
      INSERT INTO users (
        name,
        email,
        password,
        role,
        created_at
      ) VALUES (?, ?, ?, 'Super Admin', ?)
      ON CONFLICT(email) DO NOTHING
    `,
  ).run(defaultName, defaultEmail, hashPassword(defaultPassword), nowIso());
}

export function authenticateAdminUser(input: {
  email: string;
  password: string;
}): AuthenticatedAdminUser | null {
  ensureDefaultAdminUser();

  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return null;
  }

  const user = db
    .prepare(
      `
        SELECT
          id,
          name,
          email,
          password,
          role
        FROM users
        WHERE lower(email) = lower(?)
        LIMIT 1
      `,
    )
    .get(email) as
    | {
        id: number;
        name: string;
        email: string;
        password: string;
        role: UserRole;
      }
    | undefined;

  if (!user) {
    return null;
  }

  if (!verifyPassword(password, user.password)) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export function getGatewaySettings(): GatewaySettings {
  const row = db
    .prepare(
      `
        SELECT
          wa_endpoint_voucher,
          wa_token_voucher,
          wa_endpoint_rating,
          wa_token_rating,
          manager_phone_numbers,
          video_ads_url
        FROM gateway_settings
        WHERE id = 1
      `,
    )
    .get() as
    | {
        wa_endpoint_voucher: string;
        wa_token_voucher: string;
        wa_endpoint_rating: string;
        wa_token_rating: string;
        manager_phone_numbers: string;
        video_ads_url: string;
      }
    | undefined;

  if (!row) {
    return {
      waEndpointVoucher: "",
      waTokenVoucher: "",
      waEndpointRating: "",
      waTokenRating: "",
      managerPhoneNumbers: [],
      videoAdsUrl: "",
    };
  }

  return {
    waEndpointVoucher: row.wa_endpoint_voucher,
    waTokenVoucher: row.wa_token_voucher,
    waEndpointRating: row.wa_endpoint_rating,
    waTokenRating: row.wa_token_rating,
    managerPhoneNumbers: parseManagerPhones(row.manager_phone_numbers),
    videoAdsUrl: row.video_ads_url,
  };
}

export function saveGatewaySettings(input: GatewaySettings): GatewaySettings {
  const managerPhones = input.managerPhoneNumbers
    .map((phone) => normalizePhoneNumber(phone))
    .filter(Boolean);

  db.prepare(
    `
      UPDATE gateway_settings
      SET
        wa_endpoint_voucher = @waEndpointVoucher,
        wa_token_voucher = @waTokenVoucher,
        wa_endpoint_rating = @waEndpointRating,
        wa_token_rating = @waTokenRating,
        manager_phone_numbers = @managerPhoneNumbers,
        video_ads_url = @videoAdsUrl
      WHERE id = 1
    `,
  ).run({
    waEndpointVoucher: input.waEndpointVoucher.trim(),
    waTokenVoucher: input.waTokenVoucher.trim(),
    waEndpointRating: input.waEndpointRating.trim(),
    waTokenRating: input.waTokenRating.trim(),
    managerPhoneNumbers: JSON.stringify([...new Set(managerPhones)]),
    videoAdsUrl: input.videoAdsUrl.trim(),
  });

  return getGatewaySettings();
}

function insertNotificationLog(input: {
  recipientPhone: string;
  messageType: NotificationMessageType;
  payload: unknown;
  status: "Pending" | "Success" | "Failed";
}) {
  db.prepare(
    `
      INSERT INTO notification_logs (
        recipient_phone,
        message_type,
        payload,
        status,
        sent_at
      ) VALUES (@recipientPhone, @messageType, @payload, @status, @sentAt)
    `,
  ).run({
    recipientPhone: input.recipientPhone,
    messageType: input.messageType,
    payload: JSON.stringify(input.payload ?? {}),
    status: input.status,
    sentAt: nowIso(),
  });
}

async function sendWhatsAppMessage(input: {
  recipientPhone: string;
  messageType: NotificationMessageType;
  payload: Record<string, unknown>;
  channel: "voucher" | "rating";
}): Promise<{ ok: boolean; mode: "gateway" | "mock"; detail: string }> {
  const settings = getGatewaySettings();
  const phone = normalizePhoneNumber(input.recipientPhone);

  if (!phone) {
    return { ok: false, mode: "mock", detail: "Nomor WA penerima kosong." };
  }

  const endpoint =
    input.channel === "voucher"
      ? settings.waEndpointVoucher
      : settings.waEndpointRating;
  const token =
    input.channel === "voucher"
      ? settings.waTokenVoucher
      : settings.waTokenRating;

  if (!endpoint) {
    insertNotificationLog({
      recipientPhone: phone,
      messageType: input.messageType,
      status: "Success",
      payload: {
        mode: "mock-no-endpoint",
        ...input.payload,
      },
    });

    return {
      ok: true,
      mode: "mock",
      detail: "WA endpoint belum diisi, log tersimpan sebagai simulasi sukses.",
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        phone,
        ...input.payload,
      }),
      cache: "no-store",
    });

    const responseText = await response.text();

    if (!response.ok) {
      insertNotificationLog({
        recipientPhone: phone,
        messageType: input.messageType,
        status: "Failed",
        payload: {
          request: input.payload,
          error: responseText,
          statusCode: response.status,
        },
      });

      return {
        ok: false,
        mode: "gateway",
        detail: `Gateway merespons error ${response.status}.`,
      };
    }

    insertNotificationLog({
      recipientPhone: phone,
      messageType: input.messageType,
      status: "Success",
      payload: {
        request: input.payload,
        response: responseText,
      },
    });

    return {
      ok: true,
      mode: "gateway",
      detail: "Pesan WA berhasil dikirim.",
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";

    insertNotificationLog({
      recipientPhone: phone,
      messageType: input.messageType,
      status: "Failed",
      payload: {
        request: input.payload,
        error: detail,
      },
    });

    return {
      ok: false,
      mode: "gateway",
      detail,
    };
  }
}

export function listRooms(limit = 200): RoomRecord[] {
  return db
    .prepare(
      `
        SELECT
          id,
          room_number_name,
          type,
          capacity,
          description,
          created_at
        FROM rooms
        ORDER BY room_number_name ASC
        LIMIT ?
      `,
    )
    .all(limit) as RoomRecord[];
}

export function createRoom(input: {
  roomNumberName: string;
  type: RoomType;
  capacity: number;
  description?: string;
}): RoomRecord {
  const roomNumberName = input.roomNumberName.trim();

  if (!roomNumberName) {
    throw new Error("Nama/nomor ruangan wajib diisi.");
  }

  db.prepare(
    `
      INSERT INTO rooms (
        room_number_name,
        type,
        capacity,
        description,
        created_at
      ) VALUES (@roomNumberName, @type, @capacity, @description, @createdAt)
    `,
  ).run({
    roomNumberName,
    type: input.type,
    capacity: toPositiveNumber(input.capacity, 0),
    description: input.description?.trim() || null,
    createdAt: nowIso(),
  });

  const created = db
    .prepare(
      `
        SELECT
          id,
          room_number_name,
          type,
          capacity,
          description,
          created_at
        FROM rooms
        WHERE room_number_name = ?
      `,
    )
    .get(roomNumberName) as RoomRecord | undefined;

  if (!created) {
    throw new Error("Gagal membuat data room.");
  }

  return created;
}

function ensureRoomByName(roomName: string, type: RoomType = "Kamar"): RoomRecord {
  const existing = db
    .prepare(
      `
        SELECT
          id,
          room_number_name,
          type,
          capacity,
          description,
          created_at
        FROM rooms
        WHERE room_number_name = ?
      `,
    )
    .get(roomName.trim()) as RoomRecord | undefined;

  if (existing) {
    return existing;
  }

  return createRoom({
    roomNumberName: roomName.trim(),
    type,
    capacity: 0,
    description: "Auto-generated from transaction import",
  });
}

export function listVendors(limit = 200): VendorRecord[] {
  return db
    .prepare(
      `
        SELECT
          id,
          vendor_name,
          company_name,
          contact_person,
          phone_number,
          created_at
        FROM vendors
        ORDER BY vendor_name ASC
        LIMIT ?
      `,
    )
    .all(limit) as VendorRecord[];
}

export function createVendor(input: {
  vendorName: string;
  companyName?: string;
  contactPerson?: string;
  phoneNumber?: string;
}): VendorRecord {
  const vendorName = input.vendorName.trim();
  if (!vendorName) {
    throw new Error("Nama vendor wajib diisi.");
  }

  const normalizedPhone = normalizePhoneNumber(input.phoneNumber ?? "");

  const result = db
    .prepare(
      `
        INSERT INTO vendors (
          vendor_name,
          company_name,
          contact_person,
          phone_number,
          created_at
        ) VALUES (@vendorName, @companyName, @contactPerson, @phoneNumber, @createdAt)
      `,
    )
    .run({
      vendorName,
      companyName: input.companyName?.trim() || null,
      contactPerson: input.contactPerson?.trim() || null,
      phoneNumber: normalizedPhone || null,
      createdAt: nowIso(),
    });

  const created = db
    .prepare(
      `
        SELECT
          id,
          vendor_name,
          company_name,
          contact_person,
          phone_number,
          created_at
        FROM vendors
        WHERE id = ?
      `,
    )
    .get(result.lastInsertRowid) as VendorRecord | undefined;

  if (!created) {
    throw new Error("Gagal membuat data vendor.");
  }

  return created;
}

export function listTransactions(limit = 120): TransactionRecord[] {
  return db
    .prepare(
      `
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
        ORDER BY t.check_in_date DESC, t.id DESC
        LIMIT ?
      `,
    )
    .all(limit) as TransactionRecord[];
}

export function createTransaction(input: {
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
}): TransactionRecord {
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

    roomId = ensureRoomByName(roomName, input.roomType ?? "Kamar").id;
  }

  const roomExists = db
    .prepare("SELECT id FROM rooms WHERE id = ?")
    .get(roomId) as { id: number } | undefined;

  if (!roomExists) {
    throw new Error("Room yang dipilih tidak ditemukan.");
  }

  const result = db
    .prepare(
      `
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
      `,
    )
    .run({
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

  const created = db
    .prepare(
      `
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
      `,
    )
    .get(result.lastInsertRowid) as TransactionRecord | undefined;

  if (!created) {
    throw new Error("Gagal membuat transaction.");
  }

  return created;
}

export function importTransactionsFromExcel(fileBuffer: Buffer): {
  inserted: number;
  skipped: number;
  errors: string[];
} {
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: true,
  });

  const [sheetName] = workbook.SheetNames;
  if (!sheetName) {
    throw new Error("File Excel tidak memiliki sheet.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const line = index + 2;

    const guestName = pickText(row, ["Guest_Name", "Guest Name", "guest_name", "Nama Tamu"]);
    const phoneNumber = pickText(row, ["Phone_Number", "Phone Number", "phone_number", "No HP"]);
    const email = pickText(row, ["Email", "email"]);
    const roomName = pickText(row, ["Room", "Room_Number", "Room Name", "Room_Number / Name", "Kamar"]);
    const sourceBooking = pickText(row, ["Source_Booking", "Source Booking", "source_booking", "Source"]);

    const checkInRaw =
      row.Check_In_Date ?? row["Check In Date"] ?? row.check_in_date ?? row["Check In"];
    const checkOutRaw =
      row.Check_Out_Date ?? row["Check Out Date"] ?? row.check_out_date ?? row["Check Out"];

    const checkInDate = parseDateInput(checkInRaw);
    const checkOutDate = parseDateInput(checkOutRaw);

    const paxAdult = toPositiveNumber(
      row.Pax_Adult ?? row["Pax Adult"] ?? row.pax_adult,
      1,
    );
    const paxChild = toPositiveNumber(
      row.Pax_Child ?? row["Pax Child"] ?? row.pax_child,
      0,
    );

    if (!guestName || !phoneNumber || !roomName || !checkInDate || !checkOutDate) {
      skipped += 1;
      errors.push(
        `Baris ${line} dilewati: field wajib (Guest, Phone, Room, CheckIn, CheckOut) belum lengkap.`,
      );
      return;
    }

    try {
      const inferredType: RoomType = /meeting|ballroom|hall|ruang/i.test(roomName)
        ? "Meeting Room"
        : "Kamar";

      createTransaction({
        guestName,
        phoneNumber,
        email,
        roomName,
        roomType: inferredType,
        checkInDate,
        checkOutDate,
        paxAdult,
        paxChild,
        sourceBooking,
      });
      inserted += 1;
    } catch (error) {
      skipped += 1;
      const reason = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Baris ${line} gagal: ${reason}`);
    }
  });

  return {
    inserted,
    skipped,
    errors: errors.slice(0, 20),
  };
}

function makeVoucherCode(
  validDate: string,
  transactionId: number,
  paxType: VoucherPaxType,
  paxIndex: number,
): string {
  return `GS-${validDate.replace(/-/g, "")}-${transactionId}-${paxType[0]}${paxIndex}-${randomCode()}`;
}

export async function generateVouchersForDate(validDateInput?: string): Promise<{
  validDate: string;
  transactionCount: number;
  generatedCount: number;
}> {
  const validDate = toDateOnly(validDateInput ?? new Date());

  const inHouseTransactions = db
    .prepare(
      `
        SELECT
          t.id,
          t.guest_name,
          t.pax_adult,
          t.pax_child
        FROM transactions t
        WHERE date(t.check_in_date) <= date(?)
          AND date(t.check_out_date) >= date(?)
      `,
    )
    .all(validDate, validDate) as Array<{
    id: number;
    guest_name: string;
    pax_adult: number;
    pax_child: number;
  }>;

  const existingStatement = db.prepare(
    `
      SELECT pax_index
      FROM vouchers
      WHERE transaction_id = ? AND valid_date = ? AND pax_type = ?
    `,
  );

  const insertStatement = db.prepare(
    `
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
    `,
  );

  let generatedCount = 0;

  for (const transaction of inHouseTransactions) {
    const paxGroups: Array<{ paxType: VoucherPaxType; count: number }> = [
      { paxType: "Adult", count: Math.max(0, transaction.pax_adult) },
      { paxType: "Child", count: Math.max(0, transaction.pax_child) },
    ];

    for (const group of paxGroups) {
      if (group.count <= 0) {
        continue;
      }

      const existingRows = existingStatement.all(
        transaction.id,
        validDate,
        group.paxType,
      ) as Array<{ pax_index: number }>;
      const existingIndexes = new Set(existingRows.map((row) => row.pax_index));

      for (let index = 1; index <= group.count; index += 1) {
        if (existingIndexes.has(index)) {
          continue;
        }

        const voucherCode = makeVoucherCode(validDate, transaction.id, group.paxType, index);
        const fileName = `${validDate}-${transaction.id}-${group.paxType.toLowerCase()}-${index}-${Date.now()}.png`;
        const relativePath = `generated-qr/${fileName}`;
        const absolutePath = path.join(process.cwd(), "public", relativePath);

        await QRCode.toFile(absolutePath, voucherCode, {
          width: 300,
          margin: 1,
          color: {
            dark: "#0a4f44",
            light: "#ffffff",
          },
        });

        insertStatement.run({
          transactionId: transaction.id,
          voucherCode,
          validDate,
          paxType: group.paxType,
          paxIndex: index,
          qrImageKey: relativePath,
          status: "Generated",
          createdAt: nowIso(),
        });

        generatedCount += 1;
      }
    }
  }

  return {
    validDate,
    transactionCount: inHouseTransactions.length,
    generatedCount,
  };
}

export function listVouchers(limit = 200): VoucherRecord[] {
  return db
    .prepare(
      `
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
        ORDER BY v.valid_date DESC, v.id DESC
        LIMIT ?
      `,
    )
    .all(limit) as VoucherRecord[];
}

export async function sendVoucherManual(input: {
  transactionId: number;
  validDate?: string;
}): Promise<{ ok: boolean; message: string; sentCount: number; validDate: string }> {
  const transaction = db
    .prepare(
      `
        SELECT
          id,
          guest_name,
          phone_number
        FROM transactions
        WHERE id = ?
      `,
    )
    .get(input.transactionId) as
    | {
        id: number;
        guest_name: string;
        phone_number: string;
      }
    | undefined;

  if (!transaction) {
    throw new Error("Transaction tidak ditemukan.");
  }

  let validDate = input.validDate ? toDateOnly(input.validDate) : "";

  if (!validDate) {
    const latest = db
      .prepare(
        `
          SELECT valid_date
          FROM vouchers
          WHERE transaction_id = ?
          ORDER BY valid_date DESC
          LIMIT 1
        `,
      )
      .get(input.transactionId) as { valid_date: string } | undefined;

    if (!latest) {
      throw new Error("Belum ada voucher untuk transaction ini.");
    }

    validDate = latest.valid_date;
  }

  const vouchers = db
    .prepare(
      `
        SELECT
          id,
          voucher_code,
          pax_type,
          pax_index,
          qr_image_key
        FROM vouchers
        WHERE transaction_id = ?
          AND valid_date = ?
          AND status IN ('Generated', 'Sent_WA')
        ORDER BY pax_type ASC, pax_index ASC
      `,
    )
    .all(input.transactionId, validDate) as Array<{
    id: number;
    voucher_code: string;
    pax_type: VoucherPaxType;
    pax_index: number;
    qr_image_key: string;
  }>;

  if (!vouchers.length) {
    throw new Error("Tidak ada voucher Generated/Sent_WA untuk tanggal tersebut.");
  }

  const lines = vouchers.map(
    (voucher) => `${voucher.pax_type} #${voucher.pax_index}: ${voucher.voucher_code}`,
  );

  const message = [
    `Halo ${transaction.guest_name},`,
    `Berikut voucher makan pagi untuk ${validDate}.`,
    ...lines,
    "Silakan tunjukkan QR/code saat sarapan.",
  ].join("\n");

  const waResult = await sendWhatsAppMessage({
    recipientPhone: transaction.phone_number,
    messageType: "Voucher_Delivery",
    channel: "voucher",
    payload: {
      message,
      validDate,
      transactionId: input.transactionId,
      voucherCodes: vouchers.map((voucher) => voucher.voucher_code),
    },
  });

  if (waResult.ok) {
    const ids = vouchers.map((voucher) => voucher.id);
    const placeholders = ids.map(() => "?").join(",");
    db.prepare(
      `
        UPDATE vouchers
        SET status = 'Sent_WA'
        WHERE id IN (${placeholders})
      `,
    ).run(...ids);
  }

  return {
    ok: waResult.ok,
    message: waResult.detail,
    sentCount: vouchers.length,
    validDate,
  };
}

export function scanVoucherByCode(voucherCode: string): {
  ok: boolean;
  message: string;
  guestName?: string;
  paxType?: VoucherPaxType;
  validDate?: string;
} {
  const code = voucherCode.trim();
  if (!code) {
    return {
      ok: false,
      message: "Kode voucher wajib diisi.",
    };
  }

  const row = db
    .prepare(
      `
        SELECT
          v.id,
          v.status,
          v.valid_date,
          v.pax_type,
          v.scanned_at,
          t.guest_name
        FROM vouchers v
        INNER JOIN transactions t ON t.id = v.transaction_id
        WHERE v.voucher_code = ?
      `,
    )
    .get(code) as
    | {
        id: number;
        status: string;
        valid_date: string;
        pax_type: VoucherPaxType;
        scanned_at: string | null;
        guest_name: string;
      }
    | undefined;

  if (!row) {
    return {
      ok: false,
      message: "Voucher tidak ditemukan.",
    };
  }

  if (row.status === "Scanned") {
    return {
      ok: false,
      message: "Voucher sudah pernah digunakan.",
      guestName: row.guest_name,
      paxType: row.pax_type,
      validDate: row.valid_date,
    };
  }

  const today = toDateOnly();
  if (row.valid_date < today) {
    db.prepare(
      `
        UPDATE vouchers
        SET status = 'Expired'
        WHERE id = ?
      `,
    ).run(row.id);

    return {
      ok: false,
      message: "Voucher kedaluwarsa.",
      guestName: row.guest_name,
      paxType: row.pax_type,
      validDate: row.valid_date,
    };
  }

  db.prepare(
    `
      UPDATE vouchers
      SET status = 'Scanned', scanned_at = ?
      WHERE id = ?
    `,
  ).run(nowIso(), row.id);

  return {
    ok: true,
    message: "Voucher valid dan berhasil discan.",
    guestName: row.guest_name,
    paxType: row.pax_type,
    validDate: row.valid_date,
  };
}

export function listRatings(limit = 120): RatingRecord[] {
  return db
    .prepare(
      `
        SELECT
          r.id,
          r.rating_type,
          r.reference_type,
          r.reference_id,
          r.quality_of_service,
          r.facilities,
          r.food_quality,
          r.cleanliness,
          r.source_awareness,
          r.general_rating,
          r.comment,
          r.submitted_at,
          r.submitter_phone,
          CASE
            WHEN r.reference_type = 'Transaction' THEN COALESCE(t.guest_name, 'Guest tidak ditemukan')
            ELSE COALESCE(v.vendor_name, 'Vendor tidak ditemukan')
          END AS reference_label
        FROM ratings r
        LEFT JOIN transactions t
          ON r.reference_type = 'Transaction' AND r.reference_id = t.id
        LEFT JOIN vendors v
          ON r.reference_type = 'Vendor' AND r.reference_id = v.id
        ORDER BY r.submitted_at DESC, r.id DESC
        LIMIT ?
      `,
    )
    .all(limit) as RatingRecord[];
}

export async function submitRating(input: {
  ratingType: RatingType;
  referenceType: "Transaction" | "Vendor";
  referenceId: number;
  qualityOfService: RatingScale;
  facilities: RatingScale;
  foodQuality: RatingScale;
  cleanliness: RatingScale;
  sourceAwareness: string;
  generalRating: number;
  comment?: string;
}): Promise<{ id: number; managerCount: number; submitterPhone?: string }> {
  if (input.referenceType === "Transaction") {
    const transaction = db
      .prepare("SELECT id FROM transactions WHERE id = ?")
      .get(input.referenceId) as { id: number } | undefined;
    if (!transaction) {
      throw new Error("Referensi transaction tidak ditemukan.");
    }
  } else {
    const vendor = db
      .prepare("SELECT id FROM vendors WHERE id = ?")
      .get(input.referenceId) as { id: number } | undefined;
    if (!vendor) {
      throw new Error("Referensi vendor tidak ditemukan.");
    }
  }

  const submitterRow =
    input.referenceType === "Transaction"
      ? (db
          .prepare("SELECT guest_name, phone_number FROM transactions WHERE id = ?")
          .get(input.referenceId) as
          | { guest_name: string; phone_number: string }
          | undefined)
      : (db
          .prepare("SELECT vendor_name, phone_number FROM vendors WHERE id = ?")
          .get(input.referenceId) as
          | { vendor_name: string; phone_number: string | null }
          | undefined);

  const result = db
    .prepare(
      `
        INSERT INTO ratings (
          rating_type,
          reference_type,
          reference_id,
          quality_of_service,
          facilities,
          food_quality,
          cleanliness,
          source_awareness,
          general_rating,
          comment,
          submitter_phone,
          submitted_at
        ) VALUES (
          @ratingType,
          @referenceType,
          @referenceId,
          @qualityOfService,
          @facilities,
          @foodQuality,
          @cleanliness,
          @sourceAwareness,
          @generalRating,
          @comment,
          @submitterPhone,
          @submittedAt
        )
      `,
    )
    .run({
      ratingType: input.ratingType,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      qualityOfService: input.qualityOfService,
      facilities: input.facilities,
      foodQuality: input.foodQuality,
      cleanliness: input.cleanliness,
      sourceAwareness: input.sourceAwareness.trim() || "Other",
      generalRating: Math.max(1, Math.min(5, Math.floor(input.generalRating))),
      comment: input.comment?.trim() || null,
      submitterPhone: normalizePhoneNumber(
        (submitterRow && "phone_number" in submitterRow && submitterRow.phone_number) || "",
      ),
      submittedAt: nowIso(),
    });

  const settings = getGatewaySettings();
  const managers = [...new Set(settings.managerPhoneNumbers.map(normalizePhoneNumber))].filter(Boolean);

  const referenceLabel =
    submitterRow && "guest_name" in submitterRow
      ? submitterRow.guest_name
      : submitterRow && "vendor_name" in submitterRow
        ? submitterRow.vendor_name
        : "Unknown";

  for (const managerPhone of managers) {
    await sendWhatsAppMessage({
      recipientPhone: managerPhone,
      messageType: "Manager_Alert",
      channel: "rating",
      payload: {
        message: [
          `Rating baru: ${input.ratingType}`,
          `Referensi: ${referenceLabel}`,
          `General Rating: ${input.generalRating}/5`,
          `Komentar: ${input.comment?.trim() || "-"}`,
        ].join("\n"),
        ratingType: input.ratingType,
        referenceLabel,
        generalRating: input.generalRating,
      },
    });
  }

  const submitterPhone =
    submitterRow && "phone_number" in submitterRow
      ? normalizePhoneNumber(submitterRow.phone_number ?? "")
      : "";

  if (submitterPhone) {
    await sendWhatsAppMessage({
      recipientPhone: submitterPhone,
      messageType: "Rating_ThankYou",
      channel: "rating",
      payload: {
        message: "Terima kasih sudah mengisi rating Grand Sunshine Hotel.",
        ratingType: input.ratingType,
        referenceLabel,
      },
    });
  }

  return {
    id: Number(result.lastInsertRowid),
    managerCount: managers.length,
    submitterPhone: submitterPhone || undefined,
  };
}

export function listNotificationLogs(limit = 200): NotificationLogRecord[] {
  return db
    .prepare(
      `
        SELECT
          id,
          recipient_phone,
          message_type,
          payload,
          status,
          sent_at
        FROM notification_logs
        ORDER BY sent_at DESC, id DESC
        LIMIT ?
      `,
    )
    .all(limit) as NotificationLogRecord[];
}

export function getRatingTypeSummary(): RatingTypeSummary[] {
  return db
    .prepare(
      `
        SELECT
          rating_type,
          COUNT(*) AS total,
          ROUND(AVG(general_rating), 2) AS avg_rating
        FROM ratings
        GROUP BY rating_type
        ORDER BY total DESC
      `,
    )
    .all() as RatingTypeSummary[];
}

export function getDashboardSummary(): DashboardSummary {
  const today = toDateOnly();

  const totalRooms = db.prepare("SELECT COUNT(*) AS count FROM rooms").get() as {
    count: number;
  };
  const totalVendors = db.prepare("SELECT COUNT(*) AS count FROM vendors").get() as {
    count: number;
  };
  const inHouseGuests = db
    .prepare(
      `
        SELECT COUNT(*) AS count
        FROM transactions
        WHERE date(check_in_date) <= date(?)
          AND date(check_out_date) >= date(?)
      `,
    )
    .get(today, today) as { count: number };
  const vouchersToday = db
    .prepare("SELECT COUNT(*) AS count FROM vouchers WHERE valid_date = ?")
    .get(today) as { count: number };
  const scannedToday = db
    .prepare("SELECT COUNT(*) AS count FROM vouchers WHERE date(scanned_at) = date(?)")
    .get(today) as { count: number };
  const ratingsToday = db
    .prepare("SELECT COUNT(*) AS count FROM ratings WHERE date(submitted_at) = date(?)")
    .get(today) as { count: number };
  const avgRatingToday = db
    .prepare(
      "SELECT ROUND(COALESCE(AVG(general_rating), 0), 2) AS value FROM ratings WHERE date(submitted_at) = date(?)",
    )
    .get(today) as { value: number };
  const failedNotifications = db
    .prepare("SELECT COUNT(*) AS count FROM notification_logs WHERE status = 'Failed'")
    .get() as { count: number };

  return {
    totalRooms: totalRooms.count,
    totalVendors: totalVendors.count,
    inHouseGuests: inHouseGuests.count,
    vouchersToday: vouchersToday.count,
    scannedToday: scannedToday.count,
    ratingsToday: ratingsToday.count,
    avgRatingToday: avgRatingToday.value,
    failedNotifications: failedNotifications.count,
  };
}

export function listTransactionsForRating(type: Exclude<RatingType, "Vendor">): Array<{
  id: number;
  guest_name: string;
  room_name: string;
  check_in_date: string;
  check_out_date: string;
}> {
  const roomType: RoomType = type === "Meeting" ? "Meeting Room" : "Kamar";

  return db
    .prepare(
      `
        SELECT
          t.id,
          t.guest_name,
          r.room_number_name AS room_name,
          t.check_in_date,
          t.check_out_date
        FROM transactions t
        INNER JOIN rooms r ON r.id = t.room_id
        WHERE r.type = ?
        ORDER BY t.check_in_date DESC, t.id DESC
        LIMIT 300
      `,
    )
    .all(roomType) as Array<{
    id: number;
    guest_name: string;
    room_name: string;
    check_in_date: string;
    check_out_date: string;
  }>;
}

export function listVendorsForRating(): Array<{
  id: number;
  vendor_name: string;
  company_name: string;
}> {
  return db
    .prepare(
      `
        SELECT
          id,
          vendor_name,
          COALESCE(company_name, '') AS company_name
        FROM vendors
        ORDER BY vendor_name ASC
      `,
    )
    .all() as Array<{
    id: number;
    vendor_name: string;
    company_name: string;
  }>;
}

export function getAdminSnapshot() {
  return {
    summary: getDashboardSummary(),
    gatewaySettings: getGatewaySettings(),
    rooms: listRooms(300),
    vendors: listVendors(300),
    transactions: listTransactions(200),
    vouchers: listVouchers(240),
    ratings: listRatings(200),
    ratingSummary: getRatingTypeSummary(),
    notificationLogs: listNotificationLogs(240),
  };
}

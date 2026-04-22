import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// Test database setup
const testDbPath = path.join(process.cwd(), "test-db-temp.db");

let db: DatabaseSync;

beforeAll(() => {
  // Clean up any existing test db
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  db = new DatabaseSync(testDbPath);
  db.exec("PRAGMA foreign_keys = ON;");
});

afterAll(() => {
  if (db) {
    db.close();
  }
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

beforeEach(() => {
  // Reset database for each test
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_number_name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('Kamar', 'Meeting Room')),
      capacity INTEGER NOT NULL DEFAULT 0,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_name TEXT NOT NULL,
      company_name TEXT,
      contact_person TEXT,
      phone_number TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
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
      deleted_at TEXT,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
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
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    DELETE FROM rooms;
    DELETE FROM vendors;
    DELETE FROM transactions;
    DELETE FROM vouchers;
  `);
});

describe("Database Integration Tests", () => {
  describe("Rooms CRUD", () => {
    it("should create a room", () => {
      db.prepare(`
        INSERT INTO rooms (room_number_name, type, capacity, description)
        VALUES (?, ?, ?, ?)
      `).run("101", "Kamar", 2, "Deluxe Room");

      const room = db.prepare("SELECT * FROM rooms WHERE room_number_name = ?").get("101") as {
        id: number;
        room_number_name: string;
        type: string;
        capacity: number;
        description: string;
      };

      expect(room).toBeDefined();
      expect(room.room_number_name).toBe("101");
      expect(room.type).toBe("Kamar");
      expect(room.capacity).toBe(2);
      expect(room.description).toBe("Deluxe Room");
    });

    it("should soft delete a room", () => {
      db.prepare(`
        INSERT INTO rooms (room_number_name, type, capacity)
        VALUES (?, ?, ?)
      `).run("102", "Kamar", 2);

      const beforeDelete = db.prepare("SELECT * FROM rooms WHERE room_number_name = ?").get("102");
      expect(beforeDelete).toBeDefined();

      db.prepare("UPDATE rooms SET deleted_at = datetime('now') WHERE room_number_name = ?").run("102");

      const afterSoftDelete = db.prepare("SELECT * FROM rooms WHERE room_number_name = ? AND deleted_at IS NULL").get("102");
      expect(afterSoftDelete).toBeUndefined();

      const withDeleted = db.prepare("SELECT * FROM rooms WHERE room_number_name = ?").get("102");
      expect(withDeleted).toBeDefined();
    });

    it("should update a room", () => {
      db.prepare(`
        INSERT INTO rooms (room_number_name, type, capacity)
        VALUES (?, ?, ?)
      `).run("103", "Kamar", 2);

      db.prepare(`
        UPDATE rooms SET capacity = 4, type = 'Meeting Room' WHERE room_number_name = ?
      `).run("103");

      const room = db.prepare("SELECT * FROM rooms WHERE room_number_name = ?").get("103") as {
        capacity: number;
        type: string;
      };

      expect(room.capacity).toBe(4);
      expect(room.type).toBe("Meeting Room");
    });

    it("should prevent duplicate room names", () => {
      db.prepare(`
        INSERT INTO rooms (room_number_name, type, capacity)
        VALUES (?, ?, ?)
      `).run("104", "Kamar", 2);

      expect(() => {
        db.prepare(`
          INSERT INTO rooms (room_number_name, type, capacity)
          VALUES (?, ?, ?)
        `).run("104", "Meeting Room", 10);
      }).toThrow();
    });
  });

  describe("Transactions CRUD", () => {
    beforeEach(() => {
      // Create a room for transaction tests
      db.prepare(`
        INSERT INTO rooms (room_number_name, type, capacity)
        VALUES (?, ?, ?)
      `).run("201", "Kamar", 2);
    });

    it("should create a transaction", () => {
      const result = db.prepare(`
        INSERT INTO transactions (guest_name, phone_number, room_id, check_in_date, check_out_date, pax_adult, pax_child)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run("John Doe", "6281234567890", 1, "2024-03-01", "2024-03-05", 2, 0);

      const tx = db.prepare("SELECT * FROM transactions WHERE id = ?").get(result.lastInsertRowid) as {
        guest_name: string;
        phone_number: string;
        pax_adult: number;
      };

      expect(tx.guest_name).toBe("John Doe");
      expect(tx.phone_number).toBe("6281234567890");
      expect(tx.pax_adult).toBe(2);
    });

    it("should cascade delete vouchers when transaction deleted", () => {
      const txResult = db.prepare(`
        INSERT INTO transactions (guest_name, phone_number, room_id, check_in_date, check_out_date)
        VALUES (?, ?, ?, ?, ?)
      `).run("Jane Doe", "6281234567891", 1, "2024-03-01", "2024-03-05");

      db.prepare(`
        INSERT INTO vouchers (transaction_id, voucher_code, valid_date, pax_type, pax_index, qr_image_key)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(txResult.lastInsertRowid, "GS-20240301-1-A1-TEST123", "2024-03-01", "Adult", 1, "/qr/test.png");

      // Soft delete transaction
      db.prepare("UPDATE transactions SET deleted_at = datetime('now') WHERE id = ?").run(txResult.lastInsertRowid);

      // Vouchers should still exist (soft delete doesn't cascade)
      const voucher = db.prepare("SELECT * FROM vouchers WHERE transaction_id = ?").get(txResult.lastInsertRowid);
      expect(voucher).toBeDefined();

      // Hard delete
      db.prepare("DELETE FROM transactions WHERE id = ?").run(txResult.lastInsertRowid);

      const voucherAfterHardDelete = db.prepare("SELECT * FROM vouchers WHERE transaction_id = ?").get(txResult.lastInsertRowid);
      expect(voucherAfterHardDelete).toBeUndefined();
    });
  });

  describe("Vendor CRUD", () => {
    it("should create a vendor", () => {
      db.prepare(`
        INSERT INTO vendors (vendor_name, company_name, contact_person, phone_number)
        VALUES (?, ?, ?, ?)
      `).run("Catering ABC", "PT ABC Catering", "John Smith", "6281234567892");

      const vendor = db.prepare("SELECT * FROM vendors WHERE vendor_name = ?").get("Catering ABC") as {
        vendor_name: string;
        company_name: string;
      };

      expect(vendor.vendor_name).toBe("Catering ABC");
      expect(vendor.company_name).toBe("PT ABC Catering");
    });

    it("should soft delete a vendor", () => {
      db.prepare(`
        INSERT INTO vendors (vendor_name)
        VALUES (?)
      `).run("Test Vendor");

      db.prepare("UPDATE vendors SET deleted_at = datetime('now') WHERE vendor_name = ?").run("Test Vendor");

      const active = db.prepare("SELECT * FROM vendors WHERE vendor_name = ? AND deleted_at IS NULL").get("Test Vendor");
      expect(active).toBeUndefined();

      const withDeleted = db.prepare("SELECT * FROM vendors WHERE vendor_name = ?").get("Test Vendor");
      expect(withDeleted).toBeDefined();
    });
  });

  describe("Phone Number Normalization", () => {
    it("should normalize phone numbers", () => {
      // 08xx format
      const phone1 = "081234567890".replace(/^0/, "62");
      expect(phone1).toBe("6281234567890");

      // Already 62 format
      const phone2 = "6281234567890".replace(/^62/, "62");
      expect(phone2).toBe("6281234567890");
    });
  });

  describe("Date Handling", () => {
    it("should validate date range", () => {
      const checkIn = "2024-03-10";
      const checkOut = "2024-03-05";

      const isValid = checkIn <= checkOut;
      expect(isValid).toBe(false);
    });

    it("should parse various date formats", () => {
      const parseDate = (input: string) => {
        const clean = input.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
          return clean;
        }
        const parsed = new Date(clean.replace(/\./g, "-"));
        if (!Number.isNaN(parsed.getTime())) {
          return parsed.toISOString().slice(0, 10);
        }
        return null;
      };

      expect(parseDate("2024-03-15")).toBe("2024-03-15");
      expect(parseDate("15/03/2024")).toBe("2024-03-15");
      expect(parseDate("15.03.2024")).toBe("2024-03-15");
    });
  });
});
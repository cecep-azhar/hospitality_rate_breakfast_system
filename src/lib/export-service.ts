// Export service untuk CSV dan Excel

import * as XLSX from "xlsx";
import type {
  RoomRecord,
  VendorRecord,
  TransactionRecord,
  VoucherRecord,
  RatingRecord,
} from "@/lib/hotel-types";

export function roomsToExcel(rooms: RoomRecord[]): Buffer {
  const data = rooms.map((room) => ({
    ID: room.id,
    "Room Number/Name": room.room_number_name,
    Type: room.type,
    Capacity: room.capacity,
    Description: room.description || "",
    "Created At": room.created_at,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rooms");

  const colWidths = [
    { wch: 8 },
    { wch: 25 },
    { wch: 15 },
    { wch: 10 },
    { wch: 30 },
    { wch: 22 },
  ];
  worksheet["!cols"] = colWidths;

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as unknown as Buffer;
}

export function vendorsToExcel(vendors: VendorRecord[]): Buffer {
  const data = vendors.map((vendor) => ({
    ID: vendor.id,
    "Vendor Name": vendor.vendor_name,
    "Company Name": vendor.company_name || "",
    "Contact Person": vendor.contact_person || "",
    "Phone Number": vendor.phone_number || "",
    "Created At": vendor.created_at,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vendors");

  const colWidths = [
    { wch: 8 },
    { wch: 25 },
    { wch: 25 },
    { wch: 20 },
    { wch: 18 },
    { wch: 22 },
  ];
  worksheet["!cols"] = colWidths;

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as unknown as Buffer;
}

export function transactionsToExcel(transactions: TransactionRecord[]): Buffer {
  const data = transactions.map((tx) => ({
    ID: tx.id,
    "Guest Name": tx.guest_name,
    "Phone Number": tx.phone_number,
    Email: tx.email || "",
    Room: tx.room_name,
    "Room Type": tx.room_type,
    "Check In": tx.check_in_date,
    "Check Out": tx.check_out_date,
    "Pax Adult": tx.pax_adult,
    "Pax Child": tx.pax_child,
    "Source Booking": tx.source_booking || "",
    "Created At": tx.created_at,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

  const colWidths = [
    { wch: 8 },
    { wch: 25 },
    { wch: 18 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 15 },
    { wch: 22 },
  ];
  worksheet["!cols"] = colWidths;

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as unknown as Buffer;
}

export function vouchersToExcel(vouchers: VoucherRecord[]): Buffer {
  const data = vouchers.map((v) => ({
    ID: v.id,
    "Guest Name": v.guest_name,
    "Voucher Code": v.voucher_code,
    "Valid Date": v.valid_date,
    "Pax Type": v.pax_type,
    "Pax Index": v.pax_index,
    Status: v.status,
    "Scanned At": v.scanned_at || "",
    "Created At": v.created_at,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vouchers");

  const colWidths = [
    { wch: 8 },
    { wch: 25 },
    { wch: 30 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 22 },
    { wch: 22 },
  ];
  worksheet["!cols"] = colWidths;

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as unknown as Buffer;
}

export function ratingsToExcel(ratings: RatingRecord[]): Buffer {
  const data = ratings.map((r) => ({
    ID: r.id,
    Type: r.rating_type,
    Reference: r.reference_label,
    "Quality of Service": r.quality_of_service,
    Facilities: r.facilities,
    "Food Quality": r.food_quality,
    Cleanliness: r.cleanliness,
    "Source Awareness": r.source_awareness,
    "General Rating": r.general_rating,
    Comment: r.comment || "",
    "Submitted At": r.submitted_at,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Ratings");

  const colWidths = [
    { wch: 8 },
    { wch: 10 },
    { wch: 25 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 15 },
    { wch: 30 },
    { wch: 22 },
  ];
  worksheet["!cols"] = colWidths;

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as unknown as Buffer;
}

// CSV Export Functions
export function toCSV<T extends Record<string, unknown>>(data: T[], headers?: string[]): string {
  if (data.length === 0) return "";

  const keys = headers || Object.keys(data[0]);

  const headerRow = keys.join(",");
  const dataRows = data.map((row) =>
    keys.map((key) => {
      const value = row[key];
      const stringValue = value === null || value === undefined ? "" : String(value);
      // Escape quotes and wrap in quotes if contains comma or newline
      if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

export function roomsToCSV(rooms: RoomRecord[]): string {
  return toCSV(
    rooms.map((room) => ({
      id: room.id,
      room_number_name: room.room_number_name,
      type: room.type,
      capacity: room.capacity,
      description: room.description || "",
      created_at: room.created_at,
    }))
  );
}

export function transactionsToCSV(transactions: TransactionRecord[]): string {
  return toCSV(
    transactions.map((tx) => ({
      id: tx.id,
      guest_name: tx.guest_name,
      phone_number: tx.phone_number,
      email: tx.email || "",
      room_name: tx.room_name,
      room_type: tx.room_type,
      check_in_date: tx.check_in_date,
      check_out_date: tx.check_out_date,
      pax_adult: tx.pax_adult,
      pax_child: tx.pax_child,
      source_booking: tx.source_booking || "",
      created_at: tx.created_at,
    }))
  );
}

export function ratingsToCSV(ratings: RatingRecord[]): string {
  return toCSV(
    ratings.map((r) => ({
      id: r.id,
      rating_type: r.rating_type,
      reference_label: r.reference_label,
      quality_of_service: r.quality_of_service,
      facilities: r.facilities,
      food_quality: r.food_quality,
      cleanliness: r.cleanliness,
      source_awareness: r.source_awareness,
      general_rating: r.general_rating,
      comment: r.comment || "",
      submitted_at: r.submitted_at,
    }))
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createRoom,
  createTransaction,
  createVendor,
  generateVouchersForDate,
  importTransactionsFromExcel,
  normalizePhoneNumber,
  saveGatewaySettings,
  scanVoucherByCode,
  sendVoucherManual,
  submitRating,
  toDateOnly,
} from "@/lib/hotel-service";
import type { RatingScale, RatingType, RoomType } from "@/lib/hotel-types";

function messageFromError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Terjadi error yang tidak diketahui.";
}

function withStatus(path: string, status: "success" | "error", message: string): string {
  const [base, query] = path.split("?");
  const params = new URLSearchParams(query || "");
  params.set("status", status);
  params.set("message", message);
  return `${base}?${params.toString()}`;
}

const allowedRatingScale = new Set<RatingScale>(["Poor", "Good", "Excellent"]);

function ensureRatingScale(value: string): RatingScale {
  if (allowedRatingScale.has(value as RatingScale)) {
    return value as RatingScale;
  }

  return "Good";
}

function ensureRatingType(value: string): RatingType {
  if (value === "Room" || value === "Meeting" || value === "Vendor") {
    return value;
  }

  return "Room";
}

export async function saveGatewaySettingsAction(formData: FormData) {
  let targetPath = "/admin";

  try {
    const managerPhoneRaw = String(formData.get("managerPhoneNumbers") ?? "");
    const managerPhones = managerPhoneRaw
      .split(/[,\n]/)
      .map((phone) => normalizePhoneNumber(phone.trim()))
      .filter(Boolean);

    saveGatewaySettings({
      waEndpointVoucher: String(formData.get("waEndpointVoucher") ?? "").trim(),
      waTokenVoucher: String(formData.get("waTokenVoucher") ?? "").trim(),
      waEndpointRating: String(formData.get("waEndpointRating") ?? "").trim(),
      waTokenRating: String(formData.get("waTokenRating") ?? "").trim(),
      managerPhoneNumbers: managerPhones,
      videoAdsUrl: String(formData.get("videoAdsUrl") ?? "").trim(),
    });

    revalidatePath("/admin");
    revalidatePath("/ads");
    targetPath = withStatus("/admin", "success", "Gateway settings berhasil disimpan.");
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

export async function addRoomAction(formData: FormData) {
  let targetPath = "/admin";

  try {
    const roomType = String(formData.get("type") ?? "Kamar") as RoomType;

    createRoom({
      roomNumberName: String(formData.get("roomNumberName") ?? ""),
      type: roomType === "Meeting Room" ? "Meeting Room" : "Kamar",
      capacity: Number(formData.get("capacity") ?? 0),
      description: String(formData.get("description") ?? ""),
    });

    revalidatePath("/admin");
    targetPath = withStatus("/admin", "success", "Master room berhasil ditambahkan.");
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

export async function addVendorAction(formData: FormData) {
  let targetPath = "/admin";

  try {
    createVendor({
      vendorName: String(formData.get("vendorName") ?? ""),
      companyName: String(formData.get("companyName") ?? ""),
      contactPerson: String(formData.get("contactPerson") ?? ""),
      phoneNumber: String(formData.get("phoneNumber") ?? ""),
    });

    revalidatePath("/admin");
    revalidatePath("/rating/form");
    targetPath = withStatus("/admin", "success", "Master vendor berhasil ditambahkan.");
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

export async function addTransactionAction(formData: FormData) {
  let targetPath = "/admin";

  try {
    const roomIdRaw = String(formData.get("roomId") ?? "").trim();
    const roomNameRaw = String(formData.get("roomName") ?? "").trim();
    const roomTypeRaw = String(formData.get("roomType") ?? "Kamar");

    createTransaction({
      guestName: String(formData.get("guestName") ?? ""),
      phoneNumber: String(formData.get("phoneNumber") ?? ""),
      email: String(formData.get("email") ?? ""),
      roomId: roomIdRaw ? Number(roomIdRaw) : undefined,
      roomName: roomNameRaw || undefined,
      roomType: roomTypeRaw === "Meeting Room" ? "Meeting Room" : "Kamar",
      checkInDate: String(formData.get("checkInDate") ?? ""),
      checkOutDate: String(formData.get("checkOutDate") ?? ""),
      paxAdult: Number(formData.get("paxAdult") ?? 1),
      paxChild: Number(formData.get("paxChild") ?? 0),
      sourceBooking: String(formData.get("sourceBooking") ?? ""),
    });

    revalidatePath("/admin");
    revalidatePath("/rating/form");
    targetPath = withStatus("/admin", "success", "Transaction tamu berhasil ditambahkan.");
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

export async function importTransactionsAction(formData: FormData) {
  let targetPath = "/admin";

  try {
    const file = formData.get("excelFile");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Pilih file Excel terlebih dahulu.");
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const result = importTransactionsFromExcel(fileBuffer);

    revalidatePath("/admin");
    revalidatePath("/rating/form");
    targetPath = withStatus(
      "/admin",
      "success",
      `Import selesai. Inserted ${result.inserted}, skipped ${result.skipped}.`,
    );
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

export async function generateVouchersAction(formData: FormData) {
  let targetPath = "/admin";

  try {
    const validDateRaw = String(formData.get("validDate") ?? "").trim();
    const result = await generateVouchersForDate(validDateRaw || undefined);

    revalidatePath("/admin");
    revalidatePath("/scan");
    targetPath = withStatus(
      "/admin",
      "success",
      `Generate voucher selesai. ${result.generatedCount} voucher untuk ${result.transactionCount} tamu in-house pada ${result.validDate}.`,
    );
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

export async function sendVoucherManualAction(formData: FormData) {
  let targetPath = "/admin";

  try {
    const transactionId = Number(formData.get("transactionId") ?? 0);
    if (!transactionId) {
      throw new Error("Transaction ID wajib diisi.");
    }

    const validDateRaw = String(formData.get("validDate") ?? "").trim();
    const validDate = validDateRaw ? toDateOnly(validDateRaw) : undefined;

    const result = await sendVoucherManual({
      transactionId,
      validDate,
    });

    revalidatePath("/admin");
    targetPath = withStatus(
      "/admin",
      result.ok ? "success" : "error",
      `Send manual ${result.ok ? "berhasil" : "gagal"}. ${result.sentCount} voucher untuk tanggal ${result.validDate}.`,
    );
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

export async function submitRatingAction(formData: FormData) {
  const ratingType = ensureRatingType(String(formData.get("ratingType") ?? "Room"));
  let targetPath = `/rating/form?type=${encodeURIComponent(ratingType)}`;

  try {
    const referenceId = Number(formData.get("referenceId") ?? 0);
    if (!referenceId) {
      throw new Error("Referensi rating wajib dipilih.");
    }

    await submitRating({
      ratingType,
      referenceType: ratingType === "Vendor" ? "Vendor" : "Transaction",
      referenceId,
      qualityOfService: ensureRatingScale(String(formData.get("qualityOfService") ?? "Good")),
      facilities: ensureRatingScale(String(formData.get("facilities") ?? "Good")),
      foodQuality: ensureRatingScale(String(formData.get("foodQuality") ?? "Good")),
      cleanliness: ensureRatingScale(String(formData.get("cleanliness") ?? "Good")),
      sourceAwareness: String(formData.get("sourceAwareness") ?? "Other"),
      generalRating: Number(formData.get("generalRating") ?? 5),
      comment: String(formData.get("comment") ?? ""),
    });

    revalidatePath("/admin");

    const nextPath = `/rating/thanks?type=${encodeURIComponent(ratingType)}`;
    const params = new URLSearchParams({
      type: ratingType,
      next: nextPath,
    });

    targetPath = `/ads?${params.toString()}`;
  } catch (error) {
    targetPath = withStatus(targetPath, "error", messageFromError(error));
  }

  redirect(targetPath);
}

export async function scanVoucherAction(formData: FormData) {
  let targetPath = "/scan";

  try {
    const voucherCode = String(formData.get("voucherCode") ?? "");
    const result = scanVoucherByCode(voucherCode);

    revalidatePath("/admin");
    targetPath = withStatus("/scan", result.ok ? "success" : "error", result.message);
  } catch (error) {
    targetPath = withStatus("/scan", "error", messageFromError(error));
  }

  redirect(targetPath);
}

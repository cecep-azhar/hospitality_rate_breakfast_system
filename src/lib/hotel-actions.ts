"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  getAdminSession,
} from "@/lib/auth-session";
import {
  authenticateAdminUser,
  createRoom,
  updateRoom,
  deleteRoom,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createVendor,
  updateVendor,
  deleteVendor,
  generateVouchersForDate,
  importTransactionsFromExcel,
  normalizePhoneNumber,
  saveGatewaySettings,
  scanVoucherByCode,
  sendVoucherManual,
  submitRating,
  toDateOnly,
} from "@/lib/hotel-service";
import { normalizeInternalPath } from "@/lib/route-utils";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limiter";
import type { RatingScale, RatingType, RoomType } from "@/lib/hotel-types";

function messageFromError(error: unknown): string {
  if (process.env.NODE_ENV === "production") {
    logger.error("Unhandled error", { error: error instanceof Error ? error.message : String(error) });
    return "Terjadi error yang tidak diketahui.";
  }

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

function loginPathWithNext(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

async function requireAdminSessionOrRedirect(nextPath = "/admin") {
  const session = await getAdminSession();
  if (!session) {
    redirect(withStatus(loginPathWithNext(nextPath), "error", "Silakan login terlebih dahulu."));
  }

  return session;
}

async function getClientIP(): Promise<string> {
  try {
    const headersList = await headers();
    const forwarded = headersList.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    return headersList.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

export async function loginAdminAction(formData: FormData) {
  const ip = await getClientIP();
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    logger.warn("Rate limit exceeded for login", { ip });
    redirect(
      withStatus(
        loginPathWithNext("/admin"),
        "error",
        `Terlalu banyak percobaan login. Silakan coba lagi dalam ${rateLimit.retryAfter} detik.`,
      ),
    );
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = normalizeInternalPath(String(formData.get("next") ?? "/admin"));

  if (!email || !password) {
    redirect(withStatus(loginPathWithNext(nextPath), "error", "Email dan password wajib diisi."));
  }

  const user = authenticateAdminUser({
    email,
    password,
  });

  if (!user) {
    logger.auth.login(email, false, { ip, remaining: rateLimit.remaining });
    redirect(withStatus(loginPathWithNext(nextPath), "error", "Email atau password salah."));
  }

  await createAdminSessionCookie({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  redirect(nextPath);
}

export async function logoutAdminAction() {
  await clearAdminSessionCookie();
  redirect(withStatus("/login", "success", "Logout berhasil."));
}

export async function saveGatewaySettingsAction(formData: FormData) {
  await requireAdminSessionOrRedirect("/admin");
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
  await requireAdminSessionOrRedirect("/admin");
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
  await requireAdminSessionOrRedirect("/admin");
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
  await requireAdminSessionOrRedirect("/admin");
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
  await requireAdminSessionOrRedirect("/admin");
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
  await requireAdminSessionOrRedirect("/admin");
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
  await requireAdminSessionOrRedirect("/admin");
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

// ============ UPDATE ACTIONS ============

export async function updateRoomAction(formData: FormData) {
  await requireAdminSessionOrRedirect("/admin");
  let targetPath = "/admin";

  try {
    const id = Number(formData.get("id") ?? 0);
    if (!id) {
      throw new Error("Room ID wajib diisi.");
    }

    const roomType = String(formData.get("type") ?? "Kamar") as RoomType;

    updateRoom(id, {
      roomNumberName: String(formData.get("roomNumberName") ?? ""),
      type: roomType === "Meeting Room" ? "Meeting Room" : "Kamar",
      capacity: Number(formData.get("capacity") ?? 0),
      description: String(formData.get("description") ?? ""),
    });

    revalidatePath("/admin");
    targetPath = withStatus("/admin", "success", "Master room berhasil diperbarui.");
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

export async function updateVendorAction(formData: FormData) {
  await requireAdminSessionOrRedirect("/admin");
  let targetPath = "/admin";

  try {
    const id = Number(formData.get("id") ?? 0);
    if (!id) {
      throw new Error("Vendor ID wajib diisi.");
    }

    updateVendor(id, {
      vendorName: String(formData.get("vendorName") ?? ""),
      companyName: String(formData.get("companyName") ?? ""),
      contactPerson: String(formData.get("contactPerson") ?? ""),
      phoneNumber: String(formData.get("phoneNumber") ?? ""),
    });

    revalidatePath("/admin");
    revalidatePath("/rating/form");
    targetPath = withStatus("/admin", "success", "Master vendor berhasil diperbarui.");
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

export async function updateTransactionAction(formData: FormData) {
  await requireAdminSessionOrRedirect("/admin");
  let targetPath = "/admin";

  try {
    const id = Number(formData.get("id") ?? 0);
    if (!id) {
      throw new Error("Transaction ID wajib diisi.");
    }

    const roomIdRaw = String(formData.get("roomId") ?? "").trim();

    updateTransaction(id, {
      guestName: String(formData.get("guestName") ?? ""),
      phoneNumber: String(formData.get("phoneNumber") ?? ""),
      email: String(formData.get("email") ?? ""),
      roomId: roomIdRaw ? Number(roomIdRaw) : undefined,
      checkInDate: String(formData.get("checkInDate") ?? ""),
      checkOutDate: String(formData.get("checkOutDate") ?? ""),
      paxAdult: Number(formData.get("paxAdult") ?? 1),
      paxChild: Number(formData.get("paxChild") ?? 0),
      sourceBooking: String(formData.get("sourceBooking") ?? ""),
    });

    revalidatePath("/admin");
    revalidatePath("/rating/form");
    targetPath = withStatus("/admin", "success", "Transaction tamu berhasil diperbarui.");
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

// ============ DELETE ACTIONS ============

export async function deleteRoomAction(formData: FormData) {
  await requireAdminSessionOrRedirect("/admin");
  let targetPath = "/admin";

  try {
    const id = Number(formData.get("id") ?? 0);
    if (!id) {
      throw new Error("Room ID wajib diisi.");
    }

    deleteRoom(id);

    revalidatePath("/admin");
    targetPath = withStatus("/admin", "success", "Room berhasil dihapus.");
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

export async function deleteVendorAction(formData: FormData) {
  await requireAdminSessionOrRedirect("/admin");
  let targetPath = "/admin";

  try {
    const id = Number(formData.get("id") ?? 0);
    if (!id) {
      throw new Error("Vendor ID wajib diisi.");
    }

    deleteVendor(id);

    revalidatePath("/admin");
    revalidatePath("/rating/form");
    targetPath = withStatus("/admin", "success", "Vendor berhasil dihapus.");
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

export async function deleteTransactionAction(formData: FormData) {
  await requireAdminSessionOrRedirect("/admin");
  let targetPath = "/admin";

  try {
    const id = Number(formData.get("id") ?? 0);
    if (!id) {
      throw new Error("Transaction ID wajib diisi.");
    }

    deleteTransaction(id);

    revalidatePath("/admin");
    revalidatePath("/rating/form");
    targetPath = withStatus("/admin", "success", "Transaction tamu berhasil dihapus.");
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

// ============ CHANGE PASSWORD ============

export async function changePasswordAction(formData: FormData) {
  const session = await requireAdminSessionOrRedirect("/admin");
  let targetPath = "/admin";

  try {
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new Error("Semua field password wajib diisi.");
    }

    if (newPassword !== confirmPassword) {
      throw new Error("Password baru dan konfirmasi tidak cocok.");
    }

    if (newPassword.length < 8) {
      throw new Error("Password baru minimal 8 karakter.");
    }

    const { changeUserPassword } = await import("@/lib/hotel-service");
    changeUserPassword(session.email, currentPassword, newPassword);

    targetPath = withStatus("/admin", "success", "Password berhasil diubah.");
  } catch (error) {
    targetPath = withStatus("/admin", "error", messageFromError(error));
  }

  redirect(targetPath);
}

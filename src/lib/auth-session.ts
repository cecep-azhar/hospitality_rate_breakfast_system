import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/constants";
import { logger } from "@/lib/logger";

export interface AdminSession {
  userId: number;
  name: string;
  email: string;
  role: UserRole;
  exp: number;
}

export type UserRole = "Super Admin" | "Resto Checker" | "Manager";

function getAuthSecret(): string {
  const secret = process.env.APP_AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("APP_AUTH_SECRET environment variable is required and must be at least 32 characters");
  }
  return secret;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf-8");
}

function signPayload(payloadPart: string): string {
  return createHmac("sha256", getAuthSecret()).update(payloadPart).digest("base64url");
}

function safeCompareText(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, "utf-8");
  const bBuffer = Buffer.from(b, "utf-8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function signSessionToken(payload: AdminSession): string {
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(payloadPart);
  return `${payloadPart}.${signature}`;
}

function verifySessionToken(token: string): AdminSession | null {
  const [payloadPart, signature] = token.split(".");

  if (!payloadPart || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payloadPart);
  if (!safeCompareText(signature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadPart)) as Partial<AdminSession>;
    if (
      typeof parsed.userId !== "number" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.role !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }

    if (parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (
      parsed.role !== "Super Admin" &&
      parsed.role !== "Resto Checker" &&
      parsed.role !== "Manager"
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export async function createAdminSessionCookie(input: {
  userId: number;
  name: string;
  email: string;
  role: UserRole;
}) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;

  const token = signSessionToken({
    userId: input.userId,
    name: input.name,
    email: input.email,
    role: input.role,
    exp,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  logger.auth.login(input.email, true, { userId: input.userId, role: input.role });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!rawToken) {
    return null;
  }

  const session = verifySessionToken(rawToken);

  if (!session) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    logger.auth.sessionExpired(0);
    return null;
  }

  return session;
}

export async function rotateSessionToken(): Promise<string | null> {
  const session = await getAdminSession();
  if (!session) {
    return null;
  }

  const newExp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const newToken = signSessionToken({
    ...session,
    exp: newExp,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return newToken;
}

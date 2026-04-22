// 2FA Service - TOTP-based Two-Factor Authentication

import { randomBytes, createHmac } from "node:crypto";

const TOTP_ISSUER = process.env.HOTEL_NAME || "Grand Sunshine";
const TOTP_DIGITS = 6;
const TOTP_INTERVAL = 30; // seconds
const TOTP_ALGORITHM = "sha1";

export interface TOTPSecret {
  secret: string;
  qrCodeUrl: string;
}

export interface TOTPCode {
  code: string;
  expiresAt: number;
}

export function generateTOTPSecret(email: string): TOTPSecret {
  const secret = randomBytes(20).toString("base32");
  const qrCodeUrl = generateOTPAuthUrl(email, secret);

  return {
    secret,
    qrCodeUrl,
  };
}

export function generateOTPAuthUrl(email: string, secret: string): string {
  const encodedIssuer = encodeURIComponent(TOTP_ISSUER);
  const encodedEmail = encodeURIComponent(email);
  const encodedSecret = secret.replace(/ /g, "").toUpperCase();

  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${encodedSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_INTERVAL}`;
}

export function generateTOTPCode(): TOTPCode {
  const code = randomBytes(3).readUInt32BE(0) % Math.pow(10, TOTP_DIGITS);
  const paddedCode = code.toString().padStart(TOTP_DIGITS, "0");

  return {
    code: paddedCode,
    expiresAt: Date.now() + TOTP_INTERVAL * 1000,
  };
}

export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomBytes(4).toString("hex").toUpperCase().match(/.{4}/g)?.join("-") || "";
    codes.push(code);
  }
  return codes;
}

export function verifyTOTP(secret: string, userCode: string): boolean {
  const cleanCode = userCode.replace(/\s/g, "").replace(/-/g, "");

  if (cleanCode.length !== TOTP_DIGITS || !/^\d+$/.test(cleanCode)) {
    return false;
  }

  const time = Math.floor(Date.now() / 1000 / TOTP_INTERVAL);

  // Check current and previous time windows
  for (let i = -1; i <= 1; i++) {
    const expectedCode = generateTOTPFromTime(secret, time + i);
    if (timingSafeEqual(cleanCode, expectedCode)) {
      return true;
    }
  }

  return false;
}

function generateTOTPFromTime(secret: string, counter: number): string {
  const key = Buffer.from(secret.replace(/ /g, "").toUpperCase(), "base32");
  const buffer = Buffer.alloc(8);

  // Convert counter to big-endian
  buffer.writeBigUInt64BE(BigInt(counter), 0);

  const hmac = createHmac(TOTP_ALGORITHM, key);
  hmac.update(buffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

export function verifyBackupCode(storedCodes: string[], enteredCode: string): {
  valid: boolean;
  remainingCodes: number;
} {
  const cleanCode = enteredCode.replace(/\s/g, "").replace(/–/g, "-").toUpperCase();

  const index = storedCodes.findIndex(
    (code) => code.replace(/\s/g, "").replace(/–/g, "-").toUpperCase() === cleanCode
  );

  if (index === -1) {
    return { valid: false, remainingCodes: storedCodes.length };
  }

  // Remove used backup code
  storedCodes.splice(index, 1);

  return { valid: true, remainingCodes: storedCodes.length };
}

// QR Code generation for authenticator apps
export async function generateQRCodeDataUrl(otpAuthUrl: string): Promise<string> {
  const QRCode = (await import("qrcode")).default;

  return QRCode.toDataURL(otpAuthUrl, {
    width: 200,
    margin: 1,
    color: {
      dark: "#0f1d3a",
      light: "#ffffff",
    },
  });
}
import { describe, it, expect, beforeEach } from "vitest";
import { toDateOnly, normalizePhoneNumber } from "@/lib/hotel-service";
import { hashPassword, verifyPassword } from "@/lib/hotel-service";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limiter";
import { isCircuitOpen, recordSuccess, recordFailure, resetCircuit } from "@/lib/circuit-breaker";

describe("toDateOnly", () => {
  it("should return date in YYYY-MM-DD format", () => {
    expect(toDateOnly("2024-03-15")).toBe("2024-03-15");
  });

  it("should parse Date object", () => {
    const date = new Date("2024-03-15T10:30:00Z");
    expect(toDateOnly(date)).toBe("2024-03-15");
  });

  it("should throw for invalid date", () => {
    expect(() => toDateOnly("invalid")).toThrow("Format tanggal tidak valid");
  });

  it("should trim input", () => {
    expect(toDateOnly("  2024-03-15  ")).toBe("2024-03-15");
  });
});

describe("normalizePhoneNumber", () => {
  it("should convert 08xx to 62xx", () => {
    expect(normalizePhoneNumber("081234567890")).toBe("6281234567890");
  });

  it("should keep 62xx as is", () => {
    expect(normalizePhoneNumber("6281234567890")).toBe("6281234567890");
  });

  it("should remove non-digits", () => {
    expect(normalizePhoneNumber("+62 812 345 6789")).toBe("628123456789");
  });

  it("should return empty string for empty input", () => {
    expect(normalizePhoneNumber("")).toBe("");
    expect(normalizePhoneNumber("   ")).toBe("");
  });
});

describe("Password hashing", () => {
  it("should hash and verify password correctly", () => {
    const password = "TestPassword123!";
    const hashed = hashPassword(password);

    expect(hashed).not.toBe(password);
    expect(hashed.split(":").length).toBe(2);
    expect(verifyPassword(password, hashed)).toBe(true);
  });

  it("should reject wrong password", () => {
    const password = "TestPassword123!";
    const hashed = hashPassword(password);

    expect(verifyPassword("WrongPassword", hashed)).toBe(false);
  });

  it("should handle legacy password format", () => {
    const legacyPassword = "plaintext";
    expect(verifyPassword(legacyPassword, legacyPassword)).toBe(true);
  });

  it("should handle invalid legacy format", () => {
    expect(verifyPassword("test", "invalid")).toBe(false);
  });
});

describe("Rate Limiter", () => {
  beforeEach(() => {
    resetRateLimit("test-ip");
  });

  it("should allow first request", () => {
    const result = checkRateLimit("test-ip");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("should allow multiple requests within limit", () => {
    for (let i = 0; i < 4; i++) {
      const result = checkRateLimit("test-ip");
      expect(result.allowed).toBe(true);
    }
  });

  it("should block after max attempts", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("test-ip");
    }
    const result = checkRateLimit("test-ip");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeDefined();
  });
});

describe("Circuit Breaker", () => {
  beforeEach(() => {
    resetCircuit("test-api");
  });

  it("should be closed by default", () => {
    expect(isCircuitOpen("test-api")).toBe(false);
  });

  it("should track failures", () => {
    for (let i = 0; i < 4; i++) {
      recordFailure("test-api");
    }
    expect(isCircuitOpen("test-api")).toBe(false);
  });

  it("should open after threshold", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure("test-api");
    }
    expect(isCircuitOpen("test-api")).toBe(true);
  });

  it("should reset on success", () => {
    recordFailure("test-api");
    recordFailure("test-api");
    recordSuccess("test-api");
    expect(isCircuitOpen("test-api")).toBe(false);
  });
});
// Client-side validation utilities

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface FieldRule {
  field: string;
  rules: Array<{
    test: (value: unknown) => boolean;
    message: string;
  }>;
}

export function validateForm(rules: FieldRule[], values: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};

  for (const rule of rules) {
    const value = values[rule.field];

    for (const { test, message } of rule.rules) {
      if (!test(value)) {
        errors[rule.field] = message;
        break;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// Common validation rules
export const rules = {
  required: (message = "Field ini wajib diisi") => ({
    test: (value: unknown) => {
      if (typeof value === "string") return value.trim().length > 0;
      return value !== null && value !== undefined;
    },
    message,
  }),

  email: (message = "Format email tidak valid") => ({
    test: (value: unknown) => {
      if (!value || typeof value !== "string") return false;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value.trim());
    },
    message,
  }),

  minLength: (min: number, message?: string) => ({
    test: (value: unknown) => {
      if (typeof value !== "string") return false;
      return value.length >= min;
    },
    message: message || `Minimal ${min} karakter`,
  }),

  maxLength: (max: number, message?: string) => ({
    test: (value: unknown) => {
      if (typeof value !== "string") return true;
      return value.length <= max;
    },
    message: message || `Maksimal ${max} karakter`,
  }),

  phone: (message = "Format nomor telepon tidak valid") => ({
    test: (value: unknown) => {
      if (!value || typeof value !== "string") return false;
      const digits = value.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    },
    message,
  }),

  positiveNumber: (message = "Harus berupa angka positif") => ({
    test: (value: unknown) => {
      if (typeof value === "number") return value > 0;
      if (typeof value === "string") {
        const num = Number(value);
        return !isNaN(num) && num > 0;
      }
      return false;
    },
    message,
  }),

  date: (message = "Format tanggal tidak valid") => ({
    test: (value: unknown) => {
      if (!value || typeof value !== "string") return false;
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value)) return false;
      const date = new Date(value);
      return !isNaN(date.getTime());
    },
    message,
  }),

  dateRange: (checkInField: string, checkOutField: string, message?: string) => ({
    test: (value: unknown, allValues: Record<string, unknown>) => {
      const checkIn = allValues[checkInField];
      const checkOut = allValues[checkOutField];
      if (!checkIn || !checkOut) return true; // Let required rule handle
      return checkIn <= checkOut;
    },
    message: message || "Check-out tidak boleh sebelum check-in",
  }),

  oneOf: (options: string[], message?: string) => ({
    test: (value: unknown) => {
      return options.includes(String(value));
    },
    message: message || `Nilai harus salah satu dari: ${options.join(", ")}`,
  }),

  pattern: (regex: RegExp, message: string) => ({
    test: (value: unknown) => {
      if (typeof value !== "string") return false;
      return regex.test(value);
    },
    message,
  }),
};

// Room form validation
export function validateRoomForm(values: Record<string, unknown>): ValidationResult {
  return validateForm(
    [
      { field: "roomNumberName", rules: [rules.required(), rules.minLength(1), rules.maxLength(50)] },
      { field: "type", rules: [rules.required(), rules.oneOf(["Kamar", "Meeting Room"])] },
      { field: "capacity", rules: [rules.required(), rules.positiveNumber()] },
    ],
    values
  );
}

// Vendor form validation
export function validateVendorForm(values: Record<string, unknown>): ValidationResult {
  return validateForm(
    [
      { field: "vendorName", rules: [rules.required(), rules.minLength(1), rules.maxLength(100)] },
      { field: "phoneNumber", rules: [rules.phone()] },
    ],
    values
  );
}

// Transaction form validation
export function validateTransactionForm(values: Record<string, unknown>): ValidationResult {
  return validateForm(
    [
      { field: "guestName", rules: [rules.required(), rules.minLength(1), rules.maxLength(100)] },
      { field: "phoneNumber", rules: [rules.required(), rules.phone()] },
      { field: "email", rules: [rules.email()] },
      { field: "roomId", rules: [rules.required("Room wajib dipilih")] },
      { field: "checkInDate", rules: [rules.required(), rules.date()] },
      { field: "checkOutDate", rules: [rules.required(), rules.date()] },
      { field: "paxAdult", rules: [rules.required(), rules.positiveNumber()] },
    ],
    values
  );
}

// Rating form validation
export function validateRatingForm(values: Record<string, unknown>): ValidationResult {
  return validateForm(
    [
      { field: "referenceId", rules: [rules.required("Referensi wajib dipilih")] },
      {
        field: "checkOutDate",
        rules: [
          rules.required(),
          rules.date(),
          rules.dateRange("checkInDate", "checkOutDate"),
        ],
      },
      { field: "generalRating", rules: [rules.required(), rules.oneOf(["1", "2", "3", "4", "5"])] },
    ],
    values
  );
}

// Login form validation
export function validateLoginForm(values: Record<string, unknown>): ValidationResult {
  return validateForm(
    [
      { field: "email", rules: [rules.required(), rules.email()] },
      { field: "password", rules: [rules.required()] },
    ],
    values
  );
}

// Gateway settings validation
export function validateGatewaySettings(values: Record<string, unknown>): ValidationResult {
  return validateForm(
    [
      {
        field: "managerPhoneNumbers",
        rules: [
          {
            test: (value: unknown) => {
              if (!value || typeof value !== "string") return true;
              const phones = value.split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
              return phones.every((p) => /^\d{10,15}$/.test(p.replace(/\D/g, "")));
            },
            message: "Format nomor manager tidak valid",
          },
        ],
      },
    ],
    values
  );
}

// Password change validation
export function validatePasswordChange(values: Record<string, unknown>): ValidationResult {
  return validateForm(
    [
      { field: "currentPassword", rules: [rules.required()] },
      { field: "newPassword", rules: [rules.required(), rules.minLength(8, "Password minimal 8 karakter")] },
      {
        field: "confirmPassword",
        rules: [
          rules.required(),
          {
            test: (value: unknown, allValues: Record<string, unknown>) =>
              value === allValues["newPassword"],
            message: "Konfirmasi password tidak cocok",
          },
        ],
      },
    ],
    values
  );
}

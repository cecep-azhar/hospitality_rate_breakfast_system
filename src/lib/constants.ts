// Constants used throughout the application

export const HOTEL_NAME = "Grand Sunshine Hotel";
export const HOTEL_SUBTITLE = "Hospitality Admin v2";

export const APP_VERSION = "2.0.0";
export const APP_ENV = process.env.NODE_ENV || "development";

export const SESSION_COOKIE_NAME = "gs_admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

export const DB_PATH = process.env.DATABASE_PATH || "./data/hospitality.db";
export const QR_PUBLIC_PATH = "generated-qr";

export const PASSWORD_MIN_LENGTH = 8;
export const PHONE_MIN_DIGITS = 10;

export const RATING_SCALES = ["Poor", "Good", "Excellent"] as const;
export const RATING_TYPES = ["Room", "Meeting", "Vendor"] as const;
export const ROOM_TYPES = ["Kamar", "Meeting Room"] as const;
export const VOUCHER_STATUSES = ["Generated", "Sent_WA", "Scanned", "Expired"] as const;
export const NOTIFICATION_TYPES = ["Voucher_Delivery", "Rating_ThankYou", "Manager_Alert"] as const;
export const USER_ROLES = ["Super Admin", "Resto Checker", "Manager"] as const;

export const VOUCHER_CODE_PREFIX = "GS";
export const VOUCHER_CODE_LENGTH = 8;

export const WA_GATEWAY_TIMEOUT_MS = 15000;
export const WA_GATEWAY_RETRY_COUNT = 3;
export const WA_GATEWAY_RETRY_DELAY_MS = 2000;

export const PAGINATION_DEFAULT_LIMIT = 50;
export const PAGINATION_MAX_LIMIT = 500;

export const ALLOWED_EXCEL_EXTENSIONS = [".xlsx", ".xls", ".csv"];

export const DATE_FORMAT = "YYYY-MM-DD";
export const DATETIME_FORMAT = "id-ID";

export const QR_CODE_WIDTH = 300;
export const QR_CODE_MARGIN = 1;
export const QR_CODE_COLOR_DARK = "#0a4f44";
export const QR_CODE_COLOR_LIGHT = "#ffffff";

export const SOURCE_AWARENESS_OPTIONS = ["Friend", "Ads", "Medsos", "Other"] as const;
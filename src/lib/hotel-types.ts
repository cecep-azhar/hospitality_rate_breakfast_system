export type RoomType = "Kamar" | "Meeting Room";

export type RatingType = "Room" | "Meeting" | "Vendor";

export type RatingScale = "Poor" | "Good" | "Excellent";

export type VoucherPaxType = "Adult" | "Child";

export type VoucherStatus = "Generated" | "Sent_WA" | "Scanned" | "Expired";

export type NotificationMessageType =
  | "Voucher_Delivery"
  | "Rating_ThankYou"
  | "Manager_Alert";

export type NotificationStatus = "Pending" | "Success" | "Failed";

export interface GatewaySettings {
  waEndpointVoucher: string;
  waTokenVoucher: string;
  waEndpointRating: string;
  waTokenRating: string;
  managerPhoneNumbers: string[];
  videoAdsUrl: string;
}

export interface DashboardSummary {
  totalRooms: number;
  totalVendors: number;
  inHouseGuests: number;
  vouchersToday: number;
  scannedToday: number;
  ratingsToday: number;
  avgRatingToday: number;
  failedNotifications: number;
}

export interface RoomRecord {
  id: number;
  room_number_name: string;
  type: RoomType;
  capacity: number;
  description: string | null;
  created_at: string;
}

export interface VendorRecord {
  id: number;
  vendor_name: string;
  company_name: string;
  contact_person: string;
  phone_number: string | null;
  created_at: string;
}

export interface TransactionRecord {
  id: number;
  guest_name: string;
  phone_number: string;
  email: string | null;
  room_id: number;
  room_name: string;
  room_type: RoomType;
  check_in_date: string;
  check_out_date: string;
  pax_adult: number;
  pax_child: number;
  source_booking: string | null;
  created_at: string;
}

export interface VoucherRecord {
  id: number;
  transaction_id: number;
  guest_name: string;
  voucher_code: string;
  valid_date: string;
  pax_type: VoucherPaxType;
  pax_index: number;
  qr_image_key: string;
  status: VoucherStatus;
  scanned_at: string | null;
  created_at: string;
}

export interface RatingRecord {
  id: number;
  rating_type: RatingType;
  reference_type: "Transaction" | "Vendor";
  reference_id: number;
  quality_of_service: RatingScale;
  facilities: RatingScale;
  food_quality: RatingScale;
  cleanliness: RatingScale;
  source_awareness: string;
  general_rating: number;
  comment: string | null;
  submitted_at: string;
  submitter_phone: string | null;
  reference_label: string;
}

export interface NotificationLogRecord {
  id: number;
  recipient_phone: string;
  message_type: NotificationMessageType;
  payload: string;
  status: NotificationStatus;
  sent_at: string;
}

export interface RatingTypeSummary {
  rating_type: RatingType;
  total: number;
  avg_rating: number;
}
// API Client - Abstraction layer for all API calls

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const { params, ...fetchOptions } = options;

    let url = `${this.baseUrl}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new ApiError(response.status, error.message || "Request failed", error);
    }

    return response.json();
  }

  // Health
  async getHealth() {
    return this.request<{
      status: string;
      timestamp: string;
      uptime: number;
      version: string;
    }>("/health");
  }

  // Rooms
  async getRooms(params?: { search?: string; type?: string; limit?: number; offset?: number }) {
    return this.request<{ data: unknown[]; total: number }>("/rooms", { params });
  }

  async createRoom(data: { roomNumberName: string; type: string; capacity: number; description?: string }) {
    return this.request<{ data: unknown }>("/rooms", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateRoom(id: number, data: { roomNumberName: string; type: string; capacity: number; description?: string }) {
    return this.request<{ data: unknown }>(`/rooms/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteRoom(id: number) {
    return this.request<{ success: boolean }>(`/rooms/${id}`, {
      method: "DELETE",
    });
  }

  // Vendors
  async getVendors(params?: { search?: string; limit?: number; offset?: number }) {
    return this.request<{ data: unknown[]; total: number }>("/vendors", { params });
  }

  async createVendor(data: { vendorName: string; companyName?: string; contactPerson?: string; phoneNumber?: string }) {
    return this.request<{ data: unknown }>("/vendors", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateVendor(id: number, data: { vendorName: string; companyName?: string; contactPerson?: string; phoneNumber?: string }) {
    return this.request<{ data: unknown }>(`/vendors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteVendor(id: number) {
    return this.request<{ success: boolean }>(`/vendors/${id}`, {
      method: "DELETE",
    });
  }

  // Transactions
  async getTransactions(params?: {
    search?: string;
    roomId?: number;
    checkInDate?: string;
    checkOutDate?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.request<{ data: unknown[]; total: number }>("/transactions", { params });
  }

  async createTransaction(data: {
    guestName: string;
    phoneNumber: string;
    email?: string;
    roomId: number;
    checkInDate: string;
    checkOutDate: string;
    paxAdult: number;
    paxChild: number;
    sourceBooking?: string;
  }) {
    return this.request<{ data: unknown }>("/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async importTransactions(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${this.baseUrl}/transactions/import`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Import failed");
    }

    return response.json();
  }

  // Vouchers
  async getVouchers(params?: { search?: string; status?: string; validDate?: string; limit?: number; offset?: number }) {
    return this.request<{ data: unknown[]; total: number }>("/vouchers", { params });
  }

  async generateVouchers(validDate: string) {
    return this.request<{ generatedCount: number; transactionCount: number }>("/vouchers/generate", {
      method: "POST",
      body: JSON.stringify({ validDate }),
    });
  }

  async sendVoucherManual(transactionId: number, validDate?: string) {
    return this.request<{ ok: boolean; sentCount: number }>("/vouchers/send", {
      method: "POST",
      body: JSON.stringify({ transactionId, validDate }),
    });
  }

  // Ratings
  async getRatings(params?: {
    ratingType?: string;
    minRating?: number;
    maxRating?: number;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.request<{ data: unknown[]; total: number }>("/ratings", { params });
  }

  async submitRating(data: {
    ratingType: string;
    referenceId: number;
    qualityOfService: string;
    facilities: string;
    foodQuality: string;
    cleanliness: string;
    sourceAwareness: string;
    generalRating: number;
    comment?: string;
  }) {
    return this.request<{ id: number }>("/ratings", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Dashboard
  async getDashboardSummary() {
    return this.request<{
      totalRooms: number;
      totalVendors: number;
      inHouseGuests: number;
      vouchersToday: number;
      scannedToday: number;
      ratingsToday: number;
      avgRatingToday: number;
      failedNotifications: number;
    }>("/dashboard/summary");
  }

  // Export
  async exportData(type: "rooms" | "vendors" | "transactions" | "vouchers" | "ratings", format: "csv" | "xlsx") {
    const response = await fetch(`${this.baseUrl}/export/${type}?format=${format}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Export failed");
    }

    return response.blob();
  }

  // Gateway Settings
  async getGatewaySettings() {
    return this.request<{
      waEndpointVoucher: string;
      waTokenVoucher: string;
      waEndpointRating: string;
      waTokenRating: string;
      managerPhoneNumbers: string[];
      videoAdsUrl: string;
    }>("/gateway/settings");
  }

  async saveGatewaySettings(data: {
    waEndpointVoucher: string;
    waTokenVoucher: string;
    waEndpointRating: string;
    waTokenRating: string;
    managerPhoneNumbers: string[];
    videoAdsUrl: string;
  }) {
    return this.request<{ success: boolean }>("/gateway/settings", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Singleton instance
export const api = new ApiClient(BASE_URL);

// Hooks for React
export function createApiHooks() {
  return {
    useHealth() {
      return useQuery(["health"], () => api.getHealth());
    },
    useRooms(params?: Parameters<typeof api.getRooms>[0]) {
      return useQuery(["rooms", params], () => api.getRooms(params));
    },
    useVendors(params?: Parameters<typeof api.getVendors>[0]) {
      return useQuery(["vendors", params], () => api.getVendors(params));
    },
    useTransactions(params?: Parameters<typeof api.getTransactions>[0]) {
      return useQuery(["transactions", params], () => api.getTransactions(params));
    },
    useDashboard() {
      return useQuery(["dashboard"], () => api.getDashboardSummary());
    },
  };
}

// Simple query helper (can be replaced with React Query or SWR)
function useQuery<T>(key: unknown[], fetcher: () => Promise<T>) {
  // This is a placeholder - in real app, use React Query or SWR
  return { data: undefined as T | undefined, isLoading: true, error: null };
}
// Simple in-memory cache with TTL support

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private defaultTTL = 60 * 1000) {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Singleton instance for application-wide caching
export const appCache = new MemoryCache();

// Cache keys generator
export const cacheKeys = {
  adminSnapshot: (date?: string) => `admin:snapshot:${date ?? "default"}`,
  rooms: (search?: string) => `rooms:list:${search ?? "all"}`,
  vendors: (search?: string) => `vendors:list:${search ?? "all"}`,
  transactions: (date?: string) => `transactions:list:${date ?? "all"}`,
  vouchers: (date?: string) => `vouchers:list:${date ?? "all"}`,
  ratings: (date?: string) => `ratings:list:${date ?? "all"}`,
  gatewaySettings: () => "gateway:settings",
  dashboardSummary: (date?: string) => `dashboard:summary:${date ?? "today"}`,
};

// Helper functions for caching
export function getCached<T>(key: string): T | null {
  return appCache.get<T>(key);
}

export function setCached<T>(key: string, value: T, ttlSeconds?: number): void {
  appCache.set(key, value, ttlSeconds ? ttlSeconds * 1000 : undefined);
}

export function invalidateCache(patterns?: string[]): void {
  if (!patterns) {
    appCache.clear();
    return;
  }

  // Note: This only clears exact matches. For pattern-based invalidation,
  // you'd need to modify the cache implementation.
  for (const pattern of patterns) {
    appCache.delete(pattern);
  }
}

// Cached data fetch helper
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 60
): Promise<T> {
  const cached = appCache.get<T>(key);

  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  appCache.set(key, data, ttlSeconds * 1000);

  return data;
}

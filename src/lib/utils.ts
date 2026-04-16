import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncate(text: string, maxLength = 15): string {
  if (typeof text !== "string") return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

const CACHE_PREFIX = 'burhanacademy_cache_';
const DEFAULT_TTL = 5 * 60 * 1000;

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export function setLocalCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  try {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  } catch (e) {
    console.warn('Local cache write failed:', e);
  }
}

export function getLocalCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    
    const item: CacheItem<T> = JSON.parse(raw);
    const now = Date.now();
    
    if (now - item.timestamp > item.ttl) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    
    return item.data;
  } catch (e) {
    console.warn('Local cache read failed:', e);
    return null;
  }
}

export function clearLocalCache(key?: string): void {
  if (key) {
    localStorage.removeItem(CACHE_PREFIX + key);
  } else {
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }
}

export function isFirebaseQuotaExceeded(error: any): boolean {
  if (!error) return false;
  const errorCode = error?.code || error?.message || '';
  return (
    errorCode.includes('resource-exhausted') ||
    errorCode.includes('quota-exceeded') ||
    errorCode.includes('TOO_MANY_REQUESTS') ||
    errorCode.includes('UNAVAILABLE') ||
    (error?.status === 429) ||
    (error?.message && error.message.includes('Quota exceeded'))
  );
}

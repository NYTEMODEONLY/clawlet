/**
 * Trust Cache Utility
 *
 * Caches ERC-8004 trust check results to reduce RPC calls
 * and improve performance for repeated agent interactions.
 */

import type { Address } from 'viem';
import type { TrustCheckResult } from '../types/index.js';

interface CacheEntry {
  result: TrustCheckResult;
  timestamp: number;
  expiresAt: number;
}

export interface TrustCacheConfig {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  ttlMs?: number;
  /** Maximum cache entries (default: 1000) */
  maxEntries?: number;
  /** Enable persistent storage (default: false) */
  persistent?: boolean;
}

export class TrustCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttlMs: number;
  private maxEntries: number;

  constructor(config?: TrustCacheConfig) {
    this.ttlMs = config?.ttlMs ?? 5 * 60 * 1000; // 5 minutes default
    this.maxEntries = config?.maxEntries ?? 1000;
  }

  /**
   * Get cached trust result
   */
  get(address: Address): TrustCheckResult | null {
    const key = address.toLowerCase();
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * Cache a trust result
   */
  set(address: Address, result: TrustCheckResult): void {
    const key = address.toLowerCase();
    const now = Date.now();

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    this.cache.set(key, {
      result,
      timestamp: now,
      expiresAt: now + this.ttlMs,
    });
  }

  /**
   * Invalidate cache for an address
   */
  invalidate(address: Address): void {
    this.cache.delete(address.toLowerCase());
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  stats(): { size: number; maxEntries: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
    };
  }

  /**
   * Evict expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Evict oldest entries to make room
   */
  private evictOldest(): void {
    // Find oldest entry
    let oldest: { key: string; timestamp: number } | null = null;

    for (const [key, entry] of this.cache) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = { key, timestamp: entry.timestamp };
      }
    }

    if (oldest) {
      this.cache.delete(oldest.key);
    }
  }
}

/**
 * Trust list utilities for managing persistent allow/block lists
 */
export interface TrustListEntry {
  address: Address;
  trusted: boolean;
  addedAt: Date;
  reason?: string;
  addedBy?: string;
}

export class TrustList {
  private list: Map<string, TrustListEntry> = new Map();

  /**
   * Add address to trusted list
   */
  trust(address: Address, reason?: string, addedBy?: string): void {
    this.list.set(address.toLowerCase(), {
      address,
      trusted: true,
      addedAt: new Date(),
      reason,
      addedBy,
    });
  }

  /**
   * Add address to blocked list
   */
  block(address: Address, reason?: string, addedBy?: string): void {
    this.list.set(address.toLowerCase(), {
      address,
      trusted: false,
      addedAt: new Date(),
      reason,
      addedBy,
    });
  }

  /**
   * Remove address from list
   */
  remove(address: Address): boolean {
    return this.list.delete(address.toLowerCase());
  }

  /**
   * Check if address is trusted
   */
  isTrusted(address: Address): boolean | null {
    const entry = this.list.get(address.toLowerCase());
    return entry?.trusted ?? null;
  }

  /**
   * Check if address is blocked
   */
  isBlocked(address: Address): boolean {
    const entry = this.list.get(address.toLowerCase());
    return entry?.trusted === false;
  }

  /**
   * Get all trusted addresses
   */
  getTrusted(): TrustListEntry[] {
    return Array.from(this.list.values()).filter((e) => e.trusted);
  }

  /**
   * Get all blocked addresses
   */
  getBlocked(): TrustListEntry[] {
    return Array.from(this.list.values()).filter((e) => !e.trusted);
  }

  /**
   * Get entry for address
   */
  get(address: Address): TrustListEntry | null {
    return this.list.get(address.toLowerCase()) ?? null;
  }

  /**
   * Export list as JSON
   */
  toJSON(): TrustListEntry[] {
    return Array.from(this.list.values());
  }

  /**
   * Import list from JSON
   */
  fromJSON(entries: TrustListEntry[]): void {
    this.list.clear();
    for (const entry of entries) {
      this.list.set(entry.address.toLowerCase(), {
        ...entry,
        addedAt: new Date(entry.addedAt),
      });
    }
  }

  /**
   * Get list size
   */
  size(): number {
    return this.list.size;
  }

  /**
   * Clear list
   */
  clear(): void {
    this.list.clear();
  }
}

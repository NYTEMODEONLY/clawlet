import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TrustCache, TrustList } from '../src/utils/trust-cache.js';
import type { TrustCheckResult } from '../src/types/index.js';
import type { Address } from 'viem';

describe('TrustCache', () => {
  let cache: TrustCache;

  beforeEach(() => {
    cache = new TrustCache({ ttlMs: 1000, maxEntries: 10 });
  });

  const mockTrustResult: TrustCheckResult = {
    address: '0x1234567890abcdef1234567890abcdef12345678' as Address,
    isTrusted: true,
    reasons: ['Whitelisted'],
  };

  it('should store and retrieve trust results', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678' as Address;

    cache.set(address, mockTrustResult);
    const result = cache.get(address);

    expect(result).toEqual(mockTrustResult);
  });

  it('should return null for non-existent entries', () => {
    const address = '0xabcdef1234567890abcdef1234567890abcdef12' as Address;
    expect(cache.get(address)).toBeNull();
  });

  it('should be case-insensitive', () => {
    const addressLower = '0x1234567890abcdef1234567890abcdef12345678' as Address;
    const addressUpper = '0x1234567890ABCDEF1234567890ABCDEF12345678' as Address;

    cache.set(addressLower, mockTrustResult);
    const result = cache.get(addressUpper);

    expect(result).toEqual(mockTrustResult);
  });

  it('should expire entries after TTL', async () => {
    vi.useFakeTimers();

    const address = '0x1234567890abcdef1234567890abcdef12345678' as Address;
    cache.set(address, mockTrustResult);

    // Before TTL
    expect(cache.get(address)).toEqual(mockTrustResult);

    // After TTL
    vi.advanceTimersByTime(1500);
    expect(cache.get(address)).toBeNull();

    vi.useRealTimers();
  });

  it('should invalidate specific entries', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678' as Address;

    cache.set(address, mockTrustResult);
    expect(cache.get(address)).not.toBeNull();

    cache.invalidate(address);
    expect(cache.get(address)).toBeNull();
  });

  it('should clear all entries', () => {
    const addr1 = '0x1234567890abcdef1234567890abcdef12345678' as Address;
    const addr2 = '0xabcdef1234567890abcdef1234567890abcdef12' as Address;

    cache.set(addr1, mockTrustResult);
    cache.set(addr2, { ...mockTrustResult, address: addr2 });

    expect(cache.stats().size).toBe(2);

    cache.clear();
    expect(cache.stats().size).toBe(0);
  });

  it('should evict oldest when at capacity', () => {
    const smallCache = new TrustCache({ maxEntries: 2 });

    const addr1 = '0x1111111111111111111111111111111111111111' as Address;
    const addr2 = '0x2222222222222222222222222222222222222222' as Address;
    const addr3 = '0x3333333333333333333333333333333333333333' as Address;

    smallCache.set(addr1, { ...mockTrustResult, address: addr1 });
    smallCache.set(addr2, { ...mockTrustResult, address: addr2 });
    smallCache.set(addr3, { ...mockTrustResult, address: addr3 });

    // First entry should be evicted
    expect(smallCache.get(addr1)).toBeNull();
    expect(smallCache.get(addr2)).not.toBeNull();
    expect(smallCache.get(addr3)).not.toBeNull();
  });

  it('should cleanup expired entries', async () => {
    vi.useFakeTimers();

    const addr1 = '0x1111111111111111111111111111111111111111' as Address;
    const addr2 = '0x2222222222222222222222222222222222222222' as Address;

    cache.set(addr1, { ...mockTrustResult, address: addr1 });
    vi.advanceTimersByTime(500);
    cache.set(addr2, { ...mockTrustResult, address: addr2 });

    // Advance past first entry's TTL
    vi.advanceTimersByTime(600);

    const evicted = cache.cleanup();
    expect(evicted).toBe(1);
    expect(cache.get(addr1)).toBeNull();
    expect(cache.get(addr2)).not.toBeNull();

    vi.useRealTimers();
  });
});

describe('TrustList', () => {
  let list: TrustList;

  beforeEach(() => {
    list = new TrustList();
  });

  const testAddress = '0x1234567890abcdef1234567890abcdef12345678' as Address;

  it('should add trusted addresses', () => {
    list.trust(testAddress, 'Known agent');

    expect(list.isTrusted(testAddress)).toBe(true);
    expect(list.isBlocked(testAddress)).toBe(false);
  });

  it('should add blocked addresses', () => {
    list.block(testAddress, 'Spam agent');

    expect(list.isTrusted(testAddress)).toBe(false);
    expect(list.isBlocked(testAddress)).toBe(true);
  });

  it('should remove addresses', () => {
    list.trust(testAddress);
    expect(list.isTrusted(testAddress)).toBe(true);

    const removed = list.remove(testAddress);
    expect(removed).toBe(true);
    expect(list.isTrusted(testAddress)).toBeNull();
  });

  it('should get entry details', () => {
    list.trust(testAddress, 'Verified partner', 'admin');

    const entry = list.get(testAddress);
    expect(entry).not.toBeNull();
    expect(entry!.trusted).toBe(true);
    expect(entry!.reason).toBe('Verified partner');
    expect(entry!.addedBy).toBe('admin');
    expect(entry!.addedAt).toBeInstanceOf(Date);
  });

  it('should list all trusted addresses', () => {
    const addr1 = '0x1111111111111111111111111111111111111111' as Address;
    const addr2 = '0x2222222222222222222222222222222222222222' as Address;
    const addr3 = '0x3333333333333333333333333333333333333333' as Address;

    list.trust(addr1);
    list.trust(addr2);
    list.block(addr3);

    const trusted = list.getTrusted();
    expect(trusted.length).toBe(2);
    expect(trusted.some((e) => e.address === addr1)).toBe(true);
    expect(trusted.some((e) => e.address === addr2)).toBe(true);
  });

  it('should list all blocked addresses', () => {
    const addr1 = '0x1111111111111111111111111111111111111111' as Address;
    const addr2 = '0x2222222222222222222222222222222222222222' as Address;

    list.trust(addr1);
    list.block(addr2);

    const blocked = list.getBlocked();
    expect(blocked.length).toBe(1);
    expect(blocked[0]!.address).toBe(addr2);
  });

  it('should export and import JSON', () => {
    const addr1 = '0x1111111111111111111111111111111111111111' as Address;
    const addr2 = '0x2222222222222222222222222222222222222222' as Address;

    list.trust(addr1, 'Reason 1');
    list.block(addr2, 'Reason 2');

    const json = list.toJSON();
    expect(json.length).toBe(2);

    const newList = new TrustList();
    newList.fromJSON(json);

    expect(newList.isTrusted(addr1)).toBe(true);
    expect(newList.isBlocked(addr2)).toBe(true);
    expect(newList.get(addr1)!.reason).toBe('Reason 1');
  });

  it('should be case-insensitive', () => {
    const addressLower = '0x1234567890abcdef1234567890abcdef12345678' as Address;
    const addressUpper = '0x1234567890ABCDEF1234567890ABCDEF12345678' as Address;

    list.trust(addressLower);
    expect(list.isTrusted(addressUpper)).toBe(true);
  });
});

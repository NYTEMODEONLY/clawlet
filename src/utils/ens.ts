/**
 * ENS (Ethereum Name Service) Utilities
 *
 * Provides human-readable name resolution for agent addresses.
 * Allows agents to use names like "codebot.eth" instead of raw addresses.
 */

import type { PublicClient, Address, Chain, Transport } from 'viem';
import { normalize } from 'viem/ens';

export interface ENSResolverConfig {
  client: PublicClient<Transport, Chain>;
  cacheTimeMs?: number;
}

export interface ENSRecord {
  address: Address | null;
  name: string;
  resolvedAt: Date;
  expiresAt: Date;
}

/**
 * ENS Resolver with caching
 */
export class ENSResolver {
  private client: PublicClient<Transport, Chain>;
  private cache: Map<string, ENSRecord> = new Map();
  private reverseCache: Map<string, string> = new Map();
  private cacheTimeMs: number;

  constructor(config: ENSResolverConfig) {
    this.client = config.client;
    this.cacheTimeMs = config.cacheTimeMs ?? 3600000; // 1 hour default
  }

  /**
   * Resolve ENS name to address
   */
  async resolve(name: string): Promise<Address | null> {
    const normalizedName = normalize(name);
    const cacheKey = normalizedName.toLowerCase();

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      return cached.address;
    }

    try {
      const address = await this.client.getEnsAddress({
        name: normalizedName,
      });

      const now = new Date();
      this.cache.set(cacheKey, {
        address,
        name: normalizedName,
        resolvedAt: now,
        expiresAt: new Date(now.getTime() + this.cacheTimeMs),
      });

      if (address) {
        this.reverseCache.set(address.toLowerCase(), normalizedName);
      }

      return address;
    } catch (error) {
      console.error(`Failed to resolve ENS name ${name}:`, error);
      return null;
    }
  }

  /**
   * Reverse resolve address to ENS name
   */
  async reverseLookup(address: Address): Promise<string | null> {
    const addressKey = address.toLowerCase();

    // Check reverse cache
    const cached = this.reverseCache.get(addressKey);
    if (cached) {
      return cached;
    }

    try {
      const name = await this.client.getEnsName({
        address,
      });

      if (name) {
        this.reverseCache.set(addressKey, name);
        this.cache.set(name.toLowerCase(), {
          address,
          name,
          resolvedAt: new Date(),
          expiresAt: new Date(Date.now() + this.cacheTimeMs),
        });
      }

      return name;
    } catch (error) {
      console.error(`Failed to reverse lookup ${address}:`, error);
      return null;
    }
  }

  /**
   * Get ENS avatar URL
   */
  async getAvatar(nameOrAddress: string): Promise<string | null> {
    try {
      // If it's an address, reverse lookup first
      let name = nameOrAddress;
      if (nameOrAddress.startsWith('0x')) {
        const resolved = await this.reverseLookup(nameOrAddress as Address);
        if (!resolved) return null;
        name = resolved;
      }

      const avatar = await this.client.getEnsAvatar({
        name: normalize(name),
      });

      return avatar;
    } catch (error) {
      console.error(`Failed to get avatar for ${nameOrAddress}:`, error);
      return null;
    }
  }

  /**
   * Get ENS text record
   */
  async getText(name: string, key: string): Promise<string | null> {
    try {
      const record = await this.client.getEnsText({
        name: normalize(name),
        key,
      });

      return record;
    } catch (error) {
      console.error(`Failed to get text record ${key} for ${name}:`, error);
      return null;
    }
  }

  /**
   * Check if a string is a valid ENS name
   */
  isENSName(value: string): boolean {
    if (value.startsWith('0x')) return false;
    return value.includes('.') && !value.includes('/');
  }

  /**
   * Resolve name or pass through address
   */
  async resolveNameOrAddress(value: string): Promise<Address | null> {
    if (value.startsWith('0x') && value.length === 42) {
      return value as Address;
    }

    return this.resolve(value);
  }

  /**
   * Get a display name for an address (ENS name or truncated address)
   */
  async getDisplayName(address: Address): Promise<string> {
    const ensName = await this.reverseLookup(address);
    if (ensName) return ensName;

    // Truncate address
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.reverseCache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { names: number; addresses: number } {
    return {
      names: this.cache.size,
      addresses: this.reverseCache.size,
    };
  }
}

/**
 * Common ENS text record keys for agent metadata
 */
export const ENS_AGENT_KEYS = {
  /** Agent description */
  DESCRIPTION: 'description',
  /** Agent type (e.g., 'code-review', 'translation') */
  AGENT_TYPE: 'com.clawlet.agentType',
  /** Agent capabilities as JSON array */
  CAPABILITIES: 'com.clawlet.capabilities',
  /** Agent pricing as JSON object */
  PRICING: 'com.clawlet.pricing',
  /** Agent API endpoint */
  API_URL: 'com.clawlet.api',
  /** Agent version */
  VERSION: 'com.clawlet.version',
  /** Agent operator/owner */
  OPERATOR: 'com.clawlet.operator',
  /** Public key for secure messaging */
  PUBLIC_KEY: 'com.clawlet.publicKey',
} as const;

/**
 * Parse agent metadata from ENS text records
 */
export async function getAgentMetadata(
  resolver: ENSResolver,
  name: string
): Promise<{
  description?: string;
  agentType?: string;
  capabilities?: string[];
  pricing?: Record<string, string>;
  apiUrl?: string;
  version?: string;
  operator?: string;
}> {
  const [description, agentType, capabilitiesJson, pricingJson, apiUrl, version, operator] =
    await Promise.all([
      resolver.getText(name, ENS_AGENT_KEYS.DESCRIPTION),
      resolver.getText(name, ENS_AGENT_KEYS.AGENT_TYPE),
      resolver.getText(name, ENS_AGENT_KEYS.CAPABILITIES),
      resolver.getText(name, ENS_AGENT_KEYS.PRICING),
      resolver.getText(name, ENS_AGENT_KEYS.API_URL),
      resolver.getText(name, ENS_AGENT_KEYS.VERSION),
      resolver.getText(name, ENS_AGENT_KEYS.OPERATOR),
    ]);

  let capabilities: string[] | undefined;
  let pricing: Record<string, string> | undefined;

  try {
    if (capabilitiesJson) {
      capabilities = JSON.parse(capabilitiesJson);
    }
  } catch {
    // Invalid JSON
  }

  try {
    if (pricingJson) {
      pricing = JSON.parse(pricingJson);
    }
  } catch {
    // Invalid JSON
  }

  return {
    description: description ?? undefined,
    agentType: agentType ?? undefined,
    capabilities,
    pricing,
    apiUrl: apiUrl ?? undefined,
    version: version ?? undefined,
    operator: operator ?? undefined,
  };
}

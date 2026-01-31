import type { PublicClient, Address, Chain, Transport } from 'viem';

import type {
  AgentIdentity,
  AgentReputation,
  AgentValidation,
  TrustCheckResult,
  ClawletConfig,
} from '../types/index.js';
import {
  ERC8004_ADDRESSES,
  IDENTITY_REGISTRY_ABI,
  REPUTATION_REGISTRY_ABI,
  VALIDATION_REGISTRY_ABI,
} from '../constants/erc8004.js';

export class TrustSystem {
  private publicClient: PublicClient<Transport, Chain>;
  private chainId: string;
  private config: ClawletConfig['trustSettings'];
  private whitelist: Set<string> = new Set();

  constructor(
    publicClient: PublicClient<Transport, Chain>,
    config?: ClawletConfig['trustSettings']
  ) {
    this.publicClient = publicClient;
    this.chainId = String(publicClient.chain?.id ?? 1);
    this.config = config ?? {
      requireIdentity: true,
      minReputationScore: 50,
      requireValidation: false,
      skipTrustCheckForWhitelisted: true,
    };
  }

  /**
   * Get ERC-8004 registry addresses for current chain
   */
  private getRegistryAddresses(): {
    identityRegistry: Address;
    reputationRegistry: Address;
    validationRegistry: Address;
  } {
    const addresses = ERC8004_ADDRESSES[this.chainId];
    if (!addresses) {
      throw new Error(`ERC-8004 registries not configured for chain ${this.chainId}`);
    }
    return addresses;
  }

  /**
   * Check if registries are deployed (not zero address)
   */
  private areRegistriesDeployed(): boolean {
    const addresses = this.getRegistryAddresses();
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    return (
      addresses.identityRegistry !== zeroAddress &&
      addresses.reputationRegistry !== zeroAddress &&
      addresses.validationRegistry !== zeroAddress
    );
  }

  /**
   * Add address to whitelist (skip trust checks)
   */
  addToWhitelist(address: Address): void {
    this.whitelist.add(address.toLowerCase());
  }

  /**
   * Remove address from whitelist
   */
  removeFromWhitelist(address: Address): void {
    this.whitelist.delete(address.toLowerCase());
  }

  /**
   * Check if address is whitelisted
   */
  isWhitelisted(address: Address): boolean {
    return this.whitelist.has(address.toLowerCase());
  }

  /**
   * Get agent identity from Identity Registry
   */
  async getAgentIdentity(address: Address): Promise<AgentIdentity> {
    const addresses = this.getRegistryAddresses();

    // If registries not deployed, return mock data
    if (!this.areRegistriesDeployed()) {
      return {
        address,
        tokenId: 0n,
        exists: false,
        metadata: undefined,
      };
    }

    try {
      const result = await this.publicClient.readContract({
        address: addresses.identityRegistry,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'getAgentByAddress',
        args: [address],
      });

      const [tokenId, exists] = result as [bigint, boolean];

      if (!exists) {
        return {
          address,
          tokenId: 0n,
          exists: false,
        };
      }

      // Try to fetch metadata
      let metadata: AgentIdentity['metadata'];
      try {
        const tokenURI = await this.publicClient.readContract({
          address: addresses.identityRegistry,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: 'tokenURI',
          args: [tokenId],
        });

        // If tokenURI is a data URI or HTTP URL, we could fetch it
        // For now, just store the URI reference
        metadata = { description: tokenURI as string };
      } catch {
        // Metadata fetch failed, continue without it
      }

      return {
        address,
        tokenId,
        exists: true,
        metadata,
      };
    } catch (error) {
      // Contract call failed - registries may not be deployed
      console.warn('Failed to fetch agent identity:', error);
      return {
        address,
        tokenId: 0n,
        exists: false,
      };
    }
  }

  /**
   * Get agent reputation from Reputation Registry
   */
  async getAgentReputation(address: Address): Promise<AgentReputation> {
    const addresses = this.getRegistryAddresses();

    // If registries not deployed, return default reputation
    if (!this.areRegistriesDeployed()) {
      return {
        address,
        score: 0,
        totalInteractions: 0,
        positiveInteractions: 0,
        negativeInteractions: 0,
        lastUpdated: new Date(0),
      };
    }

    try {
      const result = await this.publicClient.readContract({
        address: addresses.reputationRegistry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'getReputation',
        args: [address],
      });

      const [score, totalInteractions, positiveInteractions, negativeInteractions, lastUpdated] =
        result as [bigint, bigint, bigint, bigint, bigint];

      return {
        address,
        score: Number(score),
        totalInteractions: Number(totalInteractions),
        positiveInteractions: Number(positiveInteractions),
        negativeInteractions: Number(negativeInteractions),
        lastUpdated: new Date(Number(lastUpdated) * 1000),
      };
    } catch (error) {
      console.warn('Failed to fetch agent reputation:', error);
      return {
        address,
        score: 0,
        totalInteractions: 0,
        positiveInteractions: 0,
        negativeInteractions: 0,
        lastUpdated: new Date(0),
      };
    }
  }

  /**
   * Get agent validations from Validation Registry
   */
  async getAgentValidations(address: Address): Promise<AgentValidation[]> {
    const addresses = this.getRegistryAddresses();

    // If registries not deployed, return empty array
    if (!this.areRegistriesDeployed()) {
      return [];
    }

    try {
      const result = await this.publicClient.readContract({
        address: addresses.validationRegistry,
        abi: VALIDATION_REGISTRY_ABI,
        functionName: 'getValidations',
        args: [address],
      });

      const validations = result as Array<{
        validationType: string;
        validator: Address;
        isValid: boolean;
        timestamp: bigint;
        metadata: string;
      }>;

      return validations.map((v) => ({
        address,
        validationType: v.validationType,
        validator: v.validator,
        isValid: v.isValid,
        timestamp: new Date(Number(v.timestamp) * 1000),
        metadata: v.metadata ? JSON.parse(v.metadata) : undefined,
      }));
    } catch (error) {
      console.warn('Failed to fetch agent validations:', error);
      return [];
    }
  }

  /**
   * Perform comprehensive trust check on an agent
   */
  async checkTrust(address: Address): Promise<TrustCheckResult> {
    const reasons: string[] = [];

    // Skip check for whitelisted addresses
    if (this.config?.skipTrustCheckForWhitelisted && this.isWhitelisted(address)) {
      return {
        address,
        isTrusted: true,
        reasons: ['Address is whitelisted'],
      };
    }

    // If registries not deployed, trust by default (development mode)
    if (!this.areRegistriesDeployed()) {
      return {
        address,
        isTrusted: true,
        reasons: ['ERC-8004 registries not deployed - trusting by default'],
      };
    }

    // Fetch all trust data in parallel
    const [identity, reputation, validations] = await Promise.all([
      this.getAgentIdentity(address),
      this.getAgentReputation(address),
      this.getAgentValidations(address),
    ]);

    let isTrusted = true;

    // Check identity requirement
    if (this.config?.requireIdentity && !identity.exists) {
      isTrusted = false;
      reasons.push('Agent does not have a registered identity');
    } else if (identity.exists) {
      reasons.push(`Agent has identity NFT (tokenId: ${identity.tokenId})`);
    }

    // Check reputation requirement
    const minScore = this.config?.minReputationScore ?? 50;
    if (reputation.score < minScore) {
      isTrusted = false;
      reasons.push(`Reputation score (${reputation.score}) below minimum (${minScore})`);
    } else {
      reasons.push(`Reputation score: ${reputation.score}/100`);
    }

    // Check validation requirement
    if (this.config?.requireValidation) {
      const hasValidValidation = validations.some((v) => v.isValid);
      if (!hasValidValidation) {
        isTrusted = false;
        reasons.push('Agent has no valid validations');
      } else {
        const validTypes = validations
          .filter((v) => v.isValid)
          .map((v) => v.validationType)
          .join(', ');
        reasons.push(`Valid validations: ${validTypes}`);
      }
    }

    return {
      address,
      isTrusted,
      identity,
      reputation,
      validations,
      reasons,
    };
  }

  /**
   * Quick trust check (returns boolean only)
   */
  async isTrusted(address: Address): Promise<boolean> {
    const result = await this.checkTrust(address);
    return result.isTrusted;
  }

  /**
   * Update trust settings
   */
  updateSettings(settings: Partial<ClawletConfig['trustSettings']>): void {
    this.config = { ...this.config, ...settings };
  }

  /**
   * Get current trust settings
   */
  getSettings(): ClawletConfig['trustSettings'] {
    return { ...this.config };
  }
}

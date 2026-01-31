/**
 * ClawletVault Contract Addresses
 * Updated after each deployment
 */

import type { Address } from 'viem';
import type { Network } from '../types/index.js';

export type VaultAddresses = {
  [key in Network]?: Address;
};

/**
 * Deployed ClawletVault contract addresses per network
 * Update these after deployment
 */
export const CLAWLET_VAULT_ADDRESSES: VaultAddresses = {
  // Mainnet - Not deployed yet
  mainnet: undefined,

  // Testnets - Not deployed yet
  sepolia: undefined,

  // L2s - Not deployed yet
  base: undefined,
  optimism: undefined,
  arbitrum: undefined,
};

/**
 * Get ClawletVault contract address for a network
 * @throws Error if not deployed on the network
 */
export function getVaultAddress(network: Network): Address {
  const address = CLAWLET_VAULT_ADDRESSES[network];
  if (!address) {
    throw new Error(`ClawletVault not deployed on ${network}`);
  }
  return address;
}

/**
 * Check if ClawletVault is deployed on a network
 */
export function isVaultDeployed(network: Network): boolean {
  return CLAWLET_VAULT_ADDRESSES[network] !== undefined;
}

/**
 * Get all networks where ClawletVault is deployed
 */
export function getDeployedNetworks(): Network[] {
  return Object.entries(CLAWLET_VAULT_ADDRESSES)
    .filter(([_, address]) => address !== undefined)
    .map(([network]) => network as Network);
}

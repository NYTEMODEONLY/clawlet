/**
 * ClawletVault SDK
 *
 * On-chain security layer for AI agent wallets.
 *
 * @example
 * ```ts
 * import { ClawletVaultSDK } from 'clawlet/vault';
 *
 * // Owner creates vault
 * const sdk = new ClawletVaultSDK({ network: 'base' }, ownerWalletClient);
 * const { vaultId } = await sdk.createVault({
 *   agentAddress: '0xAgent...',
 *   dailyLimitEth: '0.5',
 *   perTxLimitEth: '0.1',
 *   initialFundingEth: '2.0',
 * });
 *
 * // Owner killswitch
 * await sdk.pause(vaultId);
 * await sdk.emergencyDrain(vaultId);
 * ```
 */

export { ClawletVaultSDK } from './ClawletVaultSDK.js';
export { CLAWLET_VAULT_ABI } from './abi.js';
export {
  CLAWLET_VAULT_ADDRESSES,
  getVaultAddress,
  isVaultDeployed,
  getDeployedNetworks,
} from './addresses.js';
export type {
  Vault,
  VaultSummary,
  CreateVaultParams,
  CreateVaultResult,
  AgentSendParams,
  AgentSendTokenParams,
  VaultTxResult,
  EmergencyDrainResult,
  ClawletVaultSDKConfig,
  VaultEventType,
  VaultEvent,
  AgentSentEvent,
  DepositedEvent,
} from './types.js';

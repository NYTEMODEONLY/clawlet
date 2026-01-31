/**
 * Clawlet - AI-native Ethereum wallet for autonomous agents
 *
 * @packageDocumentation
 *
 * @example
 * ```ts
 * import { Clawlet, parseEther } from 'clawlet';
 *
 * // Create wallet from private key
 * const wallet = new Clawlet({
 *   privateKey: process.env.CLAWLET_KEY,
 *   network: 'base',
 * });
 *
 * // Check if agent is trusted before paying
 * const isTrusted = await wallet.isAgentTrusted('0xAgentAddress');
 * if (isTrusted) {
 *   await wallet.payAgent('0xAgentAddress', '0.01', 'Task completion tip');
 * }
 *
 * // Watch for incoming payments
 * wallet.watchIncomingPayments((from, amount, hash) => {
 *   console.log(`Received ${amount} from ${from}`);
 * });
 * ```
 */

// Main Clawlet class
export { Clawlet, parseEther, formatEther } from './core/clawlet.js';

// Core wallet functionality
export { ClawletWallet } from './core/wallet.js';

// Trust system
export { TrustSystem } from './core/trust.js';

// Types
export type {
  Network,
  NetworkConfig,
  ClawletConfig,
  TransactionRequest,
  TransactionResult,
  PaymentRequest,
  TokenBalance,
  TokenTransferRequest,
  AgentIdentity,
  AgentReputation,
  AgentValidation,
  TrustCheckResult,
  ClawletEvent,
  ClawletEventHandler,
  GuardrailState,
  GuardrailCheckResult,
} from './types/index.js';

// Schema validators
export { ClawletConfigSchema, NetworkSchema } from './types/index.js';

// Network utilities
export { NETWORK_CONFIGS, getNetworkConfig, getChainId } from './constants/networks.js';

// ERC-8004 constants and ABIs
export {
  ERC8004_ADDRESSES,
  IDENTITY_REGISTRY_ABI,
  REPUTATION_REGISTRY_ABI,
  VALIDATION_REGISTRY_ABI,
  ERC20_ABI,
} from './constants/erc8004.js';

// Keystore utilities
export {
  encryptPrivateKey,
  decryptKeystore,
  saveKeystore,
  loadKeystore,
  listKeystores,
  getKeystoreDir,
  createEncryptedKeystore,
  loadAndDecryptKeystore,
} from './utils/keystore.js';

// Payment watcher utilities
export {
  createPaymentWatcher,
  createTokenWatcher,
  formatPaymentEvent,
  formatTokenTransferEvent,
  type PaymentEvent,
  type PaymentWatcherConfig,
  type TokenTransferEvent,
  type TokenWatcherConfig,
} from './utils/payment-watcher.js';

// Trust cache utilities
export {
  TrustCache,
  TrustList,
  type TrustCacheConfig,
  type TrustListEntry,
} from './utils/trust-cache.js';

// Batch payment utilities
export {
  batchPay,
  calculateBatchTotal,
  validateBatch,
  splitPayment,
  prepareMulticall,
  MULTICALL3_ADDRESS,
  MULTICALL3_ABI,
  type BatchPayment,
  type BatchPaymentResult,
} from './utils/batch.js';

// ENS utilities
export {
  ENSResolver,
  ENS_AGENT_KEYS,
  getAgentMetadata,
  type ENSResolverConfig,
  type ENSRecord,
} from './utils/ens.js';

// Re-export commonly used viem types
export type { Address, Hash, Hex } from 'viem';

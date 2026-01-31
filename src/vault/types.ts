/**
 * ClawletVault TypeScript Types
 */

import type { Address, Hash } from 'viem';

/**
 * Vault data structure matching the Solidity struct
 */
export interface Vault {
  /** Human operator address (immutable) */
  owner: Address;
  /** AI agent address (owner can change) */
  agent: Address;
  /** Whether vault is paused */
  paused: boolean;
  /** ETH balance in wei */
  ethBalance: bigint;
  /** Maximum ETH per 24 hours in wei */
  dailyLimit: bigint;
  /** Maximum ETH per transaction in wei */
  perTxLimit: bigint;
  /** Amount spent today in wei */
  spentToday: bigint;
  /** Timestamp when current day started */
  dayStartTime: bigint;
  /** Whether recipient whitelist is enforced */
  whitelistEnabled: boolean;
  /** Vault creation timestamp */
  createdAt: bigint;
}

/**
 * Configuration for creating a new vault
 */
export interface CreateVaultParams {
  /** AI agent address */
  agentAddress: Address;
  /** Maximum ETH per 24 hours (as string like "0.5") */
  dailyLimitEth: string;
  /** Maximum ETH per transaction (as string like "0.1") */
  perTxLimitEth: string;
  /** Optional initial funding in ETH */
  initialFundingEth?: string;
}

/**
 * Configuration for agent send operation
 */
export interface AgentSendParams {
  /** Vault ID */
  vaultId: bigint;
  /** Recipient address */
  to: Address;
  /** Amount in ETH (as string like "0.05") */
  amountEth: string;
  /** Optional transaction memo */
  memo?: string;
}

/**
 * Configuration for agent token send operation
 */
export interface AgentSendTokenParams {
  /** Vault ID */
  vaultId: bigint;
  /** ERC20 token address */
  token: Address;
  /** Recipient address */
  to: Address;
  /** Amount in token units (raw bigint) */
  amount: bigint;
}

/**
 * Result of a vault transaction
 */
export interface VaultTxResult {
  /** Transaction hash */
  hash: Hash;
  /** Vault ID involved */
  vaultId: bigint;
  /** Whether transaction succeeded */
  success: boolean;
}

/**
 * Vault creation result
 */
export interface CreateVaultResult extends VaultTxResult {
  /** Newly created vault ID */
  vaultId: bigint;
}

/**
 * Result of emergency drain
 */
export interface EmergencyDrainResult {
  /** Transaction hash */
  hash: Hash;
  /** Amount of ETH drained */
  ethDrained: bigint;
  /** Tokens that were drained */
  tokensDrained: Address[];
}

/**
 * Vault summary for display
 */
export interface VaultSummary {
  id: bigint;
  owner: Address;
  agent: Address;
  paused: boolean;
  ethBalanceEth: string;
  dailyLimitEth: string;
  perTxLimitEth: string;
  remainingAllowanceEth: string;
  whitelistEnabled: boolean;
  createdAt: Date;
}

/**
 * SDK configuration
 */
export interface ClawletVaultSDKConfig {
  /** Network to use */
  network: 'mainnet' | 'sepolia' | 'base' | 'optimism' | 'arbitrum';
  /** Custom RPC URL (optional) */
  rpcUrl?: string;
  /** Contract address override (optional, for testing) */
  contractAddress?: Address;
}

/**
 * Event types emitted by the vault
 */
export type VaultEventType =
  | 'VaultCreated'
  | 'Deposited'
  | 'TokenDeposited'
  | 'AgentSent'
  | 'AgentSentToken'
  | 'OwnerWithdrew'
  | 'OwnerWithdrewToken'
  | 'VaultPaused'
  | 'VaultUnpaused'
  | 'AgentRevoked'
  | 'AgentChanged'
  | 'LimitsUpdated'
  | 'WhitelistUpdated'
  | 'WhitelistToggled'
  | 'EmergencyDrain';

/**
 * Base vault event
 */
export interface VaultEvent {
  type: VaultEventType;
  vaultId: bigint;
  blockNumber: bigint;
  transactionHash: Hash;
}

/**
 * Agent send event
 */
export interface AgentSentEvent extends VaultEvent {
  type: 'AgentSent';
  to: Address;
  amount: bigint;
  memo: string;
}

/**
 * Deposit event
 */
export interface DepositedEvent extends VaultEvent {
  type: 'Deposited';
  from: Address;
  amount: bigint;
}

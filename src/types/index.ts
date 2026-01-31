import { z } from 'zod';
import type { Address, Hash, Hex } from 'viem';

// ============================================================================
// Network Configuration
// ============================================================================

export const NetworkSchema = z.enum([
  'mainnet',
  'sepolia',
  'optimism',
  'arbitrum',
  'base',
]);

export type Network = z.infer<typeof NetworkSchema>;

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// ============================================================================
// Wallet Configuration
// ============================================================================

export const ClawletConfigSchema = z.object({
  privateKey: z.string().optional(),
  mnemonic: z.string().optional(),
  rpcUrl: z.string().url().optional(),
  network: NetworkSchema.optional(),
  hdPath: z.string().optional(),

  // Security guardrails
  guardrails: z.object({
    maxTxValueWei: z.bigint().optional(),
    maxTxPerHour: z.number().int().positive().optional(),
    maxTxPerDay: z.number().int().positive().optional(),
    allowedRecipients: z.array(z.string()).optional(),
    blockedRecipients: z.array(z.string()).optional(),
    autoApproveThresholdWei: z.bigint().optional(),
  }).optional(),

  // ERC-8004 Trust settings
  trustSettings: z.object({
    requireIdentity: z.boolean().optional(),
    minReputationScore: z.number().min(0).max(100).optional(),
    requireValidation: z.boolean().optional(),
    skipTrustCheckForWhitelisted: z.boolean().optional(),
  }).optional(),
});

export type ClawletConfig = z.infer<typeof ClawletConfigSchema>;

// ============================================================================
// Transaction Types
// ============================================================================

export interface TransactionRequest {
  to: Address;
  value?: bigint;
  data?: Hex;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
}

export interface TransactionResult {
  hash: Hash;
  from: Address;
  to: Address;
  value: bigint;
  blockNumber?: bigint;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: bigint;
}

export interface PaymentRequest {
  recipient: Address;
  amount: bigint;
  memo?: string;
  skipTrustCheck?: boolean;
}

// ============================================================================
// ERC-20 Token Types
// ============================================================================

export interface TokenBalance {
  token: Address;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  formattedBalance: string;
}

export interface TokenTransferRequest {
  token: Address;
  to: Address;
  amount: bigint;
  memo?: string;
}

// ============================================================================
// ERC-8004 Agent Identity Types
// ============================================================================

export interface AgentIdentity {
  address: Address;
  tokenId: bigint;
  exists: boolean;
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    agentType?: string;
  };
}

export interface AgentReputation {
  address: Address;
  score: number; // 0-100
  totalInteractions: number;
  positiveInteractions: number;
  negativeInteractions: number;
  lastUpdated: Date;
}

export interface AgentValidation {
  address: Address;
  validationType: string;
  validator: Address;
  isValid: boolean;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface TrustCheckResult {
  address: Address;
  isTrusted: boolean;
  identity?: AgentIdentity;
  reputation?: AgentReputation;
  validations?: AgentValidation[];
  reasons: string[];
}

// ============================================================================
// Event Types
// ============================================================================

export type ClawletEvent =
  | { type: 'payment_received'; from: Address; amount: bigint; hash: Hash }
  | { type: 'payment_sent'; to: Address; amount: bigint; hash: Hash }
  | { type: 'token_received'; token: Address; from: Address; amount: bigint; hash: Hash }
  | { type: 'token_sent'; token: Address; to: Address; amount: bigint; hash: Hash }
  | { type: 'trust_check_passed'; address: Address }
  | { type: 'trust_check_failed'; address: Address; reasons: string[] }
  | { type: 'guardrail_triggered'; reason: string };

export type ClawletEventHandler = (event: ClawletEvent) => void | Promise<void>;

// ============================================================================
// Guardrail Types
// ============================================================================

export interface GuardrailState {
  txCountLastHour: number;
  txCountLastDay: number;
  lastTxTimestamp: number;
  hourlyTxTimestamps: number[];
  dailyTxTimestamps: number[];
}

export interface GuardrailCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

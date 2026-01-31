/**
 * Owner/Operator Controls
 *
 * Provides human oversight capabilities for AI agent wallets.
 * Allows owners to withdraw funds, pause operations, and manage the agent.
 */

import {
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  type Account,
  formatEther,
  parseEther,
} from 'viem';
import { ERC20_ABI } from '../constants/erc8004.js';

// ============================================================================
// Types
// ============================================================================

export interface OwnerConfig {
  /** Owner's wallet address (can withdraw funds) */
  ownerAddress: Address;
  /** Optional secondary owner for multi-sig style approval */
  coOwnerAddress?: Address;
  /** Require both owners for withdrawals above this amount */
  multiSigThresholdWei?: bigint;
  /** Allow owner to pause all agent transactions */
  canPause?: boolean;
  /** Allow owner to change guardrails remotely */
  canModifyGuardrails?: boolean;
}

export interface WithdrawalRequest {
  id: string;
  type: 'eth' | 'token';
  token?: Address;
  amount: bigint;
  to: Address;
  requestedAt: Date;
  requestedBy: Address;
  status: 'pending' | 'approved' | 'executed' | 'rejected';
  approvedBy?: Address;
  executedAt?: Date;
  txHash?: Hash;
}

export interface OwnerAction {
  type: 'withdraw' | 'pause' | 'unpause' | 'update_guardrails' | 'emergency_drain';
  timestamp: Date;
  by: Address;
  details: Record<string, unknown>;
  txHash?: Hash;
}

// ============================================================================
// Owner Controller
// ============================================================================

export class OwnerController {
  private config: OwnerConfig;
  private isPaused: boolean = false;
  private pendingWithdrawals: Map<string, WithdrawalRequest> = new Map();
  private actionLog: OwnerAction[] = [];
  private withdrawalCounter: number = 0;

  constructor(config: OwnerConfig) {
    this.config = config;
  }

  /**
   * Check if an address is an owner
   */
  isOwner(address: Address): boolean {
    const addrLower = address.toLowerCase();
    return (
      addrLower === this.config.ownerAddress.toLowerCase() ||
      addrLower === this.config.coOwnerAddress?.toLowerCase()
    );
  }

  /**
   * Check if address is the primary owner
   */
  isPrimaryOwner(address: Address): boolean {
    return address.toLowerCase() === this.config.ownerAddress.toLowerCase();
  }

  /**
   * Check if wallet is paused
   */
  getIsPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Pause all agent transactions (owner only)
   */
  pause(by: Address): void {
    if (!this.isOwner(by)) {
      throw new Error('Only owner can pause the wallet');
    }
    if (!this.config.canPause) {
      throw new Error('Pause functionality not enabled');
    }

    this.isPaused = true;
    this.logAction({
      type: 'pause',
      timestamp: new Date(),
      by,
      details: {},
    });
  }

  /**
   * Unpause agent transactions (owner only)
   */
  unpause(by: Address): void {
    if (!this.isOwner(by)) {
      throw new Error('Only owner can unpause the wallet');
    }

    this.isPaused = false;
    this.logAction({
      type: 'unpause',
      timestamp: new Date(),
      by,
      details: {},
    });
  }

  /**
   * Request ETH withdrawal
   */
  requestWithdrawETH(
    amount: bigint,
    to: Address,
    requestedBy: Address
  ): WithdrawalRequest {
    if (!this.isOwner(requestedBy)) {
      throw new Error('Only owner can request withdrawals');
    }

    const id = `WD-${++this.withdrawalCounter}-${Date.now()}`;
    const request: WithdrawalRequest = {
      id,
      type: 'eth',
      amount,
      to,
      requestedAt: new Date(),
      requestedBy,
      status: this.needsMultiSig(amount) ? 'pending' : 'approved',
    };

    if (request.status === 'approved') {
      request.approvedBy = requestedBy;
    }

    this.pendingWithdrawals.set(id, request);
    return request;
  }

  /**
   * Request token withdrawal
   */
  requestWithdrawToken(
    token: Address,
    amount: bigint,
    to: Address,
    requestedBy: Address
  ): WithdrawalRequest {
    if (!this.isOwner(requestedBy)) {
      throw new Error('Only owner can request withdrawals');
    }

    const id = `WD-${++this.withdrawalCounter}-${Date.now()}`;
    const request: WithdrawalRequest = {
      id,
      type: 'token',
      token,
      amount,
      to,
      requestedAt: new Date(),
      requestedBy,
      status: this.needsMultiSig(amount) ? 'pending' : 'approved',
    };

    if (request.status === 'approved') {
      request.approvedBy = requestedBy;
    }

    this.pendingWithdrawals.set(id, request);
    return request;
  }

  /**
   * Check if amount requires multi-sig approval
   */
  private needsMultiSig(amount: bigint): boolean {
    if (!this.config.coOwnerAddress) return false;
    if (!this.config.multiSigThresholdWei) return false;
    return amount >= this.config.multiSigThresholdWei;
  }

  /**
   * Approve a pending withdrawal (co-owner)
   */
  approveWithdrawal(id: string, by: Address): WithdrawalRequest {
    const request = this.pendingWithdrawals.get(id);
    if (!request) {
      throw new Error(`Withdrawal request ${id} not found`);
    }
    if (!this.isOwner(by)) {
      throw new Error('Only owner can approve withdrawals');
    }
    if (request.status !== 'pending') {
      throw new Error(`Withdrawal is already ${request.status}`);
    }
    if (by.toLowerCase() === request.requestedBy.toLowerCase()) {
      throw new Error('Cannot approve your own request');
    }

    request.status = 'approved';
    request.approvedBy = by;
    return request;
  }

  /**
   * Reject a pending withdrawal
   */
  rejectWithdrawal(id: string, by: Address): WithdrawalRequest {
    const request = this.pendingWithdrawals.get(id);
    if (!request) {
      throw new Error(`Withdrawal request ${id} not found`);
    }
    if (!this.isOwner(by)) {
      throw new Error('Only owner can reject withdrawals');
    }

    request.status = 'rejected';
    return request;
  }

  /**
   * Execute an approved withdrawal
   */
  async executeWithdrawal(
    id: string,
    walletClient: WalletClient<Transport, Chain, Account>,
    publicClient: PublicClient<Transport, Chain>
  ): Promise<WithdrawalRequest> {
    const request = this.pendingWithdrawals.get(id);
    if (!request) {
      throw new Error(`Withdrawal request ${id} not found`);
    }
    if (request.status !== 'approved') {
      throw new Error(`Withdrawal must be approved first (current: ${request.status})`);
    }

    let hash: Hash;

    if (request.type === 'eth') {
      hash = await walletClient.sendTransaction({
        to: request.to,
        value: request.amount,
      });
    } else if (request.type === 'token' && request.token) {
      hash = await walletClient.writeContract({
        address: request.token,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [request.to, request.amount],
      });
    } else {
      throw new Error('Invalid withdrawal request');
    }

    // Wait for confirmation
    await publicClient.waitForTransactionReceipt({ hash });

    request.status = 'executed';
    request.executedAt = new Date();
    request.txHash = hash;

    this.logAction({
      type: 'withdraw',
      timestamp: new Date(),
      by: request.requestedBy,
      details: {
        id: request.id,
        type: request.type,
        amount: request.amount.toString(),
        to: request.to,
        token: request.token,
      },
      txHash: hash,
    });

    return request;
  }

  /**
   * Emergency drain - withdraw ALL funds to owner (primary owner only)
   */
  async emergencyDrain(
    walletClient: WalletClient<Transport, Chain, Account>,
    publicClient: PublicClient<Transport, Chain>,
    by: Address,
    tokens?: Address[]
  ): Promise<{ ethHash?: Hash; tokenHashes: Hash[] }> {
    if (!this.isPrimaryOwner(by)) {
      throw new Error('Only primary owner can emergency drain');
    }

    const results: { ethHash?: Hash; tokenHashes: Hash[] } = {
      tokenHashes: [],
    };

    // Pause first
    this.isPaused = true;

    // Drain ETH
    const ethBalance = await publicClient.getBalance({
      address: walletClient.account.address,
    });

    if (ethBalance > 0n) {
      // Leave some for gas
      const gasBuffer = parseEther('0.01');
      const toWithdraw = ethBalance > gasBuffer ? ethBalance - gasBuffer : 0n;

      if (toWithdraw > 0n) {
        results.ethHash = await walletClient.sendTransaction({
          to: this.config.ownerAddress,
          value: toWithdraw,
        });
      }
    }

    // Drain specified tokens
    if (tokens) {
      for (const token of tokens) {
        try {
          const balance = await publicClient.readContract({
            address: token,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletClient.account.address],
          });

          if (balance > 0n) {
            const hash = await walletClient.writeContract({
              address: token,
              abi: ERC20_ABI,
              functionName: 'transfer',
              args: [this.config.ownerAddress, balance],
            });
            results.tokenHashes.push(hash);
          }
        } catch (error) {
          console.error(`Failed to drain token ${token}:`, error);
        }
      }
    }

    this.logAction({
      type: 'emergency_drain',
      timestamp: new Date(),
      by,
      details: {
        ethAmount: ethBalance.toString(),
        tokens: tokens ?? [],
      },
      txHash: results.ethHash,
    });

    return results;
  }

  /**
   * Get pending withdrawals
   */
  getPendingWithdrawals(): WithdrawalRequest[] {
    return Array.from(this.pendingWithdrawals.values()).filter(
      (r) => r.status === 'pending'
    );
  }

  /**
   * Get all withdrawals
   */
  getAllWithdrawals(): WithdrawalRequest[] {
    return Array.from(this.pendingWithdrawals.values());
  }

  /**
   * Get action log
   */
  getActionLog(): OwnerAction[] {
    return [...this.actionLog];
  }

  /**
   * Log an action
   */
  private logAction(action: OwnerAction): void {
    this.actionLog.push(action);
  }

  /**
   * Get owner config
   */
  getConfig(): OwnerConfig {
    return { ...this.config };
  }

  /**
   * Update owner address (primary owner only)
   */
  updateOwner(newOwner: Address, by: Address): void {
    if (!this.isPrimaryOwner(by)) {
      throw new Error('Only primary owner can transfer ownership');
    }

    this.config.ownerAddress = newOwner;
    this.logAction({
      type: 'update_guardrails',
      timestamp: new Date(),
      by,
      details: { newOwner },
    });
  }

  /**
   * Export state for persistence
   */
  exportState(): {
    isPaused: boolean;
    withdrawals: WithdrawalRequest[];
    actionLog: OwnerAction[];
  } {
    return {
      isPaused: this.isPaused,
      withdrawals: Array.from(this.pendingWithdrawals.values()),
      actionLog: this.actionLog,
    };
  }

  /**
   * Import state from persistence
   */
  importState(state: {
    isPaused: boolean;
    withdrawals: WithdrawalRequest[];
    actionLog: OwnerAction[];
  }): void {
    this.isPaused = state.isPaused;
    this.pendingWithdrawals.clear();
    for (const w of state.withdrawals) {
      this.pendingWithdrawals.set(w.id, w);
    }
    this.actionLog = state.actionLog;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a simple owner controller (single owner, no multi-sig)
 */
export function createSimpleOwner(ownerAddress: Address): OwnerController {
  return new OwnerController({
    ownerAddress,
    canPause: true,
    canModifyGuardrails: true,
  });
}

/**
 * Create a multi-sig owner controller
 */
export function createMultiSigOwner(
  primaryOwner: Address,
  coOwner: Address,
  thresholdEth: string = '1.0'
): OwnerController {
  return new OwnerController({
    ownerAddress: primaryOwner,
    coOwnerAddress: coOwner,
    multiSigThresholdWei: parseEther(thresholdEth),
    canPause: true,
    canModifyGuardrails: true,
  });
}

/**
 * Format withdrawal for display
 */
export function formatWithdrawal(w: WithdrawalRequest): string {
  const amount = w.type === 'eth'
    ? `${formatEther(w.amount)} ETH`
    : `${w.amount} tokens`;
  return `[${w.id}] ${w.status.toUpperCase()} - ${amount} to ${w.to}`;
}

/**
 * Batch Transaction Utilities
 *
 * Enables sending multiple payments in a single interaction
 * for improved efficiency when paying multiple agents.
 */

import type { Address, Hash, Hex } from 'viem';
import { parseEther, encodeFunctionData } from 'viem';
import type { Clawlet } from '../core/clawlet.js';

export interface BatchPayment {
  to: Address;
  amountEth: string;
  memo?: string;
}

export interface BatchPaymentResult {
  payment: BatchPayment;
  success: boolean;
  hash?: Hash;
  error?: string;
}

/**
 * Execute multiple payments sequentially
 *
 * Note: For true batching, you'd want to use a multicall contract.
 * This utility sends transactions one by one but handles errors gracefully.
 */
export async function batchPay(
  wallet: Clawlet,
  payments: BatchPayment[],
  options?: {
    skipTrustCheck?: boolean;
    stopOnError?: boolean;
    delayMs?: number;
  }
): Promise<BatchPaymentResult[]> {
  const results: BatchPaymentResult[] = [];
  const stopOnError = options?.stopOnError ?? false;
  const delayMs = options?.delayMs ?? 0;

  for (const payment of payments) {
    try {
      const tx = await wallet.payAgent(
        payment.to,
        payment.amountEth,
        payment.memo,
        { skipTrustCheck: options?.skipTrustCheck }
      );

      results.push({
        payment,
        success: true,
        hash: tx.hash,
      });

      // Optional delay between transactions
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      results.push({
        payment,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      if (stopOnError) {
        break;
      }
    }
  }

  return results;
}

/**
 * Calculate total value for batch payments
 */
export function calculateBatchTotal(payments: BatchPayment[]): bigint {
  return payments.reduce((total, p) => total + parseEther(p.amountEth), 0n);
}

/**
 * Validate batch payments before sending
 */
export async function validateBatch(
  wallet: Clawlet,
  payments: BatchPayment[]
): Promise<{
  valid: boolean;
  totalValue: bigint;
  balance: bigint;
  insufficientFunds: boolean;
  untrustedAgents: Address[];
}> {
  const totalValue = calculateBatchTotal(payments);
  const balance = await wallet.getBalance();
  const insufficientFunds = balance < totalValue;

  const untrustedAgents: Address[] = [];
  for (const payment of payments) {
    const isTrusted = await wallet.isAgentTrusted(payment.to);
    if (!isTrusted) {
      untrustedAgents.push(payment.to);
    }
  }

  return {
    valid: !insufficientFunds && untrustedAgents.length === 0,
    totalValue,
    balance,
    insufficientFunds,
    untrustedAgents,
  };
}

/**
 * Split a large payment into smaller chunks
 *
 * Useful for staying under guardrail limits
 */
export function splitPayment(
  to: Address,
  totalAmountEth: string,
  maxChunkEth: string,
  memo?: string
): BatchPayment[] {
  const total = parseEther(totalAmountEth);
  const maxChunk = parseEther(maxChunkEth);
  const payments: BatchPayment[] = [];

  let remaining = total;
  let index = 1;

  while (remaining > 0n) {
    const chunkValue = remaining > maxChunk ? maxChunk : remaining;
    const chunkEth = (Number(chunkValue) / 1e18).toString();

    payments.push({
      to,
      amountEth: chunkEth,
      memo: memo ? `${memo} (part ${index})` : undefined,
    });

    remaining -= chunkValue;
    index++;
  }

  return payments;
}

/**
 * Multicall contract interface for true batch transactions
 *
 * This would interact with a deployed Multicall3 contract
 * for atomic batch operations.
 */
export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

export const MULTICALL3_ABI = [
  {
    name: 'aggregate3Value',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'value', type: 'uint256' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
] as const;

/**
 * Prepare a multicall for batch ETH transfers
 *
 * Returns the calldata for the Multicall3 contract
 */
export function prepareMulticall(payments: BatchPayment[]): {
  to: Address;
  value: bigint;
  data: Hex;
} {
  const calls = payments.map((p) => ({
    target: p.to,
    allowFailure: false,
    value: parseEther(p.amountEth),
    callData: '0x' as Hex, // Empty calldata for ETH transfer
  }));

  const totalValue = calculateBatchTotal(payments);

  const data = encodeFunctionData({
    abi: MULTICALL3_ABI,
    functionName: 'aggregate3Value',
    args: [calls],
  });

  return {
    to: MULTICALL3_ADDRESS,
    value: totalValue,
    data,
  };
}

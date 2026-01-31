/**
 * Payment Watcher Utility
 *
 * Provides real-time monitoring of incoming payments using polling or
 * WebSocket connections (when available).
 */

import type { PublicClient, Address, Hash, Chain, Transport } from 'viem';
import { formatEther } from 'viem';

export interface PaymentEvent {
  from: Address;
  to: Address;
  value: bigint;
  hash: Hash;
  blockNumber: bigint;
  timestamp: Date;
}

export interface PaymentWatcherConfig {
  address: Address;
  pollingIntervalMs?: number;
  startBlock?: bigint;
  onPayment: (payment: PaymentEvent) => void | Promise<void>;
  onError?: (error: Error) => void;
}

/**
 * Create a payment watcher that monitors incoming ETH transfers
 */
export function createPaymentWatcher(
  client: PublicClient<Transport, Chain>,
  config: PaymentWatcherConfig
): { start: () => void; stop: () => void; isRunning: () => boolean } {
  let running = false;
  let lastBlockNumber = config.startBlock ?? 0n;
  let timeoutId: NodeJS.Timeout | null = null;

  const intervalMs = config.pollingIntervalMs ?? 15000;
  const watchAddress = config.address.toLowerCase();

  const poll = async () => {
    if (!running) return;

    try {
      const currentBlock = await client.getBlockNumber();

      // Initialize on first run
      if (lastBlockNumber === 0n) {
        lastBlockNumber = currentBlock;
      }

      // Process new blocks
      if (currentBlock > lastBlockNumber) {
        for (let blockNum = lastBlockNumber + 1n; blockNum <= currentBlock; blockNum++) {
          const block = await client.getBlock({
            blockNumber: blockNum,
            includeTransactions: true,
          });

          const timestamp = new Date(Number(block.timestamp) * 1000);

          for (const tx of block.transactions) {
            if (typeof tx !== 'string') {
              // Check if this is an incoming payment to our address
              if (tx.to?.toLowerCase() === watchAddress && tx.value > 0n) {
                const payment: PaymentEvent = {
                  from: tx.from,
                  to: tx.to as Address,
                  value: tx.value,
                  hash: tx.hash,
                  blockNumber: blockNum,
                  timestamp,
                };

                try {
                  await config.onPayment(payment);
                } catch (error) {
                  config.onError?.(error instanceof Error ? error : new Error(String(error)));
                }
              }
            }
          }
        }

        lastBlockNumber = currentBlock;
      }
    } catch (error) {
      config.onError?.(error instanceof Error ? error : new Error(String(error)));
    }

    // Schedule next poll
    if (running) {
      timeoutId = setTimeout(poll, intervalMs);
    }
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      poll();
    },
    stop: () => {
      running = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    isRunning: () => running,
  };
}

/**
 * Watch for ERC-20 token transfers
 */
export interface TokenTransferEvent {
  token: Address;
  from: Address;
  to: Address;
  value: bigint;
  hash: Hash;
  blockNumber: bigint;
  timestamp: Date;
}

export interface TokenWatcherConfig {
  address: Address;
  tokens: Address[];
  pollingIntervalMs?: number;
  startBlock?: bigint;
  onTransfer: (transfer: TokenTransferEvent) => void | Promise<void>;
  onError?: (error: Error) => void;
}


/**
 * Create a token transfer watcher
 */
export function createTokenWatcher(
  client: PublicClient<Transport, Chain>,
  config: TokenWatcherConfig
): { start: () => void; stop: () => void; isRunning: () => boolean } {
  let running = false;
  let lastBlockNumber = config.startBlock ?? 0n;
  let timeoutId: NodeJS.Timeout | null = null;

  const intervalMs = config.pollingIntervalMs ?? 15000;
  const tokenSet = new Set(config.tokens.map((t) => t.toLowerCase()));

  const poll = async () => {
    if (!running) return;

    try {
      const currentBlock = await client.getBlockNumber();

      if (lastBlockNumber === 0n) {
        lastBlockNumber = currentBlock;
      }

      if (currentBlock > lastBlockNumber) {
        // Get logs for Transfer events to our address
        const logs = await client.getLogs({
          address: config.tokens.length > 0 ? config.tokens : undefined,
          event: {
            type: 'event',
            name: 'Transfer',
            inputs: [
              { type: 'address', name: 'from', indexed: true },
              { type: 'address', name: 'to', indexed: true },
              { type: 'uint256', name: 'value', indexed: false },
            ],
          },
          args: {
            to: config.address,
          },
          fromBlock: lastBlockNumber + 1n,
          toBlock: currentBlock,
        });

        for (const log of logs) {
          if (tokenSet.size === 0 || tokenSet.has(log.address.toLowerCase())) {
            const block = await client.getBlock({ blockNumber: log.blockNumber! });
            const timestamp = new Date(Number(block.timestamp) * 1000);

            // Extract from args
            const from = log.args.from as Address;
            const to = log.args.to as Address;
            const value = log.args.value as bigint;

            const transfer: TokenTransferEvent = {
              token: log.address,
              from,
              to,
              value,
              hash: log.transactionHash!,
              blockNumber: log.blockNumber!,
              timestamp,
            };

            try {
              await config.onTransfer(transfer);
            } catch (error) {
              config.onError?.(error instanceof Error ? error : new Error(String(error)));
            }
          }
        }

        lastBlockNumber = currentBlock;
      }
    } catch (error) {
      config.onError?.(error instanceof Error ? error : new Error(String(error)));
    }

    if (running) {
      timeoutId = setTimeout(poll, intervalMs);
    }
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      poll();
    },
    stop: () => {
      running = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    isRunning: () => running,
  };
}

/**
 * Format a payment event for logging
 */
export function formatPaymentEvent(payment: PaymentEvent): string {
  return `Received ${formatEther(payment.value)} ETH from ${payment.from} (block ${payment.blockNumber})`;
}

/**
 * Format a token transfer event for logging
 */
export function formatTokenTransferEvent(transfer: TokenTransferEvent): string {
  return `Received ${transfer.value} tokens (${transfer.token}) from ${transfer.from} (block ${transfer.blockNumber})`;
}

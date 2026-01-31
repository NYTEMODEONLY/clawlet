import { parseEther, formatEther, type Address, type Hash, type Hex } from 'viem';

import { ClawletWallet } from './wallet.js';
import { TrustSystem } from './trust.js';
import { OwnerController, type OwnerConfig } from '../utils/owner.js';
import type {
  ClawletConfig,
  TransactionResult,
  TokenBalance,
  TrustCheckResult,
  ClawletEventHandler,
  Network,
} from '../types/index.js';

/**
 * Clawlet - AI-native Ethereum wallet for autonomous agents
 *
 * @example
 * ```ts
 * import { Clawlet } from 'clawlet';
 *
 * const wallet = new Clawlet({
 *   privateKey: process.env.CLAWLET_KEY,
 *   network: 'base',
 * });
 *
 * // Check trust before paying
 * const isTrusted = await wallet.isAgentTrusted('0xAgentAddress');
 * if (isTrusted) {
 *   await wallet.payAgent('0xAgentAddress', '0.01', 'Task completion tip');
 * }
 * ```
 */
export class Clawlet {
  private wallet: ClawletWallet;
  private trust: TrustSystem;
  private owner: OwnerController | null = null;

  constructor(config: ClawletConfig & { owner?: OwnerConfig }) {
    this.wallet = new ClawletWallet(config);
    this.trust = new TrustSystem(this.wallet.getPublicClient(), config.trustSettings);

    // Set up owner controller if provided
    if (config.owner) {
      this.owner = new OwnerController(config.owner);
    }

    // Add any pre-configured allowed recipients to trust whitelist
    if (config.guardrails?.allowedRecipients) {
      for (const address of config.guardrails.allowedRecipients) {
        this.trust.addToWhitelist(address as Address);
      }
    }
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Generate a new wallet with random mnemonic
   */
  static generate(network: Network = 'mainnet'): {
    clawlet: Clawlet;
    mnemonic: string;
    address: Address;
  } {
    const { mnemonic, address } = ClawletWallet.generate(network);
    const clawlet = new Clawlet({ mnemonic, network });
    return { clawlet, mnemonic, address };
  }

  /**
   * Create from private key
   */
  static fromPrivateKey(privateKey: Hex, network: Network = 'mainnet'): Clawlet {
    return new Clawlet({ privateKey, network });
  }

  /**
   * Create from mnemonic
   */
  static fromMnemonic(mnemonic: string, network: Network = 'mainnet'): Clawlet {
    return new Clawlet({ mnemonic, network });
  }

  /**
   * Create from environment variable
   */
  static fromEnv(envVar: string = 'CLAWLET_KEY', network: Network = 'mainnet'): Clawlet {
    const key = process.env[envVar];
    if (!key) {
      throw new Error(`Environment variable ${envVar} not set`);
    }
    return new Clawlet({ privateKey: key as Hex, network });
  }

  // ============================================================================
  // Wallet Information
  // ============================================================================

  /**
   * Get wallet address
   */
  getAddress(): Address {
    return this.wallet.getAddress();
  }

  /**
   * Get current network
   */
  getNetwork(): Network {
    return this.wallet.getNetwork();
  }

  /**
   * Get chain ID
   */
  getChainId(): number {
    return this.wallet.getChainId();
  }

  // ============================================================================
  // Balance Operations
  // ============================================================================

  /**
   * Get ETH balance in wei
   */
  async getBalance(): Promise<bigint> {
    return this.wallet.getBalance();
  }

  /**
   * Get formatted ETH balance
   */
  async getFormattedBalance(): Promise<string> {
    return this.wallet.getFormattedBalance();
  }

  /**
   * Get ERC-20 token balance
   */
  async getTokenBalance(tokenAddress: Address): Promise<TokenBalance> {
    return this.wallet.getTokenBalance(tokenAddress);
  }

  // ============================================================================
  // Trust System (ERC-8004)
  // ============================================================================

  /**
   * Check if an agent address is trusted
   */
  async isAgentTrusted(address: Address): Promise<boolean> {
    return this.trust.isTrusted(address);
  }

  /**
   * Get detailed trust information for an agent
   */
  async getAgentTrust(address: Address): Promise<TrustCheckResult> {
    return this.trust.checkTrust(address);
  }

  /**
   * Add address to trust whitelist
   */
  trustAgent(address: Address): void {
    this.trust.addToWhitelist(address);
  }

  /**
   * Remove address from trust whitelist
   */
  untrustAgent(address: Address): void {
    this.trust.removeFromWhitelist(address);
  }

  /**
   * Check if address is whitelisted
   */
  isAgentWhitelisted(address: Address): boolean {
    return this.trust.isWhitelisted(address);
  }

  // ============================================================================
  // Payment Operations
  // ============================================================================

  /**
   * Pay an agent (with automatic trust check)
   *
   * @example
   * ```ts
   * await wallet.payAgent('0xAgent', '0.01', 'Task completion');
   * ```
   */
  async payAgent(
    recipient: Address,
    amountEth: string,
    _memo?: string,
    options?: { skipTrustCheck?: boolean }
  ): Promise<TransactionResult> {
    // Perform trust check unless skipped
    if (!options?.skipTrustCheck) {
      const trustResult = await this.trust.checkTrust(recipient);
      if (!trustResult.isTrusted) {
        throw new Error(
          `Agent ${recipient} is not trusted. Reasons: ${trustResult.reasons.join(', ')}`
        );
      }
    }

    return this.wallet.send(recipient, amountEth);
  }

  /**
   * Send ETH without trust check
   */
  async send(to: Address, amountEth: string): Promise<TransactionResult> {
    return this.wallet.send(to, amountEth);
  }

  /**
   * Send ETH with wei amount
   */
  async sendWei(to: Address, amountWei: bigint): Promise<TransactionResult> {
    return this.wallet.sendTransaction({ to, value: amountWei });
  }

  /**
   * Transfer ERC-20 tokens
   */
  async transferToken(
    tokenAddress: Address,
    to: Address,
    amount: bigint
  ): Promise<TransactionResult> {
    return this.wallet.transferToken(tokenAddress, to, amount);
  }

  /**
   * Transfer ERC-20 tokens with trust check
   */
  async payAgentToken(
    tokenAddress: Address,
    recipient: Address,
    amount: bigint,
    options?: { skipTrustCheck?: boolean }
  ): Promise<TransactionResult> {
    if (!options?.skipTrustCheck) {
      const trustResult = await this.trust.checkTrust(recipient);
      if (!trustResult.isTrusted) {
        throw new Error(
          `Agent ${recipient} is not trusted. Reasons: ${trustResult.reasons.join(', ')}`
        );
      }
    }

    return this.wallet.transferToken(tokenAddress, recipient, amount);
  }

  /**
   * Approve token spending
   */
  async approveToken(tokenAddress: Address, spender: Address, amount: bigint): Promise<Hash> {
    return this.wallet.approveToken(tokenAddress, spender, amount);
  }

  // ============================================================================
  // Transaction Utilities
  // ============================================================================

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(hash: Hash): Promise<TransactionResult> {
    return this.wallet.waitForTransaction(hash);
  }

  /**
   * Estimate gas for ETH transfer
   */
  async estimateGas(to: Address, value: bigint): Promise<bigint> {
    return this.wallet.estimateGas({ to, value });
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    return this.wallet.getGasPrice();
  }

  /**
   * Get current nonce
   */
  async getNonce(): Promise<number> {
    return this.wallet.getNonce();
  }

  // ============================================================================
  // Signing
  // ============================================================================

  /**
   * Sign a message
   */
  async signMessage(message: string): Promise<Hex> {
    return this.wallet.signMessage(message);
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(
    typedData: Parameters<typeof this.wallet.signTypedData>[0]
  ): Promise<Hex> {
    return this.wallet.signTypedData(typedData);
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Subscribe to wallet events
   */
  on(handler: ClawletEventHandler): () => void {
    return this.wallet.on(handler);
  }

  /**
   * Create a simple payment listener that polls for incoming transactions
   */
  watchIncomingPayments(
    callback: (from: Address, amount: bigint, hash: Hash) => void,
    intervalMs: number = 15000
  ): () => void {
    let lastBlockNumber = 0n;
    let running = true;

    const poll = async () => {
      if (!running) return;

      try {
        const client = this.wallet.getPublicClient();
        const currentBlock = await client.getBlockNumber();

        if (lastBlockNumber === 0n) {
          lastBlockNumber = currentBlock;
        }

        // Check for new blocks
        if (currentBlock > lastBlockNumber) {
          const myAddress = this.getAddress().toLowerCase();

          // Scan recent blocks for incoming transactions
          for (let block = lastBlockNumber + 1n; block <= currentBlock; block++) {
            const blockData = await client.getBlock({
              blockNumber: block,
              includeTransactions: true,
            });

            for (const tx of blockData.transactions) {
              if (typeof tx !== 'string' && tx.to?.toLowerCase() === myAddress && tx.value > 0n) {
                callback(tx.from, tx.value, tx.hash);
              }
            }
          }

          lastBlockNumber = currentBlock;
        }
      } catch (error) {
        console.error('Error polling for payments:', error);
      }

      if (running) {
        setTimeout(poll, intervalMs);
      }
    };

    poll();

    return () => {
      running = false;
    };
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Update guardrail settings
   */
  updateGuardrails(guardrails: ClawletConfig['guardrails']): void {
    this.wallet.updateConfig({ guardrails });
  }

  /**
   * Update trust settings
   */
  updateTrustSettings(settings: ClawletConfig['trustSettings']): void {
    this.trust.updateSettings(settings);
  }

  /**
   * Get underlying wallet instance
   */
  getWallet(): ClawletWallet {
    return this.wallet;
  }

  /**
   * Get trust system instance
   */
  getTrustSystem(): TrustSystem {
    return this.trust;
  }

  // ============================================================================
  // Owner Controls (for human operators to withdraw/manage)
  // ============================================================================

  /**
   * Set owner controller
   */
  setOwner(config: OwnerConfig): void {
    this.owner = new OwnerController(config);
  }

  /**
   * Get owner controller
   */
  getOwner(): OwnerController | null {
    return this.owner;
  }

  /**
   * Check if wallet has an owner configured
   */
  hasOwner(): boolean {
    return this.owner !== null;
  }

  /**
   * Check if wallet is paused by owner
   */
  isPaused(): boolean {
    return this.owner?.getIsPaused() ?? false;
  }

  /**
   * Owner: Withdraw ETH to owner's address
   */
  async ownerWithdrawETH(
    amount: bigint,
    ownerSignature: Address
  ): Promise<{ requestId: string; status: string; hash?: Hash }> {
    if (!this.owner) {
      throw new Error('No owner configured');
    }
    if (!this.owner.isOwner(ownerSignature)) {
      throw new Error('Not authorized');
    }

    const ownerAddress = this.owner.getConfig().ownerAddress;
    const request = this.owner.requestWithdrawETH(amount, ownerAddress, ownerSignature);

    if (request.status === 'approved') {
      const executed = await this.owner.executeWithdrawal(
        request.id,
        this.wallet.getWalletClient(),
        this.wallet.getPublicClient()
      );
      return {
        requestId: executed.id,
        status: executed.status,
        hash: executed.txHash,
      };
    }

    return {
      requestId: request.id,
      status: request.status,
    };
  }

  /**
   * Owner: Withdraw tokens to owner's address
   */
  async ownerWithdrawToken(
    token: Address,
    amount: bigint,
    ownerSignature: Address
  ): Promise<{ requestId: string; status: string; hash?: Hash }> {
    if (!this.owner) {
      throw new Error('No owner configured');
    }
    if (!this.owner.isOwner(ownerSignature)) {
      throw new Error('Not authorized');
    }

    const ownerAddress = this.owner.getConfig().ownerAddress;
    const request = this.owner.requestWithdrawToken(token, amount, ownerAddress, ownerSignature);

    if (request.status === 'approved') {
      const executed = await this.owner.executeWithdrawal(
        request.id,
        this.wallet.getWalletClient(),
        this.wallet.getPublicClient()
      );
      return {
        requestId: executed.id,
        status: executed.status,
        hash: executed.txHash,
      };
    }

    return {
      requestId: request.id,
      status: request.status,
    };
  }

  /**
   * Owner: Withdraw all ETH (minus gas buffer) to owner
   */
  async ownerWithdrawAll(ownerSignature: Address): Promise<Hash> {
    if (!this.owner) {
      throw new Error('No owner configured');
    }
    if (!this.owner.isPrimaryOwner(ownerSignature)) {
      throw new Error('Only primary owner can withdraw all');
    }

    const balance = await this.getBalance();
    const gasBuffer = parseEther('0.01');
    const toWithdraw = balance > gasBuffer ? balance - gasBuffer : 0n;

    if (toWithdraw === 0n) {
      throw new Error('Insufficient balance to withdraw');
    }

    const result = await this.ownerWithdrawETH(toWithdraw, ownerSignature);
    if (!result.hash) {
      throw new Error('Withdrawal not executed');
    }
    return result.hash;
  }

  /**
   * Owner: Emergency drain all funds
   */
  async ownerEmergencyDrain(
    ownerSignature: Address,
    tokens?: Address[]
  ): Promise<{ ethHash?: Hash; tokenHashes: Hash[] }> {
    if (!this.owner) {
      throw new Error('No owner configured');
    }

    return this.owner.emergencyDrain(
      this.wallet.getWalletClient(),
      this.wallet.getPublicClient(),
      ownerSignature,
      tokens
    );
  }

  /**
   * Owner: Pause all agent transactions
   */
  ownerPause(ownerSignature: Address): void {
    if (!this.owner) {
      throw new Error('No owner configured');
    }
    this.owner.pause(ownerSignature);
  }

  /**
   * Owner: Unpause agent transactions
   */
  ownerUnpause(ownerSignature: Address): void {
    if (!this.owner) {
      throw new Error('No owner configured');
    }
    this.owner.unpause(ownerSignature);
  }
}

// Re-export utility functions
export { parseEther, formatEther };

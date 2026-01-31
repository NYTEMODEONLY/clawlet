import {
  createWalletClient,
  createPublicClient,
  http,
  formatEther,
  parseEther,
  type WalletClient,
  type PublicClient,
  type Address,
  type Hash,
  type Hex,
  type Chain,
  type Transport,
  type Account,
} from 'viem';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { mainnet, sepolia, optimism, arbitrum, base } from 'viem/chains';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

import type {
  ClawletConfig,
  TransactionRequest,
  TransactionResult,
  TokenBalance,
  ClawletEvent,
  ClawletEventHandler,
  GuardrailState,
  GuardrailCheckResult,
  Network,
} from '../types/index.js';
import { getNetworkConfig } from '../constants/networks.js';
import { ERC20_ABI } from '../constants/erc8004.js';

const CHAINS: Record<Network, Chain> = {
  mainnet,
  sepolia,
  optimism,
  arbitrum,
  base,
};

export class ClawletWallet {
  private walletClient: WalletClient<Transport, Chain, Account>;
  private publicClient: PublicClient<Transport, Chain>;
  private config: ClawletConfig;
  private eventHandlers: Set<ClawletEventHandler> = new Set();
  private guardrailState: GuardrailState = {
    txCountLastHour: 0,
    txCountLastDay: 0,
    lastTxTimestamp: 0,
    hourlyTxTimestamps: [],
    dailyTxTimestamps: [],
  };

  constructor(config: ClawletConfig) {
    this.config = config;
    const network = config.network ?? 'mainnet';
    const chain = CHAINS[network];
    const networkConfig = getNetworkConfig(network);
    const rpcUrl = config.rpcUrl ?? networkConfig.rpcUrl;

    // Create account from private key or mnemonic
    let account: Account;
    if (config.privateKey) {
      account = privateKeyToAccount(config.privateKey as Hex);
    } else if (config.mnemonic) {
      account = mnemonicToAccount(config.mnemonic, {
        path: config.hdPath as `m/44'/60'/${string}`,
      });
    } else {
      throw new Error('Either privateKey or mnemonic must be provided');
    }

    this.walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
  }

  /**
   * Generate a new wallet with a random mnemonic
   */
  static generate(network: Network = 'mainnet'): {
    wallet: ClawletWallet;
    mnemonic: string;
    address: Address;
  } {
    const mnemonic = generateMnemonic(wordlist, 256);
    const wallet = new ClawletWallet({ mnemonic, network });
    return {
      wallet,
      mnemonic,
      address: wallet.getAddress(),
    };
  }

  /**
   * Create wallet from existing private key
   */
  static fromPrivateKey(privateKey: Hex, network: Network = 'mainnet'): ClawletWallet {
    return new ClawletWallet({ privateKey, network });
  }

  /**
   * Create wallet from mnemonic phrase
   */
  static fromMnemonic(
    mnemonic: string,
    network: Network = 'mainnet',
    hdPath: string = "m/44'/60'/0'/0/0"
  ): ClawletWallet {
    return new ClawletWallet({ mnemonic, network, hdPath });
  }

  /**
   * Derive multiple accounts from mnemonic
   */
  static deriveAccounts(
    mnemonic: string,
    count: number = 5,
    network: Network = 'mainnet'
  ): Array<{ wallet: ClawletWallet; address: Address; index: number }> {
    const accounts: Array<{ wallet: ClawletWallet; address: Address; index: number }> = [];

    for (let i = 0; i < count; i++) {
      const hdPath = `m/44'/60'/0'/0/${i}`;
      const wallet = new ClawletWallet({ mnemonic, network, hdPath });
      accounts.push({
        wallet,
        address: wallet.getAddress(),
        index: i,
      });
    }

    return accounts;
  }

  /**
   * Get wallet address
   */
  getAddress(): Address {
    return this.walletClient.account.address;
  }

  /**
   * Get current network
   */
  getNetwork(): Network {
    return this.config.network ?? 'mainnet';
  }

  /**
   * Get chain ID
   */
  getChainId(): number {
    return this.publicClient.chain?.id ?? 1;
  }

  /**
   * Get ETH balance
   */
  async getBalance(): Promise<bigint> {
    return this.publicClient.getBalance({
      address: this.getAddress(),
    });
  }

  /**
   * Get formatted ETH balance
   */
  async getFormattedBalance(): Promise<string> {
    const balance = await this.getBalance();
    return formatEther(balance);
  }

  /**
   * Get ERC-20 token balance
   */
  async getTokenBalance(tokenAddress: Address): Promise<TokenBalance> {
    const [balance, name, symbol, decimals] = await Promise.all([
      this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [this.getAddress()],
      }),
      this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'name',
      }),
      this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      this.publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ]);

    const formattedBalance = (Number(balance) / Math.pow(10, decimals)).toString();

    return {
      token: tokenAddress,
      symbol,
      name,
      decimals,
      balance,
      formattedBalance,
    };
  }

  /**
   * Check guardrails before transaction
   */
  private checkGuardrails(value: bigint): GuardrailCheckResult {
    const guardrails = this.config.guardrails;
    if (!guardrails) {
      return { allowed: true, requiresApproval: false };
    }

    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    // Clean up old timestamps
    this.guardrailState.hourlyTxTimestamps = this.guardrailState.hourlyTxTimestamps.filter(
      (t) => t > oneHourAgo
    );
    this.guardrailState.dailyTxTimestamps = this.guardrailState.dailyTxTimestamps.filter(
      (t) => t > oneDayAgo
    );

    // Check transaction limits
    if (
      guardrails.maxTxPerHour &&
      this.guardrailState.hourlyTxTimestamps.length >= guardrails.maxTxPerHour
    ) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Hourly transaction limit (${guardrails.maxTxPerHour}) exceeded`,
      };
    }

    if (
      guardrails.maxTxPerDay &&
      this.guardrailState.dailyTxTimestamps.length >= guardrails.maxTxPerDay
    ) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Daily transaction limit (${guardrails.maxTxPerDay}) exceeded`,
      };
    }

    // Check max transaction value
    if (guardrails.maxTxValueWei && value > guardrails.maxTxValueWei) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Transaction value exceeds maximum (${formatEther(guardrails.maxTxValueWei)} ETH)`,
      };
    }

    // Check if approval is required (above auto-approve threshold)
    if (guardrails.autoApproveThresholdWei && value > guardrails.autoApproveThresholdWei) {
      return {
        allowed: true,
        requiresApproval: true,
        reason: `Transaction value exceeds auto-approve threshold (${formatEther(guardrails.autoApproveThresholdWei)} ETH)`,
      };
    }

    return { allowed: true, requiresApproval: false };
  }

  /**
   * Check if recipient is allowed by guardrails
   */
  private isRecipientAllowed(recipient: Address): boolean {
    const guardrails = this.config.guardrails;
    if (!guardrails) return true;

    const recipientLower = recipient.toLowerCase();

    // Check blocklist
    if (guardrails.blockedRecipients?.some((r) => r.toLowerCase() === recipientLower)) {
      return false;
    }

    // Check allowlist (if defined, only allowed addresses can receive)
    if (guardrails.allowedRecipients && guardrails.allowedRecipients.length > 0) {
      return guardrails.allowedRecipients.some((r) => r.toLowerCase() === recipientLower);
    }

    return true;
  }

  /**
   * Send ETH transaction
   */
  async sendTransaction(request: TransactionRequest): Promise<TransactionResult> {
    const value = request.value ?? 0n;

    // Check recipient allowlist/blocklist
    if (!this.isRecipientAllowed(request.to)) {
      throw new Error(`Recipient ${request.to} is not allowed by guardrails`);
    }

    // Check guardrails
    const guardrailCheck = this.checkGuardrails(value);
    if (!guardrailCheck.allowed) {
      this.emitEvent({ type: 'guardrail_triggered', reason: guardrailCheck.reason! });
      throw new Error(guardrailCheck.reason);
    }

    // Send transaction
    const hash = await this.walletClient.sendTransaction({
      to: request.to,
      value,
      data: request.data,
      gas: request.gasLimit,
      maxFeePerGas: request.maxFeePerGas,
      maxPriorityFeePerGas: request.maxPriorityFeePerGas,
      nonce: request.nonce,
    });

    // Update guardrail state
    const now = Date.now();
    this.guardrailState.hourlyTxTimestamps.push(now);
    this.guardrailState.dailyTxTimestamps.push(now);
    this.guardrailState.lastTxTimestamp = now;

    // Emit event
    this.emitEvent({
      type: 'payment_sent',
      to: request.to,
      amount: value,
      hash,
    });

    return {
      hash,
      from: this.getAddress(),
      to: request.to,
      value,
      status: 'pending',
    };
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(hash: Hash): Promise<TransactionResult> {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      from: this.getAddress(),
      to: receipt.to ?? ('0x0' as Address),
      value: 0n,
      blockNumber: receipt.blockNumber,
      status: receipt.status === 'success' ? 'confirmed' : 'failed',
      gasUsed: receipt.gasUsed,
    };
  }

  /**
   * Send ETH to an address
   */
  async send(to: Address, amountEth: string): Promise<TransactionResult> {
    const value = parseEther(amountEth);
    return this.sendTransaction({ to, value });
  }

  /**
   * Transfer ERC-20 tokens
   */
  async transferToken(
    tokenAddress: Address,
    to: Address,
    amount: bigint
  ): Promise<TransactionResult> {
    // Check recipient allowlist/blocklist
    if (!this.isRecipientAllowed(to)) {
      throw new Error(`Recipient ${to} is not allowed by guardrails`);
    }

    const hash = await this.walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [to, amount],
    });

    // Emit event
    this.emitEvent({
      type: 'token_sent',
      token: tokenAddress,
      to,
      amount,
      hash,
    });

    return {
      hash,
      from: this.getAddress(),
      to: tokenAddress,
      value: 0n,
      status: 'pending',
    };
  }

  /**
   * Approve ERC-20 token spending
   */
  async approveToken(tokenAddress: Address, spender: Address, amount: bigint): Promise<Hash> {
    return this.walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender, amount],
    });
  }

  /**
   * Sign a message
   */
  async signMessage(message: string): Promise<Hex> {
    return this.walletClient.signMessage({
      message,
    });
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(typedData: Parameters<typeof this.walletClient.signTypedData>[0]): Promise<Hex> {
    return this.walletClient.signTypedData(typedData);
  }

  /**
   * Get current nonce
   */
  async getNonce(): Promise<number> {
    return this.publicClient.getTransactionCount({
      address: this.getAddress(),
    });
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(request: TransactionRequest): Promise<bigint> {
    return this.publicClient.estimateGas({
      account: this.walletClient.account,
      to: request.to,
      value: request.value,
      data: request.data,
    });
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    return this.publicClient.getGasPrice();
  }

  /**
   * Subscribe to events
   */
  on(handler: ClawletEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Emit event to all handlers
   */
  private emitEvent(event: ClawletEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Event handler error:', error);
      }
    }
  }

  /**
   * Get the public client for advanced queries
   */
  getPublicClient(): PublicClient<Transport, Chain> {
    return this.publicClient;
  }

  /**
   * Get the wallet client for advanced operations
   */
  getWalletClient(): WalletClient<Transport, Chain, Account> {
    return this.walletClient;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ClawletConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ClawletConfig {
    return { ...this.config };
  }
}

/**
 * ClawletVault SDK
 *
 * TypeScript SDK for interacting with the ClawletVault smart contract.
 * Provides both owner and agent functionality.
 */

import {
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Transport,
  type Account,
  createPublicClient,
  http,
  parseEther,
  formatEther,
} from 'viem';
import { mainnet, sepolia, base, optimism, arbitrum } from 'viem/chains';

import { CLAWLET_VAULT_ABI } from './abi.js';
import { getVaultAddress, isVaultDeployed } from './addresses.js';
import type {
  Vault,
  VaultSummary,
  CreateVaultParams,
  CreateVaultResult,
  AgentSendParams,
  AgentSendTokenParams,
  VaultTxResult,
  EmergencyDrainResult,
  ClawletVaultSDKConfig,
} from './types.js';
import { ERC20_ABI } from '../constants/erc8004.js';

// Chain mapping
const CHAINS = {
  mainnet,
  sepolia,
  base,
  optimism,
  arbitrum,
} as const;

/**
 * ClawletVault SDK
 *
 * @example
 * ```ts
 * // Owner creates vault
 * const sdk = new ClawletVaultSDK({ network: 'base' }, ownerWalletClient);
 * const { vaultId } = await sdk.createVault({
 *   agentAddress: '0xAgent...',
 *   dailyLimitEth: '0.5',
 *   perTxLimitEth: '0.1',
 *   initialFundingEth: '2.0',
 * });
 *
 * // Agent uses vault
 * const agentSdk = new ClawletVaultSDK({ network: 'base' }, agentWalletClient);
 * const myVault = await agentSdk.getMyVault();
 * await agentSdk.agentSend({
 *   vaultId: myVault,
 *   to: '0xRecipient',
 *   amountEth: '0.05',
 *   memo: 'Task payment',
 * });
 * ```
 */
export class ClawletVaultSDK {
  private publicClient: PublicClient;
  private walletClient: WalletClient<Transport, Chain, Account> | null = null;
  private contractAddress: Address;
  private chain: Chain;

  constructor(
    config: ClawletVaultSDKConfig,
    walletClient?: WalletClient<Transport, Chain, Account>
  ) {
    this.chain = CHAINS[config.network];

    // Set up public client
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.rpcUrl),
    });

    // Set wallet client if provided
    if (walletClient) {
      this.walletClient = walletClient;
    }

    // Get contract address
    if (config.contractAddress) {
      this.contractAddress = config.contractAddress;
    } else if (isVaultDeployed(config.network)) {
      this.contractAddress = getVaultAddress(config.network);
    } else {
      throw new Error(`ClawletVault not deployed on ${config.network}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WALLET CLIENT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set wallet client for write operations
   */
  setWalletClient(walletClient: WalletClient<Transport, Chain, Account>): void {
    this.walletClient = walletClient;
  }

  /**
   * Get the connected wallet address
   */
  getAddress(): Address | null {
    return this.walletClient?.account?.address ?? null;
  }

  private ensureWalletClient(): WalletClient<Transport, Chain, Account> {
    if (!this.walletClient) {
      throw new Error('Wallet client not set. Call setWalletClient() first.');
    }
    return this.walletClient;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VAULT CREATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a new vault (owner operation)
   */
  async createVault(params: CreateVaultParams): Promise<CreateVaultResult> {
    const wallet = this.ensureWalletClient();

    const dailyLimit = parseEther(params.dailyLimitEth);
    const perTxLimit = parseEther(params.perTxLimitEth);
    const value = params.initialFundingEth ? parseEther(params.initialFundingEth) : 0n;

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'createVault',
      args: [params.agentAddress, dailyLimit, perTxLimit],
      value,
    });

    // Wait for confirmation and get vault ID from event
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Parse VaultCreated event to get vault ID
    const vaultCreatedLog = receipt.logs.find((log) => {
      try {
        // VaultCreated topic
        return log.topics[0] === '0x...'; // Will be filled by actual topic hash
      } catch {
        return false;
      }
    });

    // Get vault ID from logs (first indexed param after event signature)
    const vaultId = vaultCreatedLog?.topics[1]
      ? BigInt(vaultCreatedLog.topics[1])
      : await this.getVaultByAgent(params.agentAddress);

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNDING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Deposit ETH to a vault
   */
  async deposit(vaultId: bigint, amountEth: string): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'deposit',
      args: [vaultId],
      value: parseEther(amountEth),
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  /**
   * Deposit ERC20 tokens to a vault
   * @note Caller must approve tokens first
   */
  async depositToken(
    vaultId: bigint,
    token: Address,
    amount: bigint
  ): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    // Check allowance
    const allowance = await this.publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [wallet.account.address, this.contractAddress],
    });

    if (allowance < amount) {
      // Approve if needed
      const approveHash = await wallet.writeContract({
        address: token,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [this.contractAddress, amount],
      });
      await this.publicClient.waitForTransactionReceipt({ hash: approveHash });
    }

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'depositToken',
      args: [vaultId, token, amount],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get vault ID for the connected agent
   */
  async getMyVault(): Promise<bigint> {
    const address = this.getAddress();
    if (!address) {
      throw new Error('No wallet connected');
    }
    return this.getVaultByAgent(address);
  }

  /**
   * Agent sends ETH (respects limits)
   */
  async agentSend(params: AgentSendParams): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'agentSend',
      args: [params.vaultId, params.to, parseEther(params.amountEth), params.memo ?? ''],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId: params.vaultId,
      success: receipt.status === 'success',
    };
  }

  /**
   * Agent sends ERC20 tokens
   */
  async agentSendToken(params: AgentSendTokenParams): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'agentSendToken',
      args: [params.vaultId, params.token, params.to, params.amount],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId: params.vaultId,
      success: receipt.status === 'success',
    };
  }

  /**
   * Get remaining daily allowance
   */
  async getRemainingAllowance(vaultId: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'getRemainingAllowance',
      args: [vaultId],
    }) as Promise<bigint>;
  }

  /**
   * Get remaining allowance formatted as ETH string
   */
  async getRemainingAllowanceEth(vaultId: bigint): Promise<string> {
    const remaining = await this.getRemainingAllowance(vaultId);
    return formatEther(remaining);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OWNER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Owner withdraws ETH (no limits)
   */
  async ownerWithdraw(vaultId: bigint, amountEth: string): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'ownerWithdraw',
      args: [vaultId, parseEther(amountEth)],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  /**
   * Owner withdraws all ETH
   */
  async ownerWithdrawAll(vaultId: bigint): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'ownerWithdrawAll',
      args: [vaultId],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  /**
   * Owner withdraws ERC20 tokens
   */
  async ownerWithdrawToken(
    vaultId: bigint,
    token: Address,
    amount: bigint
  ): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'ownerWithdrawToken',
      args: [vaultId, token, amount],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KILLSWITCH FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Pause vault - immediately stop agent transactions
   */
  async pause(vaultId: bigint): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'pause',
      args: [vaultId],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  /**
   * Unpause vault - resume agent transactions
   */
  async unpause(vaultId: bigint): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'unpause',
      args: [vaultId],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  /**
   * Revoke agent - remove agent access completely
   */
  async revokeAgent(vaultId: bigint): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'revokeAgent',
      args: [vaultId],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  /**
   * Emergency drain - withdraw everything to owner
   */
  async emergencyDrain(
    vaultId: bigint,
    tokens: Address[] = []
  ): Promise<EmergencyDrainResult> {
    const wallet = this.ensureWalletClient();

    // Get current balance before drain
    const vault = await this.getVault(vaultId);

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'emergencyDrain',
      args: [vaultId, tokens],
    });

    await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      ethDrained: vault.ethBalance,
      tokensDrained: tokens,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Change agent address
   */
  async setAgent(vaultId: bigint, newAgent: Address): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'setAgent',
      args: [vaultId, newAgent],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  /**
   * Update spending limits
   */
  async setLimits(
    vaultId: bigint,
    dailyLimitEth: string,
    perTxLimitEth: string
  ): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'setLimits',
      args: [vaultId, parseEther(dailyLimitEth), parseEther(perTxLimitEth)],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  /**
   * Add/remove address from whitelist
   */
  async setWhitelist(
    vaultId: bigint,
    addr: Address,
    allowed: boolean
  ): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'setWhitelist',
      args: [vaultId, addr, allowed],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  /**
   * Enable/disable whitelist enforcement
   */
  async setWhitelistEnabled(vaultId: bigint, enabled: boolean): Promise<VaultTxResult> {
    const wallet = this.ensureWalletClient();

    const hash = await wallet.writeContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'setWhitelistEnabled',
      args: [vaultId, enabled],
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      vaultId,
      success: receipt.status === 'success',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get vault details
   */
  async getVault(vaultId: bigint): Promise<Vault> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'getVault',
      args: [vaultId],
    });

    // Cast the tuple to Vault type
    const vault = result as unknown as {
      owner: Address;
      agent: Address;
      paused: boolean;
      ethBalance: bigint;
      dailyLimit: bigint;
      perTxLimit: bigint;
      spentToday: bigint;
      dayStartTime: bigint;
      whitelistEnabled: boolean;
      createdAt: bigint;
    };

    return vault;
  }

  /**
   * Get vault summary with formatted values
   */
  async getVaultSummary(vaultId: bigint): Promise<VaultSummary> {
    const vault = await this.getVault(vaultId);
    const remaining = await this.getRemainingAllowance(vaultId);

    return {
      id: vaultId,
      owner: vault.owner,
      agent: vault.agent,
      paused: vault.paused,
      ethBalanceEth: formatEther(vault.ethBalance),
      dailyLimitEth: formatEther(vault.dailyLimit),
      perTxLimitEth: formatEther(vault.perTxLimit),
      remainingAllowanceEth: formatEther(remaining),
      whitelistEnabled: vault.whitelistEnabled,
      createdAt: new Date(Number(vault.createdAt) * 1000),
    };
  }

  /**
   * Get all vaults owned by an address
   */
  async getVaultsByOwner(owner: Address): Promise<bigint[]> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'getVaultsByOwner',
      args: [owner],
    });

    return result as bigint[];
  }

  /**
   * Get vault ID for an agent
   */
  async getVaultByAgent(agent: Address): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'getVaultByAgent',
      args: [agent],
    });

    return result as bigint;
  }

  /**
   * Check if address is whitelisted
   */
  async isWhitelisted(vaultId: bigint, addr: Address): Promise<boolean> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'isWhitelisted',
      args: [vaultId, addr],
    });

    return result as boolean;
  }

  /**
   * Check if vault is paused
   */
  async isPaused(vaultId: bigint): Promise<boolean> {
    const vault = await this.getVault(vaultId);
    return vault.paused;
  }

  /**
   * Get token balance for a vault
   */
  async getTokenBalance(vaultId: bigint, token: Address): Promise<bigint> {
    const result = await this.publicClient.readContract({
      address: this.contractAddress,
      abi: CLAWLET_VAULT_ABI,
      functionName: 'getTokenBalance',
      args: [vaultId, token],
    });

    return result as bigint;
  }

  /**
   * Get the contract address being used
   */
  getContractAddress(): Address {
    return this.contractAddress;
  }
}

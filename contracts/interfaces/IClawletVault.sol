// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IClawletVault
 * @notice Interface for the ClawletVault contract - on-chain agent wallet management
 * @dev Implements singleton pattern where one contract manages multiple agent vaults
 */
interface IClawletVault {
    // ═══════════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ═══════════════════════════════════════════════════════════════════════════

    struct Vault {
        address owner;           // Human operator (immutable after creation)
        address agent;           // AI agent address (owner can change)
        bool paused;             // Killswitch state
        uint256 ethBalance;      // ETH held for this vault
        uint256 dailyLimit;      // Max ETH per 24 hours
        uint256 perTxLimit;      // Max ETH per transaction
        uint256 spentToday;      // Tracking for daily limit
        uint256 dayStartTime;    // When current day started
        bool whitelistEnabled;   // Enforce recipient whitelist?
        uint256 createdAt;       // Vault creation timestamp
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════

    event VaultCreated(uint256 indexed vaultId, address indexed owner, address indexed agent);
    event Deposited(uint256 indexed vaultId, address indexed from, uint256 amount);
    event TokenDeposited(uint256 indexed vaultId, address indexed token, address indexed from, uint256 amount);
    event AgentSent(uint256 indexed vaultId, address indexed to, uint256 amount, string memo);
    event AgentSentToken(uint256 indexed vaultId, address indexed token, address indexed to, uint256 amount);
    event OwnerWithdrew(uint256 indexed vaultId, address indexed to, uint256 amount);
    event OwnerWithdrewToken(uint256 indexed vaultId, address indexed token, address indexed to, uint256 amount);
    event VaultPaused(uint256 indexed vaultId);
    event VaultUnpaused(uint256 indexed vaultId);
    event AgentRevoked(uint256 indexed vaultId, address indexed oldAgent);
    event AgentChanged(uint256 indexed vaultId, address indexed oldAgent, address indexed newAgent);
    event LimitsUpdated(uint256 indexed vaultId, uint256 dailyLimit, uint256 perTxLimit);
    event WhitelistUpdated(uint256 indexed vaultId, address indexed addr, bool allowed);
    event WhitelistToggled(uint256 indexed vaultId, bool enabled);
    event EmergencyDrain(uint256 indexed vaultId, uint256 ethAmount);

    // ═══════════════════════════════════════════════════════════════════════════
    // VAULT CREATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new vault (anyone can create)
     * @param agent The AI agent address that will operate this vault
     * @param dailyLimit Maximum ETH the agent can spend per 24 hours
     * @param perTxLimit Maximum ETH the agent can spend per transaction
     * @return vaultId The ID of the newly created vault
     */
    function createVault(
        address agent,
        uint256 dailyLimit,
        uint256 perTxLimit
    ) external payable returns (uint256 vaultId);

    // ═══════════════════════════════════════════════════════════════════════════
    // FUNDING
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Deposit ETH to a vault (anyone can fund)
     * @param vaultId The vault to deposit into
     */
    function deposit(uint256 vaultId) external payable;

    /**
     * @notice Deposit ERC20 tokens to a vault
     * @param vaultId The vault to deposit into
     * @param token The ERC20 token address
     * @param amount The amount of tokens to deposit
     */
    function depositToken(uint256 vaultId, address token, uint256 amount) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // AGENT FUNCTIONS (Limited)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Agent sends ETH (checks limits, whitelist, pause)
     * @param vaultId The vault to send from
     * @param to Recipient address
     * @param amount Amount of ETH to send (in wei)
     * @param memo Optional transaction memo
     */
    function agentSend(
        uint256 vaultId,
        address payable to,
        uint256 amount,
        string calldata memo
    ) external;

    /**
     * @notice Agent sends ERC20 tokens
     * @param vaultId The vault to send from
     * @param token The ERC20 token address
     * @param to Recipient address
     * @param amount Amount of tokens to send
     */
    function agentSendToken(
        uint256 vaultId,
        address token,
        address to,
        uint256 amount
    ) external;

    /**
     * @notice Get remaining daily allowance for a vault
     * @param vaultId The vault to check
     * @return The remaining ETH allowance for today
     */
    function getRemainingAllowance(uint256 vaultId) external view returns (uint256);

    // ═══════════════════════════════════════════════════════════════════════════
    // OWNER FUNCTIONS (Unrestricted)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Owner withdraws ETH (no limits)
     * @param vaultId The vault to withdraw from
     * @param amount Amount to withdraw
     */
    function ownerWithdraw(uint256 vaultId, uint256 amount) external;

    /**
     * @notice Owner withdraws all ETH
     * @param vaultId The vault to withdraw from
     */
    function ownerWithdrawAll(uint256 vaultId) external;

    /**
     * @notice Owner withdraws ERC20 tokens
     * @param vaultId The vault to withdraw from
     * @param token The ERC20 token address
     * @param amount Amount to withdraw
     */
    function ownerWithdrawToken(uint256 vaultId, address token, uint256 amount) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // KILLSWITCH FUNCTIONS (Owner Only)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice PAUSE - Immediately stop agent transactions
     * @param vaultId The vault to pause
     */
    function pause(uint256 vaultId) external;

    /**
     * @notice UNPAUSE - Resume agent transactions
     * @param vaultId The vault to unpause
     */
    function unpause(uint256 vaultId) external;

    /**
     * @notice REVOKE - Remove agent access completely
     * @param vaultId The vault to revoke agent from
     */
    function revokeAgent(uint256 vaultId) external;

    /**
     * @notice EMERGENCY DRAIN - Withdraw everything to owner
     * @param vaultId The vault to drain
     * @param tokens Array of token addresses to also drain
     */
    function emergencyDrain(uint256 vaultId, address[] calldata tokens) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION (Owner Only)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Change agent address
     * @param vaultId The vault to update
     * @param newAgent The new agent address
     */
    function setAgent(uint256 vaultId, address newAgent) external;

    /**
     * @notice Update spending limits
     * @param vaultId The vault to update
     * @param dailyLimit New daily limit
     * @param perTxLimit New per-transaction limit
     */
    function setLimits(uint256 vaultId, uint256 dailyLimit, uint256 perTxLimit) external;

    /**
     * @notice Add/remove from whitelist
     * @param vaultId The vault to update
     * @param addr Address to whitelist/unwhitelist
     * @param allowed Whether address is allowed
     */
    function setWhitelist(uint256 vaultId, address addr, bool allowed) external;

    /**
     * @notice Enable/disable whitelist enforcement
     * @param vaultId The vault to update
     * @param enabled Whether whitelist is enforced
     */
    function setWhitelistEnabled(uint256 vaultId, bool enabled) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice Get vault details
     * @param vaultId The vault to query
     * @return The vault struct
     */
    function getVault(uint256 vaultId) external view returns (Vault memory);

    /**
     * @notice Get all vaults owned by an address
     * @param owner The owner address
     * @return Array of vault IDs
     */
    function getVaultsByOwner(address owner) external view returns (uint256[] memory);

    /**
     * @notice Get vault ID for an agent
     * @param agent The agent address
     * @return The vault ID (0 if none)
     */
    function getVaultByAgent(address agent) external view returns (uint256);

    /**
     * @notice Check if address is whitelisted for a vault
     * @param vaultId The vault to check
     * @param addr Address to check
     * @return Whether address is whitelisted
     */
    function isWhitelisted(uint256 vaultId, address addr) external view returns (bool);

    /**
     * @notice Get token balance for a vault
     * @param vaultId The vault to query
     * @param token The token address
     * @return The token balance
     */
    function getTokenBalance(uint256 vaultId, address token) external view returns (uint256);
}

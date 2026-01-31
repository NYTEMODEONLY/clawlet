// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IClawletVault} from "./interfaces/IClawletVault.sol";

/**
 * @title ClawletVault
 * @author nytemode
 * @notice Singleton smart contract for managing AI agent wallets with on-chain security
 * @dev Implements spending limits, whitelists, and killswitch functionality enforced at the contract level
 *
 * Key security properties:
 * - Owner is immutable after vault creation (no setOwner function)
 * - All limits are enforced on-chain (agent cannot bypass)
 * - Owner can always pause/drain regardless of agent actions
 * - Reentrancy protected on all external calls
 */
contract ClawletVault is IClawletVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // STORAGE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Main vault storage
    mapping(uint256 => Vault) public vaults;

    /// @notice Whitelist per vault: vaultId => address => allowed
    mapping(uint256 => mapping(address => bool)) public whitelists;

    /// @notice Token balances per vault: vaultId => token => balance
    mapping(uint256 => mapping(address => uint256)) public tokenBalances;

    /// @notice Owner to vault IDs mapping
    mapping(address => uint256[]) public ownerVaults;

    /// @notice Agent to vault ID mapping (1 agent = 1 vault)
    mapping(address => uint256) public agentToVault;

    /// @notice Next vault ID (starts at 1, 0 means no vault)
    uint256 public nextVaultId = 1;

    // ═══════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyVaultOwner(uint256 vaultId) {
        require(vaults[vaultId].owner == msg.sender, "ClawletVault: not vault owner");
        _;
    }

    modifier onlyVaultAgent(uint256 vaultId) {
        require(vaults[vaultId].agent == msg.sender, "ClawletVault: not vault agent");
        require(!vaults[vaultId].paused, "ClawletVault: vault is paused");
        _;
    }

    modifier vaultExists(uint256 vaultId) {
        require(vaults[vaultId].owner != address(0), "ClawletVault: vault does not exist");
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VAULT CREATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IClawletVault
    function createVault(
        address agent,
        uint256 dailyLimit,
        uint256 perTxLimit
    ) external payable returns (uint256 vaultId) {
        require(agent != address(0), "ClawletVault: invalid agent address");
        require(agentToVault[agent] == 0, "ClawletVault: agent already has vault");
        require(perTxLimit <= dailyLimit, "ClawletVault: perTx exceeds daily limit");

        vaultId = nextVaultId++;

        vaults[vaultId] = Vault({
            owner: msg.sender,
            agent: agent,
            paused: false,
            ethBalance: msg.value,
            dailyLimit: dailyLimit,
            perTxLimit: perTxLimit,
            spentToday: 0,
            dayStartTime: block.timestamp,
            whitelistEnabled: false,
            createdAt: block.timestamp
        });

        ownerVaults[msg.sender].push(vaultId);
        agentToVault[agent] = vaultId;

        emit VaultCreated(vaultId, msg.sender, agent);

        if (msg.value > 0) {
            emit Deposited(vaultId, msg.sender, msg.value);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FUNDING
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IClawletVault
    function deposit(uint256 vaultId) external payable vaultExists(vaultId) {
        require(msg.value > 0, "ClawletVault: zero deposit");
        vaults[vaultId].ethBalance += msg.value;
        emit Deposited(vaultId, msg.sender, msg.value);
    }

    /// @inheritdoc IClawletVault
    function depositToken(
        uint256 vaultId,
        address token,
        uint256 amount
    ) external vaultExists(vaultId) {
        require(amount > 0, "ClawletVault: zero deposit");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        tokenBalances[vaultId][token] += amount;
        emit TokenDeposited(vaultId, token, msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // AGENT FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IClawletVault
    function agentSend(
        uint256 vaultId,
        address payable to,
        uint256 amount,
        string calldata memo
    ) external nonReentrant vaultExists(vaultId) onlyVaultAgent(vaultId) {
        Vault storage vault = vaults[vaultId];

        // Check whitelist if enabled
        if (vault.whitelistEnabled) {
            require(whitelists[vaultId][to], "ClawletVault: recipient not whitelisted");
        }

        // Check per-transaction limit
        require(amount <= vault.perTxLimit, "ClawletVault: exceeds per-tx limit");

        // Reset daily tracking if new day
        if (block.timestamp >= vault.dayStartTime + 1 days) {
            vault.spentToday = 0;
            vault.dayStartTime = block.timestamp;
        }

        // Check daily limit
        require(vault.spentToday + amount <= vault.dailyLimit, "ClawletVault: exceeds daily limit");

        // Check balance
        require(vault.ethBalance >= amount, "ClawletVault: insufficient balance");

        // Update state before external call (checks-effects-interactions)
        vault.ethBalance -= amount;
        vault.spentToday += amount;

        // Transfer ETH
        (bool success, ) = to.call{value: amount}("");
        require(success, "ClawletVault: ETH transfer failed");

        emit AgentSent(vaultId, to, amount, memo);
    }

    /// @inheritdoc IClawletVault
    function agentSendToken(
        uint256 vaultId,
        address token,
        address to,
        uint256 amount
    ) external nonReentrant vaultExists(vaultId) onlyVaultAgent(vaultId) {
        Vault storage vault = vaults[vaultId];

        // Check whitelist if enabled
        if (vault.whitelistEnabled) {
            require(whitelists[vaultId][to], "ClawletVault: recipient not whitelisted");
        }

        // Check token balance
        require(tokenBalances[vaultId][token] >= amount, "ClawletVault: insufficient token balance");

        // Update state before external call
        tokenBalances[vaultId][token] -= amount;

        // Transfer tokens
        IERC20(token).safeTransfer(to, amount);

        emit AgentSentToken(vaultId, token, to, amount);
    }

    /// @inheritdoc IClawletVault
    function getRemainingAllowance(uint256 vaultId) external view vaultExists(vaultId) returns (uint256) {
        Vault storage vault = vaults[vaultId];

        // If new day, return full daily limit
        if (block.timestamp >= vault.dayStartTime + 1 days) {
            return vault.dailyLimit;
        }

        // Otherwise return remaining
        if (vault.spentToday >= vault.dailyLimit) {
            return 0;
        }
        return vault.dailyLimit - vault.spentToday;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // OWNER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IClawletVault
    function ownerWithdraw(
        uint256 vaultId,
        uint256 amount
    ) external nonReentrant vaultExists(vaultId) onlyVaultOwner(vaultId) {
        Vault storage vault = vaults[vaultId];
        require(vault.ethBalance >= amount, "ClawletVault: insufficient balance");

        vault.ethBalance -= amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ClawletVault: ETH transfer failed");

        emit OwnerWithdrew(vaultId, msg.sender, amount);
    }

    /// @inheritdoc IClawletVault
    function ownerWithdrawAll(
        uint256 vaultId
    ) external nonReentrant vaultExists(vaultId) onlyVaultOwner(vaultId) {
        Vault storage vault = vaults[vaultId];
        uint256 amount = vault.ethBalance;
        require(amount > 0, "ClawletVault: no balance");

        vault.ethBalance = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ClawletVault: ETH transfer failed");

        emit OwnerWithdrew(vaultId, msg.sender, amount);
    }

    /// @inheritdoc IClawletVault
    function ownerWithdrawToken(
        uint256 vaultId,
        address token,
        uint256 amount
    ) external nonReentrant vaultExists(vaultId) onlyVaultOwner(vaultId) {
        require(tokenBalances[vaultId][token] >= amount, "ClawletVault: insufficient token balance");

        tokenBalances[vaultId][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit OwnerWithdrewToken(vaultId, token, msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // KILLSWITCH FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IClawletVault
    function pause(uint256 vaultId) external vaultExists(vaultId) onlyVaultOwner(vaultId) {
        vaults[vaultId].paused = true;
        emit VaultPaused(vaultId);
    }

    /// @inheritdoc IClawletVault
    function unpause(uint256 vaultId) external vaultExists(vaultId) onlyVaultOwner(vaultId) {
        vaults[vaultId].paused = false;
        emit VaultUnpaused(vaultId);
    }

    /// @inheritdoc IClawletVault
    function revokeAgent(uint256 vaultId) external vaultExists(vaultId) onlyVaultOwner(vaultId) {
        Vault storage vault = vaults[vaultId];
        address oldAgent = vault.agent;

        // Remove agent mapping
        delete agentToVault[oldAgent];

        // Set agent to zero address
        vault.agent = address(0);
        vault.paused = true;

        emit AgentRevoked(vaultId, oldAgent);
    }

    /// @inheritdoc IClawletVault
    function emergencyDrain(
        uint256 vaultId,
        address[] calldata tokens
    ) external nonReentrant vaultExists(vaultId) onlyVaultOwner(vaultId) {
        Vault storage vault = vaults[vaultId];

        // Pause vault
        vault.paused = true;

        // Drain ETH
        uint256 ethAmount = vault.ethBalance;
        if (ethAmount > 0) {
            vault.ethBalance = 0;
            (bool success, ) = payable(msg.sender).call{value: ethAmount}("");
            require(success, "ClawletVault: ETH transfer failed");
        }

        // Drain tokens
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 tokenAmount = tokenBalances[vaultId][tokens[i]];
            if (tokenAmount > 0) {
                tokenBalances[vaultId][tokens[i]] = 0;
                IERC20(tokens[i]).safeTransfer(msg.sender, tokenAmount);
            }
        }

        emit EmergencyDrain(vaultId, ethAmount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IClawletVault
    function setAgent(
        uint256 vaultId,
        address newAgent
    ) external vaultExists(vaultId) onlyVaultOwner(vaultId) {
        require(newAgent != address(0), "ClawletVault: invalid agent address");
        require(agentToVault[newAgent] == 0, "ClawletVault: agent already has vault");

        Vault storage vault = vaults[vaultId];
        address oldAgent = vault.agent;

        // Update mappings
        if (oldAgent != address(0)) {
            delete agentToVault[oldAgent];
        }
        agentToVault[newAgent] = vaultId;
        vault.agent = newAgent;

        emit AgentChanged(vaultId, oldAgent, newAgent);
    }

    /// @inheritdoc IClawletVault
    function setLimits(
        uint256 vaultId,
        uint256 dailyLimit,
        uint256 perTxLimit
    ) external vaultExists(vaultId) onlyVaultOwner(vaultId) {
        require(perTxLimit <= dailyLimit, "ClawletVault: perTx exceeds daily limit");

        Vault storage vault = vaults[vaultId];
        vault.dailyLimit = dailyLimit;
        vault.perTxLimit = perTxLimit;

        emit LimitsUpdated(vaultId, dailyLimit, perTxLimit);
    }

    /// @inheritdoc IClawletVault
    function setWhitelist(
        uint256 vaultId,
        address addr,
        bool allowed
    ) external vaultExists(vaultId) onlyVaultOwner(vaultId) {
        whitelists[vaultId][addr] = allowed;
        emit WhitelistUpdated(vaultId, addr, allowed);
    }

    /// @inheritdoc IClawletVault
    function setWhitelistEnabled(
        uint256 vaultId,
        bool enabled
    ) external vaultExists(vaultId) onlyVaultOwner(vaultId) {
        vaults[vaultId].whitelistEnabled = enabled;
        emit WhitelistToggled(vaultId, enabled);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IClawletVault
    function getVault(uint256 vaultId) external view returns (Vault memory) {
        return vaults[vaultId];
    }

    /// @inheritdoc IClawletVault
    function getVaultsByOwner(address owner) external view returns (uint256[] memory) {
        return ownerVaults[owner];
    }

    /// @inheritdoc IClawletVault
    function getVaultByAgent(address agent) external view returns (uint256) {
        return agentToVault[agent];
    }

    /// @inheritdoc IClawletVault
    function isWhitelisted(uint256 vaultId, address addr) external view returns (bool) {
        return whitelists[vaultId][addr];
    }

    /// @inheritdoc IClawletVault
    function getTokenBalance(uint256 vaultId, address token) external view returns (uint256) {
        return tokenBalances[vaultId][token];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RECEIVE
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Reject direct ETH transfers (must use deposit function)
    receive() external payable {
        revert("ClawletVault: use deposit()");
    }
}

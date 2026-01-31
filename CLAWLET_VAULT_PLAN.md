# ClawletVault Implementation Plan

## Overview

A **single smart contract** that manages multiple agent wallets. Users interact with one contract address, but each agent has isolated funds and settings.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ClawletVault Contract                         │
│                    (Single Deployment)                           │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Vault #1   │  │  Vault #2   │  │  Vault #3   │  ...         │
│  │             │  │             │  │             │              │
│  │ Owner: 0xA  │  │ Owner: 0xB  │  │ Owner: 0xC  │              │
│  │ Agent: 0x1  │  │ Agent: 0x2  │  │ Agent: 0x3  │              │
│  │ Balance: 5Ξ │  │ Balance: 2Ξ │  │ Balance: 10Ξ│              │
│  │ Limit: 0.1Ξ │  │ Limit: 0.5Ξ │  │ Limit: 1Ξ  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  All funds held in this contract                                 │
│  Each vault is just a mapping entry                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Decision

### Why Single Contract (Singleton)?

| Aspect | Singleton (Recommended) | Factory (One per agent) |
|--------|------------------------|-------------------------|
| **Gas to create vault** | ~50k gas (storage write) | ~500k gas (deploy contract) |
| **Upgradability** | Easier (one contract) | Harder (many contracts) |
| **User experience** | One address to interact with | Each user has unique address |
| **Funds isolation** | Logical (via mappings) | Physical (separate contracts) |
| **Complexity** | Slightly higher | Simpler per-contract |
| **Audit cost** | One contract to audit | Same |

**Recommendation**: Singleton pattern for cost efficiency and simpler UX.

---

## Smart Contract Design

### Data Structures

```solidity
struct Vault {
    address owner;           // Human operator (can never be changed)
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

// Main storage
mapping(uint256 => Vault) public vaults;           // vaultId => Vault
mapping(uint256 => mapping(address => bool)) public whitelists;  // vaultId => address => allowed
mapping(uint256 => mapping(address => uint256)) public tokenBalances;  // vaultId => token => balance
mapping(address => uint256[]) public ownerVaults;  // owner => their vault IDs
mapping(address => uint256) public agentToVault;   // agent => their vault ID (1 agent = 1 vault)

uint256 public nextVaultId;  // Auto-incrementing ID
```

### Core Functions

```solidity
// ════════════════════════════════════════════════════════════════
// VAULT CREATION
// ════════════════════════════════════════════════════════════════

/// @notice Create a new vault (anyone can create)
function createVault(
    address agent,
    uint256 dailyLimit,
    uint256 perTxLimit
) external payable returns (uint256 vaultId);

// ════════════════════════════════════════════════════════════════
// FUNDING
// ════════════════════════════════════════════════════════════════

/// @notice Deposit ETH to a vault (anyone can fund)
function deposit(uint256 vaultId) external payable;

/// @notice Deposit ERC20 tokens to a vault
function depositToken(uint256 vaultId, address token, uint256 amount) external;

// ════════════════════════════════════════════════════════════════
// AGENT FUNCTIONS (Limited)
// ════════════════════════════════════════════════════════════════

/// @notice Agent sends ETH (checks limits, whitelist, pause)
function agentSend(
    uint256 vaultId,
    address payable to,
    uint256 amount,
    string calldata memo
) external;

/// @notice Agent sends ERC20 tokens
function agentSendToken(
    uint256 vaultId,
    address token,
    address to,
    uint256 amount
) external;

/// @notice Agent checks remaining daily allowance
function getRemainingAllowance(uint256 vaultId) external view returns (uint256);

// ════════════════════════════════════════════════════════════════
// OWNER FUNCTIONS (Unrestricted)
// ════════════════════════════════════════════════════════════════

/// @notice Owner withdraws ETH (no limits)
function ownerWithdraw(uint256 vaultId, uint256 amount) external;

/// @notice Owner withdraws all ETH
function ownerWithdrawAll(uint256 vaultId) external;

/// @notice Owner withdraws ERC20 tokens
function ownerWithdrawToken(uint256 vaultId, address token, uint256 amount) external;

// ════════════════════════════════════════════════════════════════
// KILLSWITCH FUNCTIONS (Owner Only)
// ════════════════════════════════════════════════════════════════

/// @notice PAUSE - Immediately stop agent transactions
function pause(uint256 vaultId) external;

/// @notice UNPAUSE - Resume agent transactions
function unpause(uint256 vaultId) external;

/// @notice REVOKE - Remove agent access completely
function revokeAgent(uint256 vaultId) external;

/// @notice EMERGENCY DRAIN - Withdraw everything to owner
function emergencyDrain(uint256 vaultId, address[] calldata tokens) external;

// ════════════════════════════════════════════════════════════════
// CONFIGURATION (Owner Only)
// ════════════════════════════════════════════════════════════════

/// @notice Change agent address
function setAgent(uint256 vaultId, address newAgent) external;

/// @notice Update spending limits
function setLimits(uint256 vaultId, uint256 dailyLimit, uint256 perTxLimit) external;

/// @notice Add/remove from whitelist
function setWhitelist(uint256 vaultId, address addr, bool allowed) external;

/// @notice Enable/disable whitelist enforcement
function setWhitelistEnabled(uint256 vaultId, bool enabled) external;

// ════════════════════════════════════════════════════════════════
// VIEW FUNCTIONS
// ════════════════════════════════════════════════════════════════

/// @notice Get vault details
function getVault(uint256 vaultId) external view returns (Vault memory);

/// @notice Get all vaults owned by an address
function getVaultsByOwner(address owner) external view returns (uint256[] memory);

/// @notice Get vault ID for an agent
function getVaultByAgent(address agent) external view returns (uint256);

/// @notice Check if address is whitelisted
function isWhitelisted(uint256 vaultId, address addr) external view returns (bool);
```

---

## User Flows

### 1. Owner Creates Vault

```
Human Owner                         ClawletVault Contract
     │                                      │
     │─── createVault(agent, limits) ──────►│
     │    + sends 1 ETH                     │
     │                                      │
     │◄─── returns vaultId: 42 ─────────────│
     │                                      │
     │    Vault #42 created:                │
     │    - owner: 0xHuman                  │
     │    - agent: 0xAgent                  │
     │    - balance: 1 ETH                  │
     │    - dailyLimit: 0.1 ETH             │
```

### 2. Agent Transacts

```
AI Agent                            ClawletVault Contract
     │                                      │
     │─── agentSend(42, recipient, 0.05) ──►│
     │                                      │
     │    Contract checks:                  │
     │    ✓ msg.sender == vault.agent       │
     │    ✓ !vault.paused                   │
     │    ✓ amount <= perTxLimit            │
     │    ✓ spentToday + amount <= daily    │
     │    ✓ recipient in whitelist (if on)  │
     │                                      │
     │◄─── success ─────────────────────────│
```

### 3. Owner Withdraws Earnings

```
Human Owner                         ClawletVault Contract
(from any device)                           │
     │                                      │
     │─── ownerWithdrawAll(42) ────────────►│
     │                                      │
     │    Contract checks:                  │
     │    ✓ msg.sender == vault.owner       │
     │                                      │
     │◄─── 5 ETH sent to owner ─────────────│
```

### 4. Emergency: Agent Goes Rogue

```
Human Owner                         ClawletVault Contract              Rogue Agent
     │                                      │                              │
     │                                      │◄── agentSend(42, attacker) ──│
     │                                      │    BLOCKED (paused or        │
     │─── pause(42) ───────────────────────►│     limits exceeded)         │
     │                                      │                              │
     │─── emergencyDrain(42, [tokens]) ────►│                              │
     │                                      │                              │
     │◄─── ALL funds sent to owner ─────────│                              │
     │                                      │                              │
     │    Agent is powerless.               │                              │
     │    Contract enforces rules.          │                              │
```

---

## SDK Integration

### New Module: `src/vault/`

```
src/vault/
├── ClawletVaultSDK.ts      # Main SDK class
├── abi.ts                   # Contract ABI
├── addresses.ts             # Deployed addresses per chain
└── types.ts                 # TypeScript types
```

### SDK Usage

```typescript
import { ClawletVaultSDK } from 'clawlet';

// ═══════════════════════════════════════════════════════════════
// OWNER: Create and manage vault
// ═══════════════════════════════════════════════════════════════

const ownerSDK = new ClawletVaultSDK({
  wallet: ownerWallet,  // Owner's Clawlet wallet
  network: 'mainnet',
});

// Create vault for agent
const vaultId = await ownerSDK.createVault({
  agentAddress: '0xAgent...',
  dailyLimitEth: '0.5',
  perTxLimitEth: '0.1',
  initialFundingEth: '2.0',
});

console.log(`Vault created: #${vaultId}`);

// Later: Withdraw earnings
await ownerSDK.ownerWithdrawAll(vaultId);

// Emergency: Kill agent
await ownerSDK.pause(vaultId);
await ownerSDK.emergencyDrain(vaultId);

// ═══════════════════════════════════════════════════════════════
// AGENT: Use vault for transactions
// ═══════════════════════════════════════════════════════════════

const agentSDK = new ClawletVaultSDK({
  wallet: agentWallet,  // Agent's Clawlet wallet
  network: 'mainnet',
});

// Find agent's vault
const vaultId = await agentSDK.getMyVault();

// Check allowance
const remaining = await agentSDK.getRemainingAllowance(vaultId);
console.log(`Can spend: ${remaining} ETH today`);

// Send payment (within limits)
await agentSDK.agentSend(vaultId, '0xRecipient', '0.05', 'Task payment');

// Check if paused (owner killed us?)
if (await agentSDK.isPaused(vaultId)) {
  console.log('Vault is paused by owner');
}
```

---

## Implementation Phases

### Phase 1: Smart Contract (Week 1)
- [ ] Write ClawletVault.sol
- [ ] Unit tests (Foundry/Hardhat)
- [ ] Local deployment testing
- [ ] Gas optimization

### Phase 2: SDK Integration (Week 1-2)
- [ ] Create `src/vault/` module
- [ ] ClawletVaultSDK class
- [ ] TypeScript types
- [ ] Integration tests

### Phase 3: Deployment (Week 2)
- [ ] Deploy to Sepolia testnet
- [ ] Test with real agents
- [ ] Deploy to mainnet
- [ ] Deploy to L2s (Base, Optimism, Arbitrum)

### Phase 4: CLI & Dashboard (Week 3)
- [ ] CLI commands: `clawlet vault create`, `vault withdraw`, etc.
- [ ] Simple web dashboard for owners
- [ ] Vault monitoring/alerts

### Phase 5: Audit & Hardening (Week 4+)
- [ ] Internal security review
- [ ] External audit (optional but recommended)
- [ ] Bug bounty program

---

## Deployed Contract Addresses

| Network | Address | Status |
|---------|---------|--------|
| Ethereum Mainnet | TBD | Not deployed |
| Sepolia Testnet | TBD | Not deployed |
| Base | TBD | Not deployed |
| Optimism | TBD | Not deployed |
| Arbitrum | TBD | Not deployed |

---

## Security Considerations

### Immutable Owner
```solidity
// Owner is set at vault creation and CANNOT be changed
// This is enforced by not having a setOwner() function
```

### Reentrancy Protection
```solidity
// Use OpenZeppelin's ReentrancyGuard
// Or checks-effects-interactions pattern
```

### Integer Overflow
```solidity
// Solidity 0.8+ has built-in overflow checks
```

### Access Control
```solidity
modifier onlyVaultOwner(uint256 vaultId) {
    require(vaults[vaultId].owner == msg.sender, "Not vault owner");
    _;
}

modifier onlyVaultAgent(uint256 vaultId) {
    require(vaults[vaultId].agent == msg.sender, "Not vault agent");
    require(!vaults[vaultId].paused, "Vault is paused");
    _;
}
```

---

## Gas Estimates

| Operation | Estimated Gas | Cost @ 30 gwei |
|-----------|---------------|----------------|
| Create vault | ~150,000 | ~$15 |
| Deposit ETH | ~50,000 | ~$5 |
| Agent send | ~80,000 | ~$8 |
| Owner withdraw | ~50,000 | ~$5 |
| Pause | ~30,000 | ~$3 |
| Emergency drain | ~100,000+ | ~$10+ |

*Note: L2s (Base, Optimism, Arbitrum) are ~10-100x cheaper*

---

## Questions to Resolve

1. **Vault IDs**: Use auto-increment or allow custom IDs?
2. **Multiple agents per vault**: Allow or enforce 1:1?
3. **Token limits**: Separate limits per token or just ETH?
4. **Time-locked withdrawals**: Add delay for large owner withdrawals?
5. **Vault recovery**: What if owner loses keys? (No recovery = more secure)
6. **Upgrade path**: Upgradeable proxy or immutable?

---

## Next Steps

1. **Review this plan** - Any changes needed?
2. **Resolve open questions** - Especially #6 (upgradeable?)
3. **Start Phase 1** - Write the smart contract
4. **Test on Sepolia** - Real-world testing
5. **Audit decision** - Professional audit or community review?

---

## File Structure After Implementation

```
clawlet/
├── contracts/                    # NEW: Solidity contracts
│   ├── ClawletVault.sol
│   ├── interfaces/
│   │   └── IClawletVault.sol
│   └── test/
│       └── ClawletVault.t.sol
│
├── src/
│   ├── vault/                    # NEW: Vault SDK
│   │   ├── ClawletVaultSDK.ts
│   │   ├── abi.ts
│   │   ├── addresses.ts
│   │   └── types.ts
│   │
│   ├── core/
│   ├── utils/
│   └── cli/
│
├── scripts/                      # NEW: Deployment scripts
│   ├── deploy.ts
│   └── verify.ts
│
└── CLAWLET_VAULT_PLAN.md        # This file
```

---

*Document created: January 2026*
*Last updated: January 30, 2026*

---

<p align="center">
  <sub>a <a href="https://nytemode.com">nytemode</a> project</sub>
</p>

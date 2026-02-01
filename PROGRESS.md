# Clawlet Development Progress

**Last Updated:** January 31, 2026
**Repository:** https://github.com/NYTEMODEONLY/clawlet

---

## What is Clawlet?

Clawlet is an **AI-native Ethereum wallet SDK** for autonomous agents. It allows AI agents to:
- Hold and transact with ETH and ERC-20 tokens
- Verify trust between agents (ERC-8004)
- Operate within human-defined guardrails
- Be controlled by human operators via on-chain killswitch

The key innovation is the **ClawletVault smart contract** - a singleton contract that enforces spending limits and owner controls at the blockchain level, preventing rogue agents from bypassing SDK-level restrictions.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLAWLET SYSTEM                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    ClawletVault (On-Chain)                    │   │
│  │                                                                │   │
│  │  • Holds all funds                                            │   │
│  │  • Enforces spending limits                                   │   │
│  │  • Owner has immutable control                                │   │
│  │  • Killswitch: pause, revoke, drain                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              ▲                                       │
│                              │ interacts via                         │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Clawlet SDK (TypeScript)                   │   │
│  │                                                                │   │
│  │  • ClawletVaultSDK - vault interactions                       │   │
│  │  • Clawlet - wallet operations                                │   │
│  │  • TrustSystem - ERC-8004 verification                       │   │
│  │  • Swap utilities - Uniswap V3                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              ▲                                       │
│                              │ used by                               │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                       AI Agent                                │   │
│  │                                                                │   │
│  │  • Has its own private key                                    │   │
│  │  • Uses SDK to call vault functions                          │   │
│  │  • Can only spend within limits                              │   │
│  │  • Cannot bypass on-chain rules                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What We Built

### Phase 1: Core SDK ✅

**Files:**
- `src/core/wallet.ts` - ClawletWallet class (key management, transactions)
- `src/core/trust.ts` - TrustSystem (ERC-8004 verification)
- `src/core/clawlet.ts` - Main Clawlet class (unified API)
- `src/types/index.ts` - TypeScript type definitions
- `src/constants/networks.ts` - Network configurations (mainnet, sepolia, base, etc.)
- `src/constants/erc8004.ts` - ERC-8004 ABIs and addresses

**Utilities:**
- `src/utils/keystore.ts` - Encrypted key storage (AES-256-GCM)
- `src/utils/payment-watcher.ts` - Watch for incoming payments
- `src/utils/trust-cache.ts` - Cache trust lookups
- `src/utils/batch.ts` - Batch payments via Multicall3
- `src/utils/ens.ts` - ENS resolution for agents
- `src/utils/owner.ts` - SDK-level owner controls (legacy)
- `src/utils/swap.ts` - Uniswap V3 token swaps + CINDR Token integration

**CLI:**
- `src/cli/index.ts` - Command-line interface

### Phase 2: Smart Contract ✅

**Contracts:**
- `contracts/ClawletVault.sol` - Main vault contract (singleton pattern)
- `contracts/interfaces/IClawletVault.sol` - Interface with full NatSpec docs
- `contracts/test/ClawletVault.t.sol` - Foundry test suite (25+ tests)
- `contracts/script/Deploy.s.sol` - Deployment scripts
- `contracts/foundry.toml` - Foundry configuration

**Key Features:**
- Immutable owner (no setOwner function)
- Daily + per-transaction spending limits
- Recipient whitelist
- Killswitch: `pause()`, `revokeAgent()`, `emergencyDrain()`
- ReentrancyGuard protection
- OpenZeppelin SafeERC20

### Phase 3: Vault SDK ✅

**Files:**
- `src/vault/ClawletVaultSDK.ts` - TypeScript SDK for vault
- `src/vault/abi.ts` - Contract ABI
- `src/vault/addresses.ts` - Deployed addresses (empty until deployment)
- `src/vault/types.ts` - Type definitions
- `src/vault/index.ts` - Module exports

---

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Core SDK | ✅ Complete | Fully functional |
| Trust System (ERC-8004) | ✅ Complete | Ready for mainnet registries |
| Token Swaps | ✅ Complete | Uniswap V3 + CINDR |
| ClawletVault Contract | ✅ Written | Needs deployment |
| Vault SDK | ✅ Complete | Needs contract addresses |
| Foundry Tests | ✅ Written | Need to run with Foundry |
| Deployment | ❌ Not Started | See next steps |
| CLI Vault Commands | ❌ Not Started | Phase 4 |
| Web Dashboard | ❌ Not Started | Phase 4 |

---

## Next Steps

### 1. Deploy Smart Contract

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
cd contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit

# Run tests
forge test -vvv

# Deploy to Sepolia (testnet first)
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_KEY \
  --broadcast \
  --verify
```

### 2. Update Contract Addresses

After deployment, update `src/vault/addresses.ts`:

```typescript
export const CLAWLET_VAULT_ADDRESSES: VaultAddresses = {
  sepolia: '0xDeployedAddress...',
  base: '0xDeployedAddress...',
  // etc.
};
```

### 3. Add CLI Vault Commands (Phase 4)

Add commands to `src/cli/index.ts`:
- `clawlet vault create` - Create new vault
- `clawlet vault deposit` - Fund vault
- `clawlet vault withdraw` - Owner withdraw
- `clawlet vault pause` - Pause agent
- `clawlet vault status` - Show vault info

### 4. Integration Tests

Create tests that interact with deployed contracts on testnets.

---

## Key Design Decisions

### Why Singleton Contract?

| Aspect | Singleton (Chosen) | Factory (Alternative) |
|--------|-------------------|----------------------|
| Gas to create vault | ~50k (storage write) | ~500k (deploy contract) |
| Upgradability | Easier | Harder |
| User experience | One address | Unique per user |
| Audit cost | One contract | Same |

### Why Immutable Owner?

The owner address is set at vault creation and **cannot be changed**. This is intentional:
- Prevents agent from transferring ownership to itself
- No social engineering attack on ownership
- Owner is always in control, period

### Why On-Chain Limits?

SDK-level limits can be bypassed if an agent:
- Modifies its own code
- Calls the wallet directly
- Gets compromised

On-chain limits **cannot be bypassed** because:
- The contract is immutable
- Rules are enforced by Ethereum itself
- Agent's key can only call limited functions

---

## File Structure

```
clawlet/
├── contracts/                    # Solidity smart contracts
│   ├── ClawletVault.sol         # Main vault contract
│   ├── interfaces/
│   │   └── IClawletVault.sol    # Interface
│   ├── test/
│   │   └── ClawletVault.t.sol   # Foundry tests
│   ├── script/
│   │   └── Deploy.s.sol         # Deployment scripts
│   ├── foundry.toml             # Foundry config
│   └── README.md                # Contract docs
│
├── src/
│   ├── core/                    # Core SDK
│   │   ├── clawlet.ts          # Main class
│   │   ├── wallet.ts           # Wallet operations
│   │   └── trust.ts            # Trust system
│   │
│   ├── vault/                   # Vault SDK
│   │   ├── ClawletVaultSDK.ts  # Vault interactions
│   │   ├── abi.ts              # Contract ABI
│   │   ├── addresses.ts        # Deployed addresses
│   │   ├── types.ts            # Types
│   │   └── index.ts            # Exports
│   │
│   ├── utils/                   # Utilities
│   │   ├── keystore.ts         # Key encryption
│   │   ├── payment-watcher.ts  # Payment watching
│   │   ├── trust-cache.ts      # Trust caching
│   │   ├── batch.ts            # Batch payments
│   │   ├── ens.ts              # ENS resolution
│   │   ├── owner.ts            # Legacy owner controls
│   │   └── swap.ts             # Token swaps
│   │
│   ├── constants/               # Constants
│   │   ├── networks.ts         # Network configs
│   │   └── erc8004.ts          # ERC-8004 ABIs
│   │
│   ├── types/                   # Type definitions
│   │   └── index.ts
│   │
│   ├── cli/                     # CLI
│   │   └── index.ts
│   │
│   └── index.ts                 # Main exports
│
├── tests/                       # TypeScript tests
│   ├── wallet.test.ts
│   ├── trust-cache.test.ts
│   └── batch.test.ts
│
├── examples/                    # Usage examples
│   ├── basic-usage.ts
│   ├── agent-to-agent.ts
│   ├── langchain-tool.ts
│   └── openclaw-integration.ts
│
├── CLAWLET_VAULT_PLAN.md       # Vault implementation plan
├── PROGRESS.md                  # This file
├── README.md                    # Project README
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

---

## Usage Examples

### Owner Creates Vault for Agent

```typescript
import { ClawletVaultSDK } from 'clawlet';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

// Owner's wallet
const ownerAccount = privateKeyToAccount('0xOwnerPrivateKey...');
const ownerWallet = createWalletClient({
  account: ownerAccount,
  chain: base,
  transport: http(),
});

// Create vault SDK
const sdk = new ClawletVaultSDK({ network: 'base' }, ownerWallet);

// Create vault for agent
const { vaultId } = await sdk.createVault({
  agentAddress: '0xAgentAddress...',
  dailyLimitEth: '0.5',
  perTxLimitEth: '0.1',
  initialFundingEth: '2.0',
});

console.log(`Vault #${vaultId} created for agent`);
```

### Agent Uses Vault

```typescript
import { ClawletVaultSDK } from 'clawlet';

// Agent's wallet (different from owner)
const agentWallet = createWalletClient({
  account: privateKeyToAccount('0xAgentPrivateKey...'),
  chain: base,
  transport: http(),
});

const sdk = new ClawletVaultSDK({ network: 'base' }, agentWallet);

// Find my vault
const vaultId = await sdk.getMyVault();

// Check allowance
const remaining = await sdk.getRemainingAllowanceEth(vaultId);
console.log(`Can spend: ${remaining} ETH today`);

// Send payment (within limits)
await sdk.agentSend({
  vaultId,
  to: '0xRecipient...',
  amountEth: '0.05',
  memo: 'Task completion payment',
});
```

### Owner Killswitch

```typescript
// If agent goes rogue...

// Option 1: Pause (can unpause later)
await sdk.pause(vaultId);

// Option 2: Revoke agent access
await sdk.revokeAgent(vaultId);

// Option 3: Nuclear - drain everything
await sdk.emergencyDrain(vaultId, [
  '0xTokenAddress1...',
  '0xTokenAddress2...',
]);
```

---

## Environment Variables

```bash
# Required for deployment
DEPLOYER_PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://...
ETHERSCAN_API_KEY=...

# For SDK usage
CLAWLET_KEY=0x...  # Agent or owner private key

# Optional
BASE_RPC_URL=https://...
OPTIMISM_RPC_URL=https://...
ARBITRUM_RPC_URL=https://...
```

---

## Commands

```bash
# Development
npm run build          # Build SDK
npm run test           # Run tests
npm run lint           # Lint code

# Foundry (in contracts/)
forge build            # Build contracts
forge test             # Run contract tests
forge test -vvvv       # Verbose tests
forge test --gas-report  # Gas usage

# CLI
npx clawlet generate   # Generate new wallet
npx clawlet balance    # Check balance
npx clawlet send       # Send ETH
```

---

## CINDR Token Integration

CINDR is a deflationary token with 5% auto-burn. Integrated for agent payments:

```typescript
import { swapETHForCINDR, calculateCINDRReceived } from 'clawlet';

// Swap ETH for CINDR
const result = await swapETHForCINDR(walletClient, publicClient, {
  amountIn: parseEther('0.1'),
  slippagePercent: 1,
});

// Account for 5% burn when sending
const sendAmount = parseEther('100');
const received = calculateCINDRReceived(sendAmount); // 95 tokens
```

**CINDR Contract:** `0x7198Bf425540e50BB2fcf0e0060d61e058CbB363`
**Website:** https://cindrtoken.com

---

## Security Considerations

1. **Owner keys** - Store securely, never in code
2. **Agent keys** - Can be less secure (limited by vault)
3. **Contract upgrades** - Current design is immutable (no proxy)
4. **Audit** - Recommended before mainnet deployment
5. **Gas limits** - Set reasonable limits to prevent griefing

---

## Resources

- **ERC-8004 Spec:** Agent identity standard (not yet finalized)
- **Viem Docs:** https://viem.sh
- **Foundry Docs:** https://book.getfoundry.sh
- **OpenZeppelin:** https://docs.openzeppelin.com

---

<p align="center">
  <sub>a <a href="https://nytemode.com">nytemode</a> project</sub>
</p>

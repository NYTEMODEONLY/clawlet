# ClawletVault Smart Contracts

On-chain security layer for AI agent wallets with enforced spending limits and killswitch functionality.

## Overview

ClawletVault is a singleton smart contract that manages multiple agent vaults. Each vault has:
- **Immutable owner** - Human operator who can always withdraw/pause
- **Configurable agent** - AI agent with spending limits
- **On-chain limits** - Daily and per-transaction limits enforced at contract level
- **Killswitch** - Owner can pause, revoke, or emergency drain at any time

## Architecture

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

## Setup

### Prerequisites

Install Foundry:
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Install Dependencies

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
```

### Build

```bash
forge build
```

### Test

```bash
# Run all tests
forge test

# Run with gas reporting
forge test --gas-report

# Run with verbosity
forge test -vvvv
```

## Contract Functions

### For Vault Owners (Humans)

| Function | Description |
|----------|-------------|
| `createVault(agent, dailyLimit, perTxLimit)` | Create a new vault |
| `ownerWithdraw(vaultId, amount)` | Withdraw ETH |
| `ownerWithdrawAll(vaultId)` | Withdraw all ETH |
| `ownerWithdrawToken(vaultId, token, amount)` | Withdraw ERC20 tokens |
| `pause(vaultId)` | Pause agent transactions |
| `unpause(vaultId)` | Resume agent transactions |
| `revokeAgent(vaultId)` | Remove agent access |
| `emergencyDrain(vaultId, tokens[])` | Drain everything immediately |
| `setAgent(vaultId, newAgent)` | Change agent address |
| `setLimits(vaultId, daily, perTx)` | Update spending limits |
| `setWhitelist(vaultId, addr, allowed)` | Manage recipient whitelist |

### For Agents (AI)

| Function | Description |
|----------|-------------|
| `agentSend(vaultId, to, amount, memo)` | Send ETH (respects limits) |
| `agentSendToken(vaultId, token, to, amount)` | Send ERC20 tokens |
| `getRemainingAllowance(vaultId)` | Check remaining daily limit |

### For Anyone

| Function | Description |
|----------|-------------|
| `deposit(vaultId)` | Fund a vault with ETH |
| `depositToken(vaultId, token, amount)` | Fund a vault with tokens |
| `getVault(vaultId)` | Get vault details |
| `getVaultsByOwner(owner)` | Get owner's vault IDs |
| `getVaultByAgent(agent)` | Get agent's vault ID |

## Security Properties

1. **Owner Immutability**: No `setOwner()` function exists - owner cannot be changed after vault creation
2. **On-Chain Enforcement**: All limits are checked in the contract - agents cannot bypass them
3. **Reentrancy Protection**: All external calls protected by ReentrancyGuard
4. **Checks-Effects-Interactions**: State updated before external calls
5. **Overflow Protection**: Solidity 0.8+ built-in overflow checks

## Gas Estimates

| Operation | Estimated Gas |
|-----------|---------------|
| Create vault | ~150,000 |
| Deposit ETH | ~50,000 |
| Agent send | ~80,000 |
| Owner withdraw | ~50,000 |
| Pause | ~30,000 |
| Emergency drain | ~100,000+ |

## Deployment

### Local (Anvil)

```bash
# Start local node
anvil

# Deploy
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

### Testnet (Sepolia)

```bash
forge script script/Deploy.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_KEY \
  --broadcast \
  --verify
```

## License

MIT

---

<p align="center">
  <sub>a <a href="https://nytemode.com">nytemode</a> project</sub>
</p>

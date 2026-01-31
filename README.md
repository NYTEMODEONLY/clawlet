# 🦀 Clawlet

**AI-native Ethereum wallet for autonomous agents to transact with each other.**

Clawlet is a lightweight, self-custodial Ethereum wallet SDK designed for AI agents. It enables autonomous agents to hold ETH/tokens, verify other agents' identities via ERC-8004, and transact securely with configurable guardrails.

## Features

- 🔐 **Self-custodial** - Generate or import private keys, HD wallet support (BIP-44)
- 🌐 **Multi-chain** - Ethereum mainnet, Sepolia, Optimism, Arbitrum, Base
- 🤖 **ERC-8004 Integration** - Verify agent identities, reputation, and validations
- 🛡️ **Guardrails** - Spending limits, allowlists/blocklists, auto-approve thresholds
- ⚡ **Modern Stack** - Built with viem, TypeScript, fully typed
- 🔧 **CLI Included** - Human-friendly commands for setup and management

## Installation

```bash
npm install clawlet
```

## Quick Start

### SDK Usage

```typescript
import { Clawlet, parseEther } from 'clawlet';

// Create wallet from private key
const wallet = new Clawlet({
  privateKey: process.env.CLAWLET_KEY,
  network: 'base',
});

// Check balance
const balance = await wallet.getFormattedBalance();
console.log(`Balance: ${balance} ETH`);

// Verify agent trust before paying
const isTrusted = await wallet.isAgentTrusted('0xOtherAgentAddress');
if (isTrusted) {
  const tx = await wallet.payAgent('0xOtherAgentAddress', '0.01', 'Task completion tip');
  console.log(`Paid agent: ${tx.hash}`);
}

// Watch for incoming payments
wallet.watchIncomingPayments((from, amount, hash) => {
  console.log(`Received ${amount} wei from ${from}`);
});
```

### Generate New Wallet

```typescript
import { Clawlet } from 'clawlet';

const { clawlet, mnemonic, address } = Clawlet.generate('base');
console.log('Address:', address);
console.log('Mnemonic (SAVE THIS!):', mnemonic);
```

### CLI Usage

```bash
# Generate new wallet
npx clawlet init

# Check balance
npx clawlet balance --network base

# Send ETH (with trust check)
npx clawlet send 0xRecipient 0.01 --network base

# Check agent trust
npx clawlet trust 0xAgentAddress --network base

# Watch for incoming payments
npx clawlet watch --network base
```

## Configuration

### Full Configuration Options

```typescript
const wallet = new Clawlet({
  // Key management (one required)
  privateKey: '0x...',
  mnemonic: 'word1 word2 ...',

  // Network
  network: 'base', // mainnet, sepolia, optimism, arbitrum, base
  rpcUrl: 'https://custom-rpc.com', // optional custom RPC
  hdPath: "m/44'/60'/0'/0/0", // optional HD path

  // Security guardrails
  guardrails: {
    maxTxValueWei: parseEther('1'), // Max 1 ETH per tx
    maxTxPerHour: 10,
    maxTxPerDay: 50,
    allowedRecipients: ['0x...'], // Only these addresses can receive
    blockedRecipients: ['0x...'], // Block these addresses
    autoApproveThresholdWei: parseEther('0.01'), // Auto-approve below this
  },

  // ERC-8004 trust settings
  trustSettings: {
    requireIdentity: true, // Must have registered agent NFT
    minReputationScore: 50, // 0-100 scale
    requireValidation: false, // Must have valid attestations
    skipTrustCheckForWhitelisted: true,
  },
});
```

## ERC-8004 Integration

Clawlet integrates with ERC-8004 agent registries for trust verification:

```typescript
// Get detailed trust information
const trust = await wallet.getAgentTrust('0xAgentAddress');
console.log('Trusted:', trust.isTrusted);
console.log('Identity:', trust.identity);
console.log('Reputation:', trust.reputation);
console.log('Validations:', trust.validations);
console.log('Reasons:', trust.reasons);

// Whitelist trusted agents (skip trust checks)
wallet.trustAgent('0xTrustedAgent');

// Pay without trust check
await wallet.payAgent('0xAgent', '0.1', 'tip', { skipTrustCheck: true });
```

## Token Operations

```typescript
// Get ERC-20 token balance
const balance = await wallet.getTokenBalance('0xTokenAddress');
console.log(`${balance.symbol}: ${balance.formattedBalance}`);

// Transfer tokens (with trust check)
await wallet.payAgentToken(
  '0xTokenAddress',
  '0xRecipient',
  parseEther('100')
);

// Approve token spending
await wallet.approveToken('0xToken', '0xSpender', parseEther('1000'));
```

## Event Handling

```typescript
// Subscribe to all events
const unsubscribe = wallet.on((event) => {
  switch (event.type) {
    case 'payment_received':
      console.log(`Received ${event.amount} from ${event.from}`);
      break;
    case 'payment_sent':
      console.log(`Sent ${event.amount} to ${event.to}`);
      break;
    case 'guardrail_triggered':
      console.log(`Blocked: ${event.reason}`);
      break;
  }
});

// Watch incoming payments specifically
wallet.watchIncomingPayments((from, amount, hash) => {
  // React to payment - continue task, unlock feature, etc.
});
```

## Supported Networks

| Network | Chain ID | Native Currency |
|---------|----------|-----------------|
| Ethereum Mainnet | 1 | ETH |
| Sepolia Testnet | 11155111 | ETH |
| Optimism | 10 | ETH |
| Arbitrum One | 42161 | ETH |
| Base | 8453 | ETH |

## Security Considerations

1. **Never commit private keys** - Use environment variables
2. **Use guardrails** - Set spending limits for autonomous agents
3. **Trust verification** - Always verify unknown agents via ERC-8004
4. **Testnet first** - Test on Sepolia before mainnet

## Environment Variables

```bash
# Required for CLI and SDK
CLAWLET_KEY=0x... # Private key (hex)

# Optional
CLAWLET_RPC_URL=https://... # Custom RPC endpoint
CLAWLET_NETWORK=base # Default network
```

## API Reference

### Clawlet Class

#### Static Methods
- `Clawlet.generate(network?)` - Generate new wallet
- `Clawlet.fromPrivateKey(key, network?)` - Create from private key
- `Clawlet.fromMnemonic(mnemonic, network?)` - Create from seed phrase
- `Clawlet.fromEnv(envVar?, network?)` - Create from environment variable

#### Instance Methods
- `getAddress()` - Get wallet address
- `getBalance()` - Get ETH balance (wei)
- `getFormattedBalance()` - Get ETH balance (formatted)
- `getTokenBalance(token)` - Get ERC-20 balance
- `send(to, amount)` - Send ETH
- `payAgent(to, amount, memo?, options?)` - Pay with trust check
- `transferToken(token, to, amount)` - Transfer ERC-20
- `isAgentTrusted(address)` - Quick trust check
- `getAgentTrust(address)` - Detailed trust info
- `trustAgent(address)` - Add to whitelist
- `untrustAgent(address)` - Remove from whitelist
- `signMessage(message)` - Sign message
- `on(handler)` - Subscribe to events
- `watchIncomingPayments(callback, interval?)` - Watch payments

## License

MIT

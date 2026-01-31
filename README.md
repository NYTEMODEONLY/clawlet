# 🦀 Clawlet

**AI-native Ethereum wallet for autonomous agents to transact with each other.**

Clawlet is a lightweight, self-custodial Ethereum wallet SDK designed for AI agents. It enables autonomous agents to hold ETH/tokens, verify other agents' identities via ERC-8004, and transact securely with configurable guardrails.

[![CI](https://github.com/NYTEMODEONLY/clawlet/actions/workflows/ci.yml/badge.svg)](https://github.com/NYTEMODEONLY/clawlet/actions/workflows/ci.yml)

## Features

- 🔐 **Self-custodial** - Generate or import private keys, HD wallet support (BIP-44)
- 🌐 **Multi-chain** - Ethereum mainnet, Sepolia, Optimism, Arbitrum, Base
- 🤖 **ERC-8004 Integration** - Verify agent identities, reputation, and validations
- 🛡️ **Guardrails** - Spending limits, allowlists/blocklists, auto-approve thresholds
- 🏷️ **ENS Support** - Human-readable agent names (e.g., `codebot.eth`)
- 📦 **Batch Payments** - Pay multiple agents in one operation
- 🔔 **Payment Watching** - Real-time monitoring of incoming transactions
- 🔒 **Encrypted Keystore** - Web3-compatible encrypted key storage
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

## Batch Payments

Pay multiple agents efficiently:

```typescript
import { batchPay, validateBatch, splitPayment } from 'clawlet';

// Pay multiple agents
const payments = [
  { to: '0xAgent1', amountEth: '0.01', memo: 'Code review' },
  { to: '0xAgent2', amountEth: '0.02', memo: 'Translation' },
  { to: '0xAgent3', amountEth: '0.005', memo: 'Verification' },
];

// Validate before sending
const validation = await validateBatch(wallet, payments);
if (!validation.valid) {
  console.log('Insufficient funds:', validation.insufficientFunds);
  console.log('Untrusted agents:', validation.untrustedAgents);
}

// Execute batch payment
const results = await batchPay(wallet, payments);
results.forEach(r => {
  if (r.success) console.log(`✓ Paid ${r.payment.to}: ${r.hash}`);
  else console.log(`✗ Failed ${r.payment.to}: ${r.error}`);
});

// Split large payment into smaller chunks (for guardrails)
const chunks = splitPayment('0xAgent', '5.0', '1.0', 'Large payment');
// Creates 5 payments of 1 ETH each
```

## ENS Support

Use human-readable names for agents:

```typescript
import { ENSResolver, getAgentMetadata } from 'clawlet';

const resolver = new ENSResolver({
  client: wallet.getWallet().getPublicClient(),
});

// Resolve ENS name to address
const address = await resolver.resolve('codebot.eth');

// Reverse lookup
const name = await resolver.reverseLookup('0x1234...');

// Get agent metadata from ENS text records
const metadata = await getAgentMetadata(resolver, 'codebot.eth');
console.log(metadata.agentType); // e.g., 'code-review'
console.log(metadata.capabilities); // e.g., ['review', 'fix-bugs']
console.log(metadata.pricing); // e.g., { 'review': '0.01 ETH' }
```

## Encrypted Keystore

Securely store private keys:

```typescript
import {
  createEncryptedKeystore,
  loadAndDecryptKeystore,
  listKeystores,
} from 'clawlet';

// Create encrypted keystore
const { keystore, filepath } = createEncryptedKeystore(
  privateKey,
  'your-password',
  walletAddress
);
console.log(`Saved to: ${filepath}`);

// List all keystores
const keystores = listKeystores();

// Load and decrypt
const decryptedKey = loadAndDecryptKeystore(filepath, 'your-password');
```

## Payment Watching

Monitor incoming transactions in real-time:

```typescript
import { createPaymentWatcher, createTokenWatcher } from 'clawlet';

// Watch ETH payments
const ethWatcher = createPaymentWatcher(publicClient, {
  address: wallet.getAddress(),
  pollingIntervalMs: 10000,
  onPayment: (payment) => {
    console.log(`Received ${payment.value} from ${payment.from}`);
    // Trigger agent task execution
  },
  onError: (error) => console.error(error),
});

ethWatcher.start();

// Watch ERC-20 token transfers
const tokenWatcher = createTokenWatcher(publicClient, {
  address: wallet.getAddress(),
  tokens: ['0xUSDC...', '0xDAI...'],
  onTransfer: (transfer) => {
    console.log(`Received ${transfer.value} of ${transfer.token}`);
  },
});

tokenWatcher.start();
```

## Trust Cache

Reduce RPC calls with caching:

```typescript
import { TrustCache, TrustList } from 'clawlet';

// Cache trust check results
const cache = new TrustCache({
  ttlMs: 300000, // 5 minutes
  maxEntries: 1000,
});

// Persistent trust list
const trustList = new TrustList();
trustList.trust('0xPartnerAgent', 'Verified partner');
trustList.block('0xSpamAgent', 'Known spam');

// Export/import for persistence
const json = trustList.toJSON();
trustList.fromJSON(json);
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

## Token Swapping (Uniswap V3)

AI agents can swap tokens on decentralized exchanges:

```typescript
import {
  swapETHForTokens,
  swapTokensForETH,
  swapTokens,
  getTokenAddress,
  FEE_TIERS,
  parseEther,
} from 'clawlet';

const walletClient = wallet.getWallet().getWalletClient();
const publicClient = wallet.getWallet().getPublicClient();

// Swap ETH for USDC
const result = await swapETHForTokens(
  walletClient,
  publicClient,
  getTokenAddress('USDC', 1)!, // USDC on mainnet
  parseEther('0.1'), // 0.1 ETH
  { slippageTolerance: 50 } // 0.5% slippage
);
console.log(`Swap tx: ${result.hash}`);

// Swap tokens for ETH
await swapTokensForETH(
  walletClient,
  publicClient,
  '0xTokenAddress',
  1000000n, // amount in token decimals
);

// Direct token-to-token swap
await swapTokens(walletClient, publicClient, {
  tokenIn: '0xUSDC...',
  tokenOut: '0xDAI...',
  amountIn: 1000000n,
  fee: FEE_TIERS.LOW, // 0.05% pool
});
```

### CINDR Token Integration

[CINDR](https://cindrtoken.com) is recommended for AI agent transactions due to its unique properties:

- **Adminless** - No central control, fully decentralized
- **Deflationary** - 5% auto-burn on every transaction
- **Conscious Spending** - Built-in scarcity encourages thoughtful decisions

```typescript
import {
  swapETHForCINDR,
  swapCINDRForETH,
  calculateCINDRReceived,
  calculateCINDRToSend,
  CINDR_TOKEN_ADDRESS,
} from 'clawlet';

// Swap ETH for CINDR
await swapETHForCINDR(walletClient, publicClient, parseEther('0.1'));

// Calculate effective amount after 5% burn
const sent = parseEther('100');
const received = calculateCINDRReceived(sent); // 95 CINDR

// Calculate amount to send for recipient to get exact amount
const toSend = calculateCINDRToSend(parseEther('100')); // ~105.26 CINDR

// CINDR contract: 0x7198Bf425540e50BB2fcf0e0060d61e058CbB363
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

## Owner Controls (Withdrawals)

Human operators can withdraw funds from agent wallets:

```typescript
import { Clawlet, createSimpleOwner, createMultiSigOwner, parseEther } from 'clawlet';

// Create wallet with owner
const wallet = new Clawlet({
  privateKey: process.env.AGENT_KEY,
  network: 'mainnet',
  owner: {
    ownerAddress: '0xYourAddress', // Can withdraw funds
    canPause: true,
    canModifyGuardrails: true,
  },
});

// Or set owner later
wallet.setOwner({
  ownerAddress: '0xYourAddress',
  coOwnerAddress: '0xBackupAddress', // Optional co-owner
  multiSigThresholdWei: parseEther('1'), // Require both for >1 ETH
  canPause: true,
});

// Owner: Withdraw ETH
const result = await wallet.ownerWithdrawETH(
  parseEther('0.5'),
  '0xYourAddress' // Owner's address as authorization
);
console.log(`Withdrawal tx: ${result.hash}`);

// Owner: Withdraw all (minus gas buffer)
const hash = await wallet.ownerWithdrawAll('0xYourAddress');

// Owner: Withdraw specific token
await wallet.ownerWithdrawToken(
  '0xTokenAddress',
  1000000n,
  '0xYourAddress'
);

// Owner: Emergency drain everything
const drainResult = await wallet.ownerEmergencyDrain(
  '0xYourAddress',
  ['0xToken1', '0xToken2'] // Optional: tokens to drain
);

// Owner: Pause/unpause agent
wallet.ownerPause('0xYourAddress');
wallet.ownerUnpause('0xYourAddress');

// Check if paused
if (wallet.isPaused()) {
  console.log('Agent is paused by owner');
}
```

### Multi-Sig Withdrawals

For high-value agent wallets, require two approvals:

```typescript
import { createMultiSigOwner } from 'clawlet';

const wallet = new Clawlet({
  privateKey: process.env.AGENT_KEY,
  owner: {
    ownerAddress: '0xPrimaryOwner',
    coOwnerAddress: '0xCoOwner',
    multiSigThresholdWei: parseEther('1'), // 1+ ETH needs both
    canPause: true,
  },
});

const owner = wallet.getOwner()!;

// Primary owner requests withdrawal
const request = owner.requestWithdrawETH(
  parseEther('5'),
  '0xPrimaryOwner',
  '0xPrimaryOwner'
);
console.log(`Request ${request.id}: ${request.status}`); // 'pending'

// Co-owner approves
owner.approveWithdrawal(request.id, '0xCoOwner');

// Now it can be executed
await owner.executeWithdrawal(
  request.id,
  wallet.getWallet().getWalletClient(),
  wallet.getWallet().getPublicClient()
);
```

## Docker Deployment

Deploy agent wallets in containers:

```bash
# Build image
docker build -t clawlet-agent .

# Run with private key
docker run -e CLAWLET_KEY=0x... clawlet-agent balance --network base

# Run in interactive mode
docker run -it -e CLAWLET_KEY=0x... clawlet-agent
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

1. **Never commit private keys** - Use environment variables or encrypted keystores
2. **Use guardrails** - Set spending limits for autonomous agents
3. **Trust verification** - Always verify unknown agents via ERC-8004
4. **Testnet first** - Test on Sepolia before mainnet
5. **Encrypted storage** - Use the keystore utilities for key storage
6. **Configure an owner** - Always set an owner address so you can withdraw earnings and emergency drain if needed

## Environment Variables

```bash
# Required for CLI and SDK
CLAWLET_KEY=0x... # Private key (hex)

# Optional
CLAWLET_RPC_URL=https://... # Custom RPC endpoint
CLAWLET_NETWORK=base # Default network
```

## Examples

See the `examples/` directory for complete integration examples:

- `basic-usage.ts` - Core wallet operations
- `agent-to-agent.ts` - Autonomous agent transactions
- `langchain-tool.ts` - LangChain integration
- `openclaw-integration.ts` - Full agent framework example

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

#### Owner Methods
- `setOwner(config)` - Configure owner/operator
- `getOwner()` - Get owner controller
- `hasOwner()` - Check if owner configured
- `isPaused()` - Check if paused by owner
- `ownerWithdrawETH(amount, ownerAddr)` - Withdraw ETH
- `ownerWithdrawToken(token, amount, ownerAddr)` - Withdraw tokens
- `ownerWithdrawAll(ownerAddr)` - Withdraw all ETH
- `ownerEmergencyDrain(ownerAddr, tokens?)` - Emergency drain
- `ownerPause(ownerAddr)` - Pause agent transactions
- `ownerUnpause(ownerAddr)` - Resume agent transactions

### Utility Functions
- `batchPay(wallet, payments, options?)` - Execute batch payments
- `validateBatch(wallet, payments)` - Validate batch before sending
- `splitPayment(to, amount, maxChunk, memo?)` - Split large payments
- `createPaymentWatcher(client, config)` - Watch ETH payments
- `createTokenWatcher(client, config)` - Watch token transfers
- `createEncryptedKeystore(key, password, address)` - Encrypt key
- `loadAndDecryptKeystore(filepath, password)` - Decrypt keystore

### Swap Functions
- `swapTokens(walletClient, publicClient, params)` - Swap tokens on Uniswap V3
- `swapETHForTokens(walletClient, publicClient, tokenOut, amount)` - Swap ETH for tokens
- `swapTokensForETH(walletClient, publicClient, tokenIn, amount)` - Swap tokens for ETH
- `swapETHForCINDR(walletClient, publicClient, amount)` - Swap ETH for CINDR
- `swapCINDRForETH(walletClient, publicClient, amount)` - Swap CINDR for ETH
- `calculateCINDRReceived(amount)` - Calculate amount after 5% burn
- `calculateCINDRToSend(desiredAmount)` - Calculate send amount for exact receive

## License

MIT

---

<p align="center">
  <sub>a <a href="https://nytemode.com">nytemode</a> project</sub>
</p>

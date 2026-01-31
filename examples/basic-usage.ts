/**
 * Basic Clawlet Usage Example
 *
 * This example demonstrates the core functionality of Clawlet:
 * - Creating a wallet
 * - Checking balances
 * - Sending ETH
 * - Trust verification
 */

import { Clawlet, parseEther, type Address } from '../src/index.js';

async function main() {
  // ============================================================================
  // 1. Create a wallet
  // ============================================================================

  // Option A: Generate a new wallet
  const { clawlet: newWallet, mnemonic, address } = Clawlet.generate('sepolia');
  console.log('Generated new wallet:');
  console.log('  Address:', address);
  console.log('  Mnemonic:', mnemonic);
  console.log();

  // Option B: Create from environment variable (recommended for production)
  // const wallet = Clawlet.fromEnv('CLAWLET_KEY', 'sepolia');

  // Option C: Create from private key directly
  // const wallet = Clawlet.fromPrivateKey('0x...', 'sepolia');

  const wallet = newWallet;

  // ============================================================================
  // 2. Check balance
  // ============================================================================

  const balance = await wallet.getFormattedBalance();
  console.log(`ETH Balance: ${balance} ETH`);
  console.log();

  // ============================================================================
  // 3. Trust verification (ERC-8004)
  // ============================================================================

  const otherAgent = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;

  // Quick check
  const isTrusted = await wallet.isAgentTrusted(otherAgent);
  console.log(`Agent ${otherAgent} trusted: ${isTrusted}`);

  // Detailed trust info
  const trustInfo = await wallet.getAgentTrust(otherAgent);
  console.log('Trust details:');
  console.log('  Trusted:', trustInfo.isTrusted);
  console.log('  Identity exists:', trustInfo.identity?.exists);
  console.log('  Reputation score:', trustInfo.reputation?.score);
  console.log('  Reasons:', trustInfo.reasons.join(', '));
  console.log();

  // ============================================================================
  // 4. Whitelist trusted agents
  // ============================================================================

  wallet.trustAgent(otherAgent);
  console.log(`Added ${otherAgent} to whitelist`);
  console.log(`Is whitelisted: ${wallet.isAgentWhitelisted(otherAgent)}`);
  console.log();

  // ============================================================================
  // 5. Pay an agent (requires ETH in wallet)
  // ============================================================================

  // This would work if the wallet has ETH:
  // const tx = await wallet.payAgent(otherAgent, '0.001', 'Test payment');
  // console.log('Payment sent:', tx.hash);

  // ============================================================================
  // 6. Subscribe to events
  // ============================================================================

  const unsubscribe = wallet.on((event) => {
    console.log('Event received:', event.type);
  });

  // Cleanup
  unsubscribe();

  console.log('Done!');
}

main().catch(console.error);

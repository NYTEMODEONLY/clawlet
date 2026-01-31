/**
 * Agent-to-Agent Transaction Example
 *
 * This example demonstrates how autonomous AI agents can use Clawlet
 * to transact with each other in a trustless environment.
 */

import { Clawlet, parseEther, formatEther, type Address } from '../src/index.js';

// Simulated agent configuration
interface AgentConfig {
  name: string;
  wallet: Clawlet;
}

async function simulateAgentInteraction() {
  console.log('🤖 Agent-to-Agent Transaction Simulation');
  console.log('=========================================\n');

  // ============================================================================
  // Setup: Create two agent wallets
  // ============================================================================

  const { clawlet: agentA, address: addressA } = Clawlet.generate('sepolia');
  const { clawlet: agentB, address: addressB } = Clawlet.generate('sepolia');

  console.log('Agent A:', addressA);
  console.log('Agent B:', addressB);
  console.log();

  // Configure guardrails for safety
  agentA.updateGuardrails({
    maxTxValueWei: parseEther('0.1'), // Max 0.1 ETH per transaction
    maxTxPerHour: 10,
    autoApproveThresholdWei: parseEther('0.01'), // Auto-approve below 0.01 ETH
  });

  agentB.updateGuardrails({
    maxTxValueWei: parseEther('0.1'),
    maxTxPerHour: 10,
    autoApproveThresholdWei: parseEther('0.01'),
  });

  // ============================================================================
  // Scenario 1: Agent A wants to pay Agent B for a completed task
  // ============================================================================

  console.log('📋 Scenario: Agent A wants to pay Agent B for task completion\n');

  // Step 1: Agent A checks if Agent B is trusted
  console.log('Step 1: Checking trust...');
  const trustResult = await agentA.getAgentTrust(addressB);
  console.log('  Trusted:', trustResult.isTrusted);
  console.log('  Reasons:', trustResult.reasons.join('\n           '));
  console.log();

  // Step 2: If not trusted by registry, manually whitelist for this session
  if (!trustResult.isTrusted) {
    console.log('Step 2: Agent B not in registry, adding to session whitelist...');
    agentA.trustAgent(addressB);
    console.log('  Agent B whitelisted');
    console.log();
  }

  // Step 3: Verify trust again
  const isTrustedNow = await agentA.isAgentTrusted(addressB);
  console.log('Step 3: Trust verified:', isTrustedNow);
  console.log();

  // Step 4: Make payment (would require actual ETH)
  console.log('Step 4: Payment would be made here:');
  console.log('  await agentA.payAgent(addressB, "0.01", "Task completion reward");');
  console.log();

  // ============================================================================
  // Scenario 2: Agent B watches for incoming payment
  // ============================================================================

  console.log('📋 Scenario: Agent B listens for incoming payments\n');

  console.log('Setting up payment watcher...');

  // In production, this would continuously poll for new transactions
  const stopWatching = agentB.watchIncomingPayments(
    (from, amount, hash) => {
      console.log('💰 Payment received!');
      console.log(`  From: ${from}`);
      console.log(`  Amount: ${formatEther(amount)} ETH`);
      console.log(`  Hash: ${hash}`);

      // Agent can now proceed with next task
      console.log('  → Proceeding with follow-up task...');
    },
    5000 // Poll every 5 seconds
  );

  // Stop watcher after demo
  setTimeout(() => {
    stopWatching();
    console.log('Watcher stopped');
  }, 1000);

  // ============================================================================
  // Scenario 3: Guardrails prevent excessive spending
  // ============================================================================

  console.log('\n📋 Scenario: Guardrails in action\n');

  // Try to send more than max allowed
  console.log('Attempting to send 0.5 ETH (max is 0.1 ETH)...');
  console.log('  This would throw: "Transaction value exceeds maximum (0.1 ETH)"');
  console.log();

  // ============================================================================
  // Event-driven agent logic
  // ============================================================================

  console.log('📋 Event-driven agent pattern:\n');

  const eventCode = `
// Agent registers event handlers for reactive behavior
wallet.on((event) => {
  switch (event.type) {
    case 'payment_received':
      // Got paid - perform the requested task
      performTask(event.from, event.amount);
      break;

    case 'payment_sent':
      // Payment confirmed - log for accounting
      logTransaction(event.hash, event.amount);
      break;

    case 'trust_check_failed':
      // Unknown agent - require manual approval
      requestHumanReview(event.address, event.reasons);
      break;

    case 'guardrail_triggered':
      // Safety limit hit - notify operator
      alertOperator(event.reason);
      break;
  }
});
`;

  console.log(eventCode);
  console.log('Done!');
}

simulateAgentInteraction().catch(console.error);

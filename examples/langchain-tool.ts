/**
 * LangChain Tool Integration Example
 *
 * This example shows how to integrate Clawlet as a LangChain tool
 * for AI agents that use the LangChain framework.
 */

import { Clawlet, parseEther, formatEther, type Address } from '../src/index.js';

/**
 * ClawletTool - A LangChain-compatible tool for Ethereum transactions
 *
 * This is a simplified example. In production, you would extend
 * the actual LangChain Tool class.
 */
class ClawletTool {
  name = 'clawlet_wallet';
  description = `
    Ethereum wallet tool for sending and receiving payments.
    Use this tool to:
    - Check your ETH balance
    - Send ETH to other agents
    - Check if an agent is trusted
    - View transaction history

    Input should be a JSON object with 'action' and relevant parameters.
  `;

  private wallet: Clawlet;

  constructor(wallet: Clawlet) {
    this.wallet = wallet;
  }

  async call(input: string): Promise<string> {
    try {
      const parsed = JSON.parse(input);
      const { action, ...params } = parsed;

      switch (action) {
        case 'get_balance':
          return await this.getBalance();

        case 'get_address':
          return this.getAddress();

        case 'check_trust':
          return await this.checkTrust(params.address);

        case 'pay_agent':
          return await this.payAgent(params.address, params.amount, params.memo);

        case 'whitelist_agent':
          return this.whitelistAgent(params.address);

        default:
          return `Unknown action: ${action}. Available actions: get_balance, get_address, check_trust, pay_agent, whitelist_agent`;
      }
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async getBalance(): Promise<string> {
    const balance = await this.wallet.getFormattedBalance();
    return `Current balance: ${balance} ETH`;
  }

  private getAddress(): string {
    return `Wallet address: ${this.wallet.getAddress()}`;
  }

  private async checkTrust(address: string): Promise<string> {
    const trust = await this.wallet.getAgentTrust(address as Address);
    return JSON.stringify({
      address,
      trusted: trust.isTrusted,
      identity: trust.identity?.exists ?? false,
      reputation: trust.reputation?.score ?? 0,
      reasons: trust.reasons,
    }, null, 2);
  }

  private async payAgent(address: string, amount: string, memo?: string): Promise<string> {
    // First check trust
    const isTrusted = await this.wallet.isAgentTrusted(address as Address);
    if (!isTrusted) {
      return `Cannot pay ${address}: Agent is not trusted. Use whitelist_agent first or verify their identity.`;
    }

    try {
      const tx = await this.wallet.payAgent(address as Address, amount, memo);
      return `Payment sent! Transaction hash: ${tx.hash}`;
    } catch (error) {
      return `Payment failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private whitelistAgent(address: string): string {
    this.wallet.trustAgent(address as Address);
    return `Agent ${address} has been added to the trusted whitelist.`;
  }
}

// ============================================================================
// Example Usage with a simulated LangChain agent
// ============================================================================

async function simulateLangChainAgent() {
  console.log('🔗 LangChain Tool Integration Demo');
  console.log('===================================\n');

  // Create wallet and tool
  const { clawlet, address } = Clawlet.generate('sepolia');
  const tool = new ClawletTool(clawlet);

  console.log('Tool created for wallet:', address);
  console.log('Tool name:', tool.name);
  console.log();

  // Simulate agent tool calls
  const testCalls = [
    { action: 'get_address' },
    { action: 'get_balance' },
    { action: 'check_trust', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
    { action: 'whitelist_agent', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
    { action: 'check_trust', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' },
  ];

  for (const call of testCalls) {
    console.log(`📥 Tool call: ${JSON.stringify(call)}`);
    const result = await tool.call(JSON.stringify(call));
    console.log(`📤 Result:\n${result}\n`);
  }

  // Show how an LLM would use this
  console.log('Example LLM reasoning:');
  console.log('─'.repeat(50));
  console.log(`
User: Pay 0.01 ETH to agent 0x1234...5678 for completing my task

Agent Thought: I need to pay another agent. First, I should check if they are trusted.

Action: clawlet_wallet
Action Input: {"action": "check_trust", "address": "0x1234...5678"}

Observation: {"address": "0x1234...5678", "trusted": false, "reasons": ["Agent not in registry"]}

Thought: The agent is not trusted. I should ask the user if they want to whitelist them.

Response: The agent 0x1234...5678 is not in the trusted registry. Would you like me to:
1. Add them to the whitelist and proceed with payment
2. Cancel the payment

User: Add them and proceed

Action: clawlet_wallet
Action Input: {"action": "whitelist_agent", "address": "0x1234...5678"}

Observation: Agent 0x1234...5678 has been added to the trusted whitelist.

Action: clawlet_wallet
Action Input: {"action": "pay_agent", "address": "0x1234...5678", "amount": "0.01", "memo": "Task completion"}

Observation: Payment sent! Transaction hash: 0xabc...def

Response: I've sent 0.01 ETH to the agent. Transaction hash: 0xabc...def
`);
}

simulateLangChainAgent().catch(console.error);

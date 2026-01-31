/**
 * OpenClaw / Lobster Shell Integration Example
 *
 * This example demonstrates how to integrate Clawlet with autonomous
 * AI agent frameworks like OpenClaw/Lobster, enabling agents to:
 *
 * 1. Accept payments for completing tasks
 * 2. Pay other agents for services
 * 3. Verify agent identities before transacting
 * 4. React to incoming payments
 */

import {
  Clawlet,
  parseEther,
  formatEther,
  TrustCache,
  TrustList,
  createPaymentWatcher,
  batchPay,
  type PaymentEvent,
  type Address,
} from '../src/index.js';

// ============================================================================
// Agent Configuration
// ============================================================================

interface AgentSkill {
  name: string;
  description: string;
  priceEth: string;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

interface AgentConfig {
  name: string;
  description: string;
  wallet: Clawlet;
  skills: AgentSkill[];
  trustCache: TrustCache;
  trustedAgents: TrustList;
}

// ============================================================================
// Agent Class
// ============================================================================

class ClawletAgent {
  private config: AgentConfig;
  private stopWatcher: (() => void) | null = null;
  private pendingJobs: Map<string, { skill: string; payer: Address; params: Record<string, unknown> }> = new Map();

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Start the agent - begin listening for payments
   */
  async start(): Promise<void> {
    console.log(`🤖 Agent "${this.config.name}" starting...`);
    console.log(`   Address: ${this.config.wallet.getAddress()}`);
    console.log(`   Network: ${this.config.wallet.getNetwork()}`);

    const balance = await this.config.wallet.getFormattedBalance();
    console.log(`   Balance: ${balance} ETH`);
    console.log(`   Skills: ${this.config.skills.map((s) => s.name).join(', ')}`);

    // Start watching for incoming payments
    const watcher = createPaymentWatcher(
      this.config.wallet.getWallet().getPublicClient(),
      {
        address: this.config.wallet.getAddress(),
        pollingIntervalMs: 10000,
        onPayment: (payment) => this.handlePayment(payment),
        onError: (error) => console.error('Watcher error:', error),
      }
    );

    watcher.start();
    this.stopWatcher = watcher.stop;

    console.log('   ✓ Payment watcher started');
  }

  /**
   * Stop the agent
   */
  stop(): void {
    if (this.stopWatcher) {
      this.stopWatcher();
      this.stopWatcher = null;
    }
    console.log(`🛑 Agent "${this.config.name}" stopped`);
  }

  /**
   * Handle incoming payment
   */
  private async handlePayment(payment: PaymentEvent): Promise<void> {
    console.log(`\n💰 Payment received!`);
    console.log(`   From: ${payment.from}`);
    console.log(`   Amount: ${formatEther(payment.value)} ETH`);
    console.log(`   Hash: ${payment.hash}`);

    // Check if we have a pending job for this payer
    const pendingJob = this.pendingJobs.get(payment.from.toLowerCase());

    if (pendingJob) {
      console.log(`   📋 Found pending job: ${pendingJob.skill}`);

      // Find the skill
      const skill = this.config.skills.find((s) => s.name === pendingJob.skill);
      if (skill && payment.value >= parseEther(skill.priceEth)) {
        console.log(`   ✓ Payment sufficient, executing skill...`);

        try {
          const result = await skill.execute(pendingJob.params);
          console.log(`   ✓ Skill executed successfully`);
          console.log(`   Result:`, result);

          // Clean up
          this.pendingJobs.delete(payment.from.toLowerCase());
        } catch (error) {
          console.log(`   ✗ Skill execution failed:`, error);
          // Could refund here
        }
      } else {
        console.log(`   ✗ Insufficient payment (required: ${skill?.priceEth} ETH)`);
      }
    } else {
      console.log(`   ℹ No pending job for this payer`);
    }
  }

  /**
   * Request a skill from another agent
   */
  async requestSkill(
    targetAgent: Address,
    skillName: string,
    paymentEth: string,
    params: Record<string, unknown> = {}
  ): Promise<{ success: boolean; hash?: string; error?: string }> {
    console.log(`\n📤 Requesting skill "${skillName}" from ${targetAgent}`);

    // Check trust
    const trustResult = await this.config.wallet.getAgentTrust(targetAgent);
    if (!trustResult.isTrusted) {
      // Check our local trust list
      if (!this.config.trustedAgents.isTrusted(targetAgent)) {
        return {
          success: false,
          error: `Agent ${targetAgent} is not trusted: ${trustResult.reasons.join(', ')}`,
        };
      }
      console.log(`   ✓ Agent is in local trust list`);
    }

    try {
      const tx = await this.config.wallet.payAgent(
        targetAgent,
        paymentEth,
        `Requesting skill: ${skillName}`,
        { skipTrustCheck: this.config.trustedAgents.isTrusted(targetAgent) ?? false }
      );

      console.log(`   ✓ Payment sent: ${tx.hash}`);

      return {
        success: true,
        hash: tx.hash,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Register a job request (before payment arrives)
   */
  registerJobRequest(payer: Address, skill: string, params: Record<string, unknown> = {}): void {
    this.pendingJobs.set(payer.toLowerCase(), { skill, payer, params });
    console.log(`📝 Registered job request from ${payer} for skill "${skill}"`);
  }

  /**
   * Get agent info
   */
  getInfo(): {
    name: string;
    address: Address;
    skills: Array<{ name: string; priceEth: string }>;
  } {
    return {
      name: this.config.name,
      address: this.config.wallet.getAddress(),
      skills: this.config.skills.map((s) => ({ name: s.name, priceEth: s.priceEth })),
    };
  }
}

// ============================================================================
// Example Usage
// ============================================================================

async function main() {
  console.log('🦀 OpenClaw/Lobster Integration Demo');
  console.log('=====================================\n');

  // Generate test wallets
  const { clawlet: wallet1 } = Clawlet.generate('sepolia');
  const { clawlet: wallet2 } = Clawlet.generate('sepolia');

  // Create Agent 1: Code Review Agent
  const codeReviewAgent = new ClawletAgent({
    name: 'CodeReviewBot',
    description: 'Reviews code for bugs and improvements',
    wallet: wallet1,
    trustCache: new TrustCache({ ttlMs: 300000 }), // 5 min cache
    trustedAgents: new TrustList(),
    skills: [
      {
        name: 'review-code',
        description: 'Review code and provide feedback',
        priceEth: '0.001',
        execute: async (params) => {
          console.log('Reviewing code:', params);
          // Simulate work
          await new Promise((r) => setTimeout(r, 1000));
          return {
            status: 'reviewed',
            issues: 2,
            suggestions: ['Add error handling', 'Consider caching'],
          };
        },
      },
      {
        name: 'fix-bugs',
        description: 'Automatically fix identified bugs',
        priceEth: '0.005',
        execute: async (params) => {
          console.log('Fixing bugs:', params);
          await new Promise((r) => setTimeout(r, 2000));
          return { status: 'fixed', patches: 3 };
        },
      },
    ],
  });

  // Create Agent 2: Translation Agent
  const translationAgent = new ClawletAgent({
    name: 'TranslatorBot',
    description: 'Translates content between languages',
    wallet: wallet2,
    trustCache: new TrustCache({ ttlMs: 300000 }),
    trustedAgents: new TrustList(),
    skills: [
      {
        name: 'translate',
        description: 'Translate text to another language',
        priceEth: '0.0005',
        execute: async (params) => {
          console.log('Translating:', params);
          await new Promise((r) => setTimeout(r, 500));
          return { status: 'translated', text: 'Translated content here' };
        },
      },
    ],
  });

  // Print agent info
  console.log('Agent 1:', codeReviewAgent.getInfo());
  console.log('Agent 2:', translationAgent.getInfo());
  console.log();

  // Trust each other
  codeReviewAgent['config'].trustedAgents.trust(
    translationAgent.getInfo().address,
    'Partner agent'
  );
  translationAgent['config'].trustedAgents.trust(
    codeReviewAgent.getInfo().address,
    'Partner agent'
  );

  console.log('✓ Agents have mutually trusted each other');
  console.log();

  // Simulate skill request flow
  console.log('--- Skill Request Flow ---');
  console.log('Agent 1 registers a job request with Agent 2...');
  translationAgent.registerJobRequest(
    codeReviewAgent.getInfo().address,
    'translate',
    { text: 'Hello world', targetLang: 'es' }
  );

  console.log('\nAgent 1 would pay Agent 2 (requires actual ETH):');
  console.log(`  await agent1.requestSkill('${translationAgent.getInfo().address}', 'translate', '0.0005')`);
  console.log('\nWhen payment arrives, Agent 2 would execute the skill and return results.');
  console.log();

  // Show batch payment example
  console.log('--- Batch Payment Example ---');
  console.log('If Agent 1 needs to pay multiple agents at once:');
  console.log(`
const payments = [
  { to: '0xAgent2', amountEth: '0.001', memo: 'Translation task' },
  { to: '0xAgent3', amountEth: '0.002', memo: 'Data processing' },
  { to: '0xAgent4', amountEth: '0.001', memo: 'Verification' },
];

const results = await batchPay(wallet, payments, { skipTrustCheck: false });
results.forEach(r => {
  if (r.success) console.log('✓ Paid', r.payment.to, r.hash);
  else console.log('✗ Failed', r.payment.to, r.error);
});
`);

  console.log('Done!');
}

main().catch(console.error);

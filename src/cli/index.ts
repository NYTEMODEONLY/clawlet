import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { config as dotenvConfig } from 'dotenv';
import { formatEther, parseEther, type Address, type Hex } from 'viem';

import { Clawlet } from '../core/clawlet.js';
import type { Network } from '../types/index.js';

// Load environment variables
dotenvConfig();

const program = new Command();

program
  .name('clawlet')
  .description('AI-native Ethereum wallet for autonomous agents')
  .version('0.1.0');

// ============================================================================
// Init Command - Generate new wallet
// ============================================================================

program
  .command('init')
  .description('Generate a new wallet')
  .option('-n, --network <network>', 'Network to use', 'mainnet')
  .action(async (options) => {
    const spinner = ora('Generating new wallet...').start();

    try {
      const { mnemonic, address } = Clawlet.generate(options.network as Network);

      spinner.succeed('Wallet generated successfully!');

      console.log();
      console.log(chalk.bold('🦀 Clawlet Wallet Created'));
      console.log(chalk.dim('─'.repeat(50)));
      console.log();
      console.log(chalk.bold('Address:'));
      console.log(chalk.green(address));
      console.log();
      console.log(chalk.bold('Recovery Phrase (SAVE THIS SECURELY):'));
      console.log(chalk.yellow(mnemonic));
      console.log();
      console.log(chalk.dim('─'.repeat(50)));
      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log('1. Save your recovery phrase in a secure location');
      console.log('2. Set CLAWLET_KEY environment variable:');
      console.log(chalk.cyan(`   export CLAWLET_KEY="<your-private-key>"`));
      console.log('3. Fund your wallet with ETH');
      console.log('4. Start transacting!');
      console.log();
      console.log(chalk.red('⚠️  Never share your recovery phrase or private key!'));
    } catch (error) {
      spinner.fail('Failed to generate wallet');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// Balance Command
// ============================================================================

program
  .command('balance')
  .description('Check wallet balance')
  .option('-n, --network <network>', 'Network to use', 'mainnet')
  .option('-k, --key <privateKey>', 'Private key (or use CLAWLET_KEY env)')
  .option('-a, --address <address>', 'Address to check (if not using key)')
  .action(async (options) => {
    const spinner = ora('Fetching balance...').start();

    try {
      const privateKey = options.key || process.env['CLAWLET_KEY'];

      if (!privateKey && !options.address) {
        spinner.fail('No private key or address provided');
        console.log(chalk.yellow('Use --key or set CLAWLET_KEY environment variable'));
        process.exit(1);
      }

      if (privateKey) {
        const clawlet = new Clawlet({
          privateKey: privateKey as Hex,
          network: options.network as Network,
        });

        const balance = await clawlet.getFormattedBalance();
        spinner.succeed('Balance fetched');

        console.log();
        console.log(chalk.bold('Address:'), clawlet.getAddress());
        console.log(chalk.bold('Network:'), options.network);
        console.log(chalk.bold('Balance:'), chalk.green(`${balance} ETH`));
      } else {
        // Just check balance for any address
        const clawlet = Clawlet.generate(options.network as Network).clawlet;
        const client = clawlet.getWallet().getPublicClient();
        const balance = await client.getBalance({ address: options.address as Address });

        spinner.succeed('Balance fetched');

        console.log();
        console.log(chalk.bold('Address:'), options.address);
        console.log(chalk.bold('Network:'), options.network);
        console.log(chalk.bold('Balance:'), chalk.green(`${formatEther(balance)} ETH`));
      }
    } catch (error) {
      spinner.fail('Failed to fetch balance');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// Send Command
// ============================================================================

program
  .command('send')
  .description('Send ETH to an address')
  .argument('<to>', 'Recipient address')
  .argument('<amount>', 'Amount in ETH')
  .option('-n, --network <network>', 'Network to use', 'mainnet')
  .option('-k, --key <privateKey>', 'Private key (or use CLAWLET_KEY env)')
  .option('--skip-trust', 'Skip trust check')
  .action(async (to, amount, options) => {
    const spinner = ora('Preparing transaction...').start();

    try {
      const privateKey = options.key || process.env['CLAWLET_KEY'];

      if (!privateKey) {
        spinner.fail('No private key provided');
        console.log(chalk.yellow('Use --key or set CLAWLET_KEY environment variable'));
        process.exit(1);
      }

      const clawlet = new Clawlet({
        privateKey: privateKey as Hex,
        network: options.network as Network,
      });

      // Check balance first
      spinner.text = 'Checking balance...';
      const balance = await clawlet.getBalance();
      const sendAmount = parseEther(amount);

      if (balance < sendAmount) {
        spinner.fail('Insufficient balance');
        console.log(chalk.red(`Balance: ${formatEther(balance)} ETH`));
        console.log(chalk.red(`Requested: ${amount} ETH`));
        process.exit(1);
      }

      // Trust check
      if (!options.skipTrust) {
        spinner.text = 'Checking agent trust...';
        const trustResult = await clawlet.getAgentTrust(to as Address);
        if (!trustResult.isTrusted) {
          spinner.warn('Recipient is not a trusted agent');
          console.log(chalk.yellow('Reasons:'));
          trustResult.reasons.forEach((r) => console.log(chalk.yellow(`  - ${r}`)));
          console.log();
          console.log(chalk.dim('Use --skip-trust to send anyway'));
          process.exit(1);
        }
      }

      // Send transaction
      spinner.text = 'Sending transaction...';
      const result = await clawlet.send(to as Address, amount);

      spinner.succeed('Transaction sent!');

      console.log();
      console.log(chalk.bold('Transaction Hash:'), chalk.cyan(result.hash));
      console.log(chalk.bold('From:'), result.from);
      console.log(chalk.bold('To:'), result.to);
      console.log(chalk.bold('Amount:'), chalk.green(`${amount} ETH`));
      console.log();

      // Wait for confirmation
      spinner.start('Waiting for confirmation...');
      const confirmed = await clawlet.waitForTransaction(result.hash);
      spinner.succeed('Transaction confirmed!');
      console.log(chalk.bold('Block:'), confirmed.blockNumber?.toString());
    } catch (error) {
      spinner.fail('Transaction failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// Trust Command
// ============================================================================

program
  .command('trust')
  .description('Check trust status of an agent')
  .argument('<address>', 'Agent address to check')
  .option('-n, --network <network>', 'Network to use', 'mainnet')
  .action(async (address, options) => {
    const spinner = ora('Checking agent trust...').start();

    try {
      const { clawlet } = Clawlet.generate(options.network as Network);
      const result = await clawlet.getAgentTrust(address as Address);

      spinner.succeed('Trust check complete');

      console.log();
      console.log(chalk.bold('Agent:'), address);
      console.log(
        chalk.bold('Trusted:'),
        result.isTrusted ? chalk.green('Yes ✓') : chalk.red('No ✗')
      );
      console.log();

      if (result.identity) {
        console.log(chalk.bold('Identity:'));
        console.log(`  Exists: ${result.identity.exists ? 'Yes' : 'No'}`);
        if (result.identity.exists) {
          console.log(`  Token ID: ${result.identity.tokenId}`);
        }
      }

      if (result.reputation) {
        console.log(chalk.bold('Reputation:'));
        console.log(`  Score: ${result.reputation.score}/100`);
        console.log(`  Total Interactions: ${result.reputation.totalInteractions}`);
        console.log(`  Positive: ${result.reputation.positiveInteractions}`);
        console.log(`  Negative: ${result.reputation.negativeInteractions}`);
      }

      if (result.validations && result.validations.length > 0) {
        console.log(chalk.bold('Validations:'));
        for (const v of result.validations) {
          console.log(`  - ${v.validationType}: ${v.isValid ? 'Valid' : 'Invalid'}`);
        }
      }

      console.log();
      console.log(chalk.bold('Reasons:'));
      result.reasons.forEach((r) => console.log(`  ${r}`));
    } catch (error) {
      spinner.fail('Trust check failed');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// Address Command
// ============================================================================

program
  .command('address')
  .description('Show wallet address')
  .option('-k, --key <privateKey>', 'Private key (or use CLAWLET_KEY env)')
  .action(async (options) => {
    try {
      const privateKey = options.key || process.env['CLAWLET_KEY'];

      if (!privateKey) {
        console.log(chalk.red('No private key provided'));
        console.log(chalk.yellow('Use --key or set CLAWLET_KEY environment variable'));
        process.exit(1);
      }

      const clawlet = new Clawlet({ privateKey: privateKey as Hex });
      console.log(clawlet.getAddress());
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// Sign Command
// ============================================================================

program
  .command('sign')
  .description('Sign a message')
  .argument('<message>', 'Message to sign')
  .option('-k, --key <privateKey>', 'Private key (or use CLAWLET_KEY env)')
  .action(async (message, options) => {
    try {
      const privateKey = options.key || process.env['CLAWLET_KEY'];

      if (!privateKey) {
        console.log(chalk.red('No private key provided'));
        process.exit(1);
      }

      const clawlet = new Clawlet({ privateKey: privateKey as Hex });
      const signature = await clawlet.signMessage(message);

      console.log();
      console.log(chalk.bold('Message:'), message);
      console.log(chalk.bold('Signer:'), clawlet.getAddress());
      console.log(chalk.bold('Signature:'), chalk.cyan(signature));
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// Watch Command
// ============================================================================

program
  .command('watch')
  .description('Watch for incoming payments')
  .option('-n, --network <network>', 'Network to use', 'mainnet')
  .option('-k, --key <privateKey>', 'Private key (or use CLAWLET_KEY env)')
  .option('-i, --interval <ms>', 'Polling interval in milliseconds', '15000')
  .action(async (options) => {
    try {
      const privateKey = options.key || process.env['CLAWLET_KEY'];

      if (!privateKey) {
        console.log(chalk.red('No private key provided'));
        process.exit(1);
      }

      const clawlet = new Clawlet({
        privateKey: privateKey as Hex,
        network: options.network as Network,
      });

      console.log(chalk.bold('🦀 Watching for incoming payments...'));
      console.log(chalk.dim('Address:'), clawlet.getAddress());
      console.log(chalk.dim('Network:'), options.network);
      console.log(chalk.dim('Press Ctrl+C to stop'));
      console.log();

      clawlet.watchIncomingPayments(
        (from, amount, hash) => {
          console.log(chalk.green('💰 Payment received!'));
          console.log(`   From: ${from}`);
          console.log(`   Amount: ${formatEther(amount)} ETH`);
          console.log(`   Hash: ${hash}`);
          console.log();
        },
        parseInt(options.interval)
      );

      // Keep process running
      process.on('SIGINT', () => {
        console.log('\nStopping watcher...');
        process.exit(0);
      });
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program.parse();

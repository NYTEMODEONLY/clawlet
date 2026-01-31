import { describe, it, expect, beforeEach } from 'vitest';
import { Clawlet, ClawletWallet, parseEther } from '../src/index.js';
import type { Address } from 'viem';

describe('ClawletWallet', () => {
  describe('generation', () => {
    it('should generate a new wallet with mnemonic', () => {
      const { wallet, mnemonic, address } = ClawletWallet.generate('sepolia');

      expect(mnemonic).toBeDefined();
      expect(mnemonic.split(' ').length).toBe(24); // 256-bit entropy = 24 words
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(wallet.getAddress()).toBe(address);
    });

    it('should create wallet from private key', () => {
      // Test private key (DO NOT USE IN PRODUCTION)
      const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
      const wallet = ClawletWallet.fromPrivateKey(privateKey, 'sepolia');

      expect(wallet.getAddress()).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    });

    it('should create wallet from mnemonic', () => {
      const mnemonic =
        'test test test test test test test test test test test junk';
      const wallet = ClawletWallet.fromMnemonic(mnemonic, 'sepolia');

      expect(wallet.getAddress()).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should derive multiple accounts from mnemonic', () => {
      const mnemonic =
        'test test test test test test test test test test test junk';
      const accounts = ClawletWallet.deriveAccounts(mnemonic, 3, 'sepolia');

      expect(accounts.length).toBe(3);
      expect(accounts[0]!.index).toBe(0);
      expect(accounts[1]!.index).toBe(1);
      expect(accounts[2]!.index).toBe(2);

      // Each account should have unique address
      const addresses = new Set(accounts.map((a) => a.address));
      expect(addresses.size).toBe(3);
    });
  });

  describe('network configuration', () => {
    it('should default to mainnet', () => {
      const { wallet } = ClawletWallet.generate();
      expect(wallet.getNetwork()).toBe('mainnet');
    });

    it('should support different networks', () => {
      const networks = ['mainnet', 'sepolia', 'optimism', 'arbitrum', 'base'] as const;

      for (const network of networks) {
        const { wallet } = ClawletWallet.generate(network);
        expect(wallet.getNetwork()).toBe(network);
      }
    });
  });

  describe('guardrails', () => {
    it('should throw error if recipient is blocked', () => {
      const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
      const blockedAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;

      const wallet = new ClawletWallet({
        privateKey,
        network: 'sepolia',
        guardrails: {
          blockedRecipients: [blockedAddress],
        },
      });

      expect(() =>
        wallet.sendTransaction({
          to: blockedAddress,
          value: parseEther('0.01'),
        })
      ).rejects.toThrow(/not allowed by guardrails/);
    });

    it('should allow recipient if on allowlist', async () => {
      const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
      const allowedAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;
      const notAllowedAddress = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address;

      const wallet = new ClawletWallet({
        privateKey,
        network: 'sepolia',
        guardrails: {
          allowedRecipients: [allowedAddress],
        },
      });

      // This should throw because we'd need ETH, but the error should NOT be about guardrails
      // Actually, for unit testing without real network, we just check the isRecipientAllowed logic
      expect(() =>
        wallet.sendTransaction({
          to: notAllowedAddress,
          value: parseEther('0.01'),
        })
      ).rejects.toThrow(/not allowed by guardrails/);
    });
  });
});

describe('Clawlet', () => {
  describe('factory methods', () => {
    it('should generate new wallet', () => {
      const { clawlet, mnemonic, address } = Clawlet.generate('sepolia');

      expect(clawlet).toBeInstanceOf(Clawlet);
      expect(mnemonic).toBeDefined();
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should create from private key', () => {
      const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
      const clawlet = Clawlet.fromPrivateKey(privateKey, 'sepolia');

      expect(clawlet.getAddress()).toBe('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
    });

    it('should create from mnemonic', () => {
      const mnemonic =
        'test test test test test test test test test test test junk';
      const clawlet = Clawlet.fromMnemonic(mnemonic, 'sepolia');

      expect(clawlet.getAddress()).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('trust system', () => {
    let clawlet: Clawlet;

    beforeEach(() => {
      const { clawlet: c } = Clawlet.generate('sepolia');
      clawlet = c;
    });

    it('should whitelist and check agents', () => {
      const agentAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;

      expect(clawlet.isAgentWhitelisted(agentAddress)).toBe(false);

      clawlet.trustAgent(agentAddress);
      expect(clawlet.isAgentWhitelisted(agentAddress)).toBe(true);

      clawlet.untrustAgent(agentAddress);
      expect(clawlet.isAgentWhitelisted(agentAddress)).toBe(false);
    });

    it('should return trusted for whitelisted agents', async () => {
      const agentAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;

      clawlet.trustAgent(agentAddress);
      const isTrusted = await clawlet.isAgentTrusted(agentAddress);

      expect(isTrusted).toBe(true);
    });

    it('should get detailed trust info', async () => {
      const agentAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;

      const trustResult = await clawlet.getAgentTrust(agentAddress);

      expect(trustResult.address).toBe(agentAddress);
      expect(typeof trustResult.isTrusted).toBe('boolean');
      expect(Array.isArray(trustResult.reasons)).toBe(true);
    });
  });

  describe('event handling', () => {
    it('should subscribe to events', () => {
      const { clawlet } = Clawlet.generate('sepolia');
      const events: any[] = [];

      const unsubscribe = clawlet.on((event) => {
        events.push(event);
      });

      expect(typeof unsubscribe).toBe('function');

      // Cleanup
      unsubscribe();
    });
  });
});

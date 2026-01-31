import { describe, it, expect } from 'vitest';
import {
  calculateBatchTotal,
  splitPayment,
  type BatchPayment,
} from '../src/utils/batch.js';
import { parseEther } from 'viem';
import type { Address } from 'viem';

describe('Batch Utilities', () => {
  describe('calculateBatchTotal', () => {
    it('should calculate total for single payment', () => {
      const payments: BatchPayment[] = [
        { to: '0x1234567890abcdef1234567890abcdef12345678' as Address, amountEth: '1.5' },
      ];

      const total = calculateBatchTotal(payments);
      expect(total).toBe(parseEther('1.5'));
    });

    it('should calculate total for multiple payments', () => {
      const payments: BatchPayment[] = [
        { to: '0x1111111111111111111111111111111111111111' as Address, amountEth: '0.5' },
        { to: '0x2222222222222222222222222222222222222222' as Address, amountEth: '1.0' },
        { to: '0x3333333333333333333333333333333333333333' as Address, amountEth: '0.25' },
      ];

      const total = calculateBatchTotal(payments);
      expect(total).toBe(parseEther('1.75'));
    });

    it('should return 0 for empty payments', () => {
      const total = calculateBatchTotal([]);
      expect(total).toBe(0n);
    });
  });

  describe('splitPayment', () => {
    const recipient = '0x1234567890abcdef1234567890abcdef12345678' as Address;

    it('should not split if amount is under max', () => {
      const payments = splitPayment(recipient, '0.5', '1.0');

      expect(payments.length).toBe(1);
      expect(payments[0]!.amountEth).toBe('0.5');
      expect(payments[0]!.to).toBe(recipient);
    });

    it('should split into equal chunks', () => {
      const payments = splitPayment(recipient, '3.0', '1.0');

      expect(payments.length).toBe(3);
      expect(payments[0]!.amountEth).toBe('1');
      expect(payments[1]!.amountEth).toBe('1');
      expect(payments[2]!.amountEth).toBe('1');
    });

    it('should handle remainder', () => {
      const payments = splitPayment(recipient, '2.5', '1.0');

      expect(payments.length).toBe(3);
      expect(payments[0]!.amountEth).toBe('1');
      expect(payments[1]!.amountEth).toBe('1');
      expect(payments[2]!.amountEth).toBe('0.5');
    });

    it('should add memo with part numbers', () => {
      const payments = splitPayment(recipient, '2.0', '1.0', 'Payment');

      expect(payments.length).toBe(2);
      expect(payments[0]!.memo).toBe('Payment (part 1)');
      expect(payments[1]!.memo).toBe('Payment (part 2)');
    });

    it('should preserve total value', () => {
      const totalEth = '5.7';
      const maxChunk = '0.8';
      const payments = splitPayment(recipient, totalEth, maxChunk);

      const reconstructedTotal = calculateBatchTotal(payments);
      // Due to floating point, compare with small tolerance
      const originalTotal = parseEther(totalEth);
      expect(reconstructedTotal).toBe(originalTotal);
    });
  });
});

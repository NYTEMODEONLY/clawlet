/**
 * Encrypted Keystore Utilities
 *
 * Provides secure storage for private keys using AES-256-GCM encryption.
 * Compatible with Web3 Secret Storage standard (similar to Ethereum keystore V3).
 */

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Hex } from 'viem';

interface EncryptedKeystore {
  version: number;
  id: string;
  address: string;
  crypto: {
    cipher: string;
    ciphertext: string;
    cipherparams: {
      iv: string;
    };
    kdf: string;
    kdfparams: {
      n: number;
      r: number;
      p: number;
      dklen: number;
      salt: string;
    };
    mac: string;
  };
}

const CLAWLET_DIR = join(homedir(), '.clawlet');
const KEYSTORE_DIR = join(CLAWLET_DIR, 'keystore');

/**
 * Ensure the keystore directory exists
 */
function ensureKeystoreDir(): void {
  if (!existsSync(KEYSTORE_DIR)) {
    mkdirSync(KEYSTORE_DIR, { recursive: true });
  }
}

/**
 * Generate a random UUID
 */
function generateUUID(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Derive encryption key using scrypt
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32, {
    N: 262144, // 2^18
    r: 8,
    p: 1,
    maxmem: 512 * 1024 * 1024, // 512 MB
  });
}

/**
 * Encrypt a private key with a password
 */
export function encryptPrivateKey(
  privateKey: Hex,
  password: string,
  address: string
): EncryptedKeystore {
  const salt = randomBytes(32);
  const iv = randomBytes(16);
  const key = deriveKey(password, salt);

  // Remove 0x prefix if present
  const keyBuffer = Buffer.from(privateKey.replace('0x', ''), 'hex');

  // Encrypt with AES-256-GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(keyBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // MAC is the auth tag in GCM mode
  const mac = authTag.toString('hex');

  return {
    version: 3,
    id: generateUUID(),
    address: address.replace('0x', '').toLowerCase(),
    crypto: {
      cipher: 'aes-256-gcm',
      ciphertext: ciphertext.toString('hex'),
      cipherparams: {
        iv: iv.toString('hex'),
      },
      kdf: 'scrypt',
      kdfparams: {
        n: 262144,
        r: 8,
        p: 1,
        dklen: 32,
        salt: salt.toString('hex'),
      },
      mac,
    },
  };
}

/**
 * Decrypt a keystore file
 */
export function decryptKeystore(keystore: EncryptedKeystore, password: string): Hex {
  const salt = Buffer.from(keystore.crypto.kdfparams.salt, 'hex');
  const iv = Buffer.from(keystore.crypto.cipherparams.iv, 'hex');
  const ciphertext = Buffer.from(keystore.crypto.ciphertext, 'hex');
  const mac = Buffer.from(keystore.crypto.mac, 'hex');

  const key = deriveKey(password, salt);

  // Decrypt with AES-256-GCM
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(mac);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return `0x${decrypted.toString('hex')}` as Hex;
  } catch {
    throw new Error('Invalid password or corrupted keystore');
  }
}

/**
 * Save encrypted keystore to file
 */
export function saveKeystore(keystore: EncryptedKeystore, filename?: string): string {
  ensureKeystoreDir();

  const name = filename ?? `UTC--${new Date().toISOString().replace(/:/g, '-')}--${keystore.address}`;
  const filepath = join(KEYSTORE_DIR, name);

  writeFileSync(filepath, JSON.stringify(keystore, null, 2));
  return filepath;
}

/**
 * Load keystore from file
 */
export function loadKeystore(filepath: string): EncryptedKeystore {
  if (!existsSync(filepath)) {
    throw new Error(`Keystore file not found: ${filepath}`);
  }

  const content = readFileSync(filepath, 'utf-8');
  return JSON.parse(content) as EncryptedKeystore;
}

/**
 * List all keystores
 */
export function listKeystores(): string[] {
  ensureKeystoreDir();

  const { readdirSync } = require('fs');
  const files = readdirSync(KEYSTORE_DIR) as string[];

  return files.filter((f: string) => f.endsWith('.json') || f.startsWith('UTC--'));
}

/**
 * Get keystore directory path
 */
export function getKeystoreDir(): string {
  return KEYSTORE_DIR;
}

/**
 * Create and save an encrypted keystore
 */
export function createEncryptedKeystore(
  privateKey: Hex,
  password: string,
  address: string
): { keystore: EncryptedKeystore; filepath: string } {
  const keystore = encryptPrivateKey(privateKey, password, address);
  const filepath = saveKeystore(keystore);
  return { keystore, filepath };
}

/**
 * Load and decrypt a keystore
 */
export function loadAndDecryptKeystore(filepath: string, password: string): Hex {
  const keystore = loadKeystore(filepath);
  return decryptKeystore(keystore, password);
}

import type { Address } from 'viem';

/**
 * ERC-8004 Registry Contract Addresses
 *
 * These are placeholder addresses for the ERC-8004 registries.
 * Replace with actual deployed addresses when available.
 */
export const ERC8004_ADDRESSES: Record<string, {
  identityRegistry: Address;
  reputationRegistry: Address;
  validationRegistry: Address;
}> = {
  // Mainnet (placeholder - replace when deployed)
  '1': {
    identityRegistry: '0x0000000000000000000000000000000000000000',
    reputationRegistry: '0x0000000000000000000000000000000000000000',
    validationRegistry: '0x0000000000000000000000000000000000000000',
  },
  // Sepolia testnet (placeholder - replace when deployed)
  '11155111': {
    identityRegistry: '0x0000000000000000000000000000000000000000',
    reputationRegistry: '0x0000000000000000000000000000000000000000',
    validationRegistry: '0x0000000000000000000000000000000000000000',
  },
  // Optimism (placeholder)
  '10': {
    identityRegistry: '0x0000000000000000000000000000000000000000',
    reputationRegistry: '0x0000000000000000000000000000000000000000',
    validationRegistry: '0x0000000000000000000000000000000000000000',
  },
  // Arbitrum (placeholder)
  '42161': {
    identityRegistry: '0x0000000000000000000000000000000000000000',
    reputationRegistry: '0x0000000000000000000000000000000000000000',
    validationRegistry: '0x0000000000000000000000000000000000000000',
  },
  // Base (placeholder)
  '8453': {
    identityRegistry: '0x0000000000000000000000000000000000000000',
    reputationRegistry: '0x0000000000000000000000000000000000000000',
    validationRegistry: '0x0000000000000000000000000000000000000000',
  },
};

/**
 * ERC-8004 Identity Registry ABI (ERC-721 based)
 */
export const IDENTITY_REGISTRY_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'tokenOfOwnerByIndex',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'tokenURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'ownerOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'getAgentByAddress',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'exists', type: 'bool' },
    ],
  },
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentAddress', type: 'address' },
      { name: 'metadataURI', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
] as const;

/**
 * ERC-8004 Reputation Registry ABI
 */
export const REPUTATION_REGISTRY_ABI = [
  {
    name: 'getReputation',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [
      { name: 'score', type: 'uint256' },
      { name: 'totalInteractions', type: 'uint256' },
      { name: 'positiveInteractions', type: 'uint256' },
      { name: 'negativeInteractions', type: 'uint256' },
      { name: 'lastUpdated', type: 'uint256' },
    ],
  },
  {
    name: 'submitRating',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'isPositive', type: 'bool' },
      { name: 'context', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'getReputationHistory',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [
      {
        name: 'events',
        type: 'tuple[]',
        components: [
          { name: 'rater', type: 'address' },
          { name: 'isPositive', type: 'bool' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'context', type: 'string' },
        ],
      },
    ],
  },
] as const;

/**
 * ERC-8004 Validation Registry ABI
 */
export const VALIDATION_REGISTRY_ABI = [
  {
    name: 'getValidations',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [
      {
        name: 'validations',
        type: 'tuple[]',
        components: [
          { name: 'validationType', type: 'string' },
          { name: 'validator', type: 'address' },
          { name: 'isValid', type: 'bool' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'metadata', type: 'bytes' },
        ],
      },
    ],
  },
  {
    name: 'hasValidation',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'validationType', type: 'string' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'addValidation',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'validationType', type: 'string' },
      { name: 'metadata', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    name: 'revokeValidation',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'validationType', type: 'string' },
    ],
    outputs: [],
  },
] as const;

/**
 * Standard ERC-20 ABI for token interactions
 */
export const ERC20_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

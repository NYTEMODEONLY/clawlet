/**
 * ClawletVault Contract ABI
 * Generated from ClawletVault.sol
 */

export const CLAWLET_VAULT_ABI = [
  // Events
  {
    type: 'event',
    name: 'VaultCreated',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'agent', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TokenDeposited',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentSent',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'memo', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AgentSentToken',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OwnerWithdrew',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'OwnerWithdrewToken',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'token', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'VaultPaused',
    inputs: [{ name: 'vaultId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'VaultUnpaused',
    inputs: [{ name: 'vaultId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'AgentRevoked',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'oldAgent', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'AgentChanged',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'oldAgent', type: 'address', indexed: true },
      { name: 'newAgent', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'LimitsUpdated',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'dailyLimit', type: 'uint256', indexed: false },
      { name: 'perTxLimit', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WhitelistUpdated',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'addr', type: 'address', indexed: true },
      { name: 'allowed', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WhitelistToggled',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'enabled', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EmergencyDrain',
    inputs: [
      { name: 'vaultId', type: 'uint256', indexed: true },
      { name: 'ethAmount', type: 'uint256', indexed: false },
    ],
  },

  // Vault Creation
  {
    type: 'function',
    name: 'createVault',
    inputs: [
      { name: 'agent', type: 'address' },
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'perTxLimit', type: 'uint256' },
    ],
    outputs: [{ name: 'vaultId', type: 'uint256' }],
    stateMutability: 'payable',
  },

  // Funding
  {
    type: 'function',
    name: 'deposit',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'depositToken',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Agent Functions
  {
    type: 'function',
    name: 'agentSend',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'memo', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'agentSendToken',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getRemainingAllowance',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },

  // Owner Functions
  {
    type: 'function',
    name: 'ownerWithdraw',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ownerWithdrawAll',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ownerWithdrawToken',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Killswitch Functions
  {
    type: 'function',
    name: 'pause',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'unpause',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeAgent',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'emergencyDrain',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'tokens', type: 'address[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Configuration
  {
    type: 'function',
    name: 'setAgent',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'newAgent', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setLimits',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'dailyLimit', type: 'uint256' },
      { name: 'perTxLimit', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setWhitelist',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'addr', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setWhitelistEnabled',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'enabled', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // View Functions
  {
    type: 'function',
    name: 'getVault',
    inputs: [{ name: 'vaultId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'agent', type: 'address' },
          { name: 'paused', type: 'bool' },
          { name: 'ethBalance', type: 'uint256' },
          { name: 'dailyLimit', type: 'uint256' },
          { name: 'perTxLimit', type: 'uint256' },
          { name: 'spentToday', type: 'uint256' },
          { name: 'dayStartTime', type: 'uint256' },
          { name: 'whitelistEnabled', type: 'bool' },
          { name: 'createdAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVaultsByOwner',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVaultByAgent',
    inputs: [{ name: 'agent', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isWhitelisted',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'addr', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTokenBalance',
    inputs: [
      { name: 'vaultId', type: 'uint256' },
      { name: 'token', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextVaultId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

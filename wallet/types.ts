// Types for wallet data

// Common types
export interface TokenBalance {
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string; // String to handle large numbers
  balanceUsd: number;
  logo?: string;
}

export interface Transaction {
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  fee: string;
  status: 'success' | 'failed' | 'pending';
  type: 'send' | 'receive' | 'swap' | 'other';
}

export interface WalletData {
  address: string;
  blockchain: 'ethereum' | 'solana';
  nativeBalance: string;
  nativeBalanceUsd: number;
  tokens: TokenBalance[];
  transactions: Transaction[];
}

// Blockchain-specific types
export interface EthereumTokenBalance extends TokenBalance {
  contractType?: 'ERC20' | 'ERC721' | 'ERC1155';
}

export interface SolanaTokenBalance extends TokenBalance {
  mint: string; // Solana-specific mint address
}
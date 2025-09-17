import { detectBlockchain } from './walletUtils';
import { getEthereumWalletData } from './ethereumService';
import { getSolanaWalletData } from './solanaService';
import { WalletData } from './types';

/**
 * Get wallet data for any supported blockchain
 * @param address Wallet address (Ethereum or Solana)
 * @returns Wallet data or error
 */
export const getWalletData = async (address: string): Promise<WalletData | { error: string }> => {
  try {
    // Detect blockchain type
    const blockchain = detectBlockchain(address);
    
    if (blockchain === 'ethereum') {
      return await getEthereumWalletData(address);
    } else if (blockchain === 'solana') {
      return await getSolanaWalletData(address);
    } else {
      return { error: 'Unsupported blockchain or invalid address format' };
    }
  } catch (error) {
    console.error('Error in wallet service:', error);
    return { error: 'Failed to fetch wallet data' };
  }
};
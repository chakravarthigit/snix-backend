import { getWalletData, detectBlockchain } from '../services/walletService';

/**
 * Controller for wallet-related operations
 */
export const walletController = {
  /**
   * Validate a wallet address
   * @param address Wallet address to validate
   * @returns Object with validation result and blockchain type
   */
  validateAddress: (address: string) => {
    const blockchain = detectBlockchain(address);
    return {
      isValid: !!blockchain,
      blockchain
    };
  },
  
  /**
   * Get wallet data
   * @param address Wallet address
   * @returns Promise with wallet data
   */
  getWalletData: async (address: string) => {
    return getWalletData(address);
  }
};
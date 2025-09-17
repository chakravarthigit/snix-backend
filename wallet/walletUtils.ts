import axios from 'axios';
import { API_KEYS, API_ENDPOINTS } from '../config/apiKeys';

/**
 * Detect blockchain type from wallet address
 * @param address Wallet address to check
 * @returns Blockchain type ('ethereum', 'solana', or 'unknown')
 */
export const detectBlockchain = (address: string): 'ethereum' | 'solana' | 'unknown' => {
  // Ethereum addresses are 42 characters long (including '0x') and hexadecimal
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return 'ethereum';
  }
  
  // Solana addresses are 32-44 characters long and base58 encoded
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return 'solana';
  }
  
  return 'unknown';
};

/**
 * Format balance with proper decimals
 * @param balance Raw balance as string
 * @param decimals Number of decimals
 * @returns Formatted balance
 */
export const formatBalance = (balance: string, decimals: number): string => {
  if (!balance) return '0';
  
  // Convert from base units (wei/lamports) to main units (ETH/SOL)
  const balanceNum = parseFloat(balance) / Math.pow(10, decimals);
  
  // Format with appropriate precision
  if (balanceNum < 0.001) {
    return balanceNum.toExponential(4);
  } else if (balanceNum < 1) {
    return balanceNum.toFixed(6);
  } else if (balanceNum < 1000) {
    return balanceNum.toFixed(4);
  } else {
    return balanceNum.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
};

/**
 * Get token price from CoinGecko
 * @param tokenId CoinGecko token ID
 * @returns Token price in USD
 */
export const getTokenPrice = async (tokenId: string): Promise<number> => {
  try {
    const response = await axios.get(
      `${API_ENDPOINTS.COINGECKO}/simple/price?ids=${tokenId}&vs_currencies=usd`
    );
    return response.data[tokenId]?.usd || 0;
  } catch (error) {
    console.error('Error fetching token price:', error);
    return 0;
  }
};

/**
 * Get token logo URL from CoinGecko
 * @param tokenId CoinGecko token ID
 * @returns Logo URL
 */
export const getTokenLogo = async (tokenId: string): Promise<string> => {
  try {
    const response = await axios.get(
      `${API_ENDPOINTS.COINGECKO}/coins/${tokenId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`
    );
    return response.data.image?.small || '';
  } catch (error) {
    console.error('Error fetching token logo:', error);
    return '';
  }
};
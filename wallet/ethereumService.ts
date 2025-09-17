import axios from 'axios';
import { API_KEYS, API_ENDPOINTS } from '../config/apiKeys';
import { WalletData, EthereumTokenBalance, Transaction } from './types';
import { formatBalance, getTokenPrice, getTokenLogo } from './walletUtils';

/**
 * Get Ethereum wallet data including balance, tokens, and transactions
 * @param address Ethereum wallet address
 * @returns Wallet data
 */
export const getEthereumWalletData = async (address: string): Promise<WalletData> => {
  try {
    // Fetch native ETH balance
    const balanceResponse = await axios.get(
      `${API_ENDPOINTS.ALCHEMY_ETH}${API_KEYS.ALCHEMY_ETH_API_KEY}`,
      {
        data: {
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        },
      }
    );
    
    const balanceHex = balanceResponse.data.result;
    const balanceWei = parseInt(balanceHex, 16).toString();
    const ethPrice = await getTokenPrice('ethereum');
    const nativeBalanceEth = formatBalance(balanceWei, 18);
    const nativeBalanceUsd = parseFloat(nativeBalanceEth) * ethPrice;
    
    // Fetch ERC-20 tokens
    const tokensResponse = await axios.get(
      `${API_ENDPOINTS.ALCHEMY_ETH}${API_KEYS.ALCHEMY_ETH_API_KEY}/getTokenBalances/${address}`
    );
    
    const tokenBalances: EthereumTokenBalance[] = [];
    
    // Process token balances
    for (const token of tokensResponse.data.tokenBalances) {
      // Get token metadata
      const metadataResponse = await axios.get(
        `${API_ENDPOINTS.ALCHEMY_ETH}${API_KEYS.ALCHEMY_ETH_API_KEY}/getTokenMetadata?contractAddress=${token.contractAddress}`
      );
      
      const metadata = metadataResponse.data;
      
      // Get token price if available
      let tokenPrice = 0;
      try {
        // Try to find token in CoinGecko
        tokenPrice = await getTokenPrice(metadata.name.toLowerCase().replace(/\s+/g, '-'));
      } catch (error) {
        // If not found, default to 0
        tokenPrice = 0;
      }
      
      // Get token logo
      const logo = await getTokenLogo(metadata.name.toLowerCase().replace(/\s+/g, '-'));
      
      // Format balance
      const formattedBalance = formatBalance(token.tokenBalance, metadata.decimals);
      const balanceUsd = parseFloat(formattedBalance) * tokenPrice;
      
      tokenBalances.push({
        tokenAddress: token.contractAddress,
        symbol: metadata.symbol,
        name: metadata.name,
        decimals: metadata.decimals,
        balance: formattedBalance,
        balanceUsd,
        logo,
        contractType: 'ERC20',
      });
    }
    
    // Fetch recent transactions
    const txResponse = await axios.get(
      `${API_ENDPOINTS.ETHERSCAN}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${API_KEYS.ETHERSCAN_API_KEY}`
    );
    
    const transactions: Transaction[] = txResponse.data.result.map((tx: any) => {
      // Determine transaction type
      let type: 'send' | 'receive' | 'other' | 'swap' = 'other';
      if (tx.from.toLowerCase() === address.toLowerCase()) {
        type = 'send';
      } else if (tx.to.toLowerCase() === address.toLowerCase()) {
        type = 'receive';
      }
      
      return {
        hash: tx.hash,
        timestamp: parseInt(tx.timeStamp),
        from: tx.from,
        to: tx.to,
        value: formatBalance(tx.value, 18),
        fee: formatBalance((parseInt(tx.gasUsed) * parseInt(tx.gasPrice)).toString(), 18),
        status: tx.isError === '0' ? 'success' : 'failed',
        type,
      };
    });
    
    return {
      address,
      blockchain: 'ethereum',
      nativeBalance: nativeBalanceEth,
      nativeBalanceUsd,
      tokens: tokenBalances,
      transactions,
    };
  } catch (error) {
    console.error('Error fetching Ethereum wallet data:', error);
    throw new Error('Failed to fetch Ethereum wallet data');
  }
};
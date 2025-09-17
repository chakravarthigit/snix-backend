import axios from 'axios';
import { API_KEYS, API_ENDPOINTS } from '../config/apiKeys';
import { WalletData, SolanaTokenBalance, Transaction } from './types';
import { formatBalance, getTokenPrice, getTokenLogo } from './walletUtils';

// Helius RPC endpoint with API key
const getHeliusRpcEndpoint = () => `https://mainnet.helius-rpc.com/?api-key=${API_KEYS.HELIUS_API_KEY}`;

/**
 * Get Solana wallet data including balance, tokens, and transactions
 * @param address Solana wallet address
 * @returns Wallet data
 */
export const getSolanaWalletData = async (address: string): Promise<WalletData> => {
  try {
    // Fetch SOL balance using RPC call
    const balanceResponse = await axios.post(
      getHeliusRpcEndpoint(),
      {
        jsonrpc: "2.0",
        id: "get-balance",
        method: "getBalance",
        params: [address]
      }
    );
    
    // Convert lamports to SOL
    const balanceLamports = balanceResponse.data.result.value;
    const balanceSol = formatBalance(balanceLamports, 9); // 9 decimals for SOL
    const solPrice = await getTokenPrice('solana');
    const balanceUsd = parseFloat(balanceSol) * solPrice;
    
    // Fetch token balances using getTokenAccounts
    const tokenBalancesResponse = await axios.post(
      getHeliusRpcEndpoint(),
      {
        jsonrpc: "2.0",
        id: "get-tokens",
        method: "getTokenAccountsByOwner",
        params: [
          address,
          {
            programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
          },
          {
            encoding: "jsonParsed"
          }
        ]
      }
    );
    
    const tokenAccounts = tokenBalancesResponse.data.result.value;
    const tokenBalances: SolanaTokenBalance[] = [];
    
    // Process token balances
    for (const tokenAccount of tokenAccounts) {
      const parsedData = tokenAccount.account.data.parsed.info;
      const tokenMint = parsedData.mint;
      const tokenAmount = parsedData.tokenAmount;
      const balance = formatBalance(tokenAmount.amount, tokenAmount.decimals);
      
      // Try to get additional token info
      let tokenInfo = {
        name: tokenMint.substring(0, 6),  // Use shortened mint as fallback name
        symbol: 'SPL',  // Use 'SPL' as fallback symbol
        logo: ''
      };
      
      // Get token price if available
      let tokenPrice = 0;
      try {
        // If we have a token list or service to lookup token info by mint
        // In a real app, you would use a token list or service
        tokenPrice = await getTokenPrice(tokenMint.substring(0, 6).toLowerCase());
      } catch (e) {
        // Ignore token info errors, use defaults
      }
      
      tokenBalances.push({
        tokenAddress: tokenMint,
        mint: tokenMint,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        balance,
        decimals: tokenAmount.decimals,
        balanceUsd: tokenPrice ? parseFloat(balance) * tokenPrice : 0,
        logo: tokenInfo.logo
      });
    }
    
    // Fetch recent transactions
    const txListResponse = await axios.post(
      getHeliusRpcEndpoint(),
      {
        jsonrpc: "2.0",
        id: "get-signatures",
        method: "getSignaturesForAddress",
        params: [
          address,
          {
            limit: 20
          }
        ]
      }
    );
    
    const signatures = txListResponse.data.result;
    const transactions: Transaction[] = [];
    
    // Get details for each transaction (limit to 10 for performance)
    for (const sig of signatures.slice(0, 10)) {
      try {
        const txDetailsResponse = await axios.post(
          getHeliusRpcEndpoint(),
          {
            jsonrpc: "2.0",
            id: "get-tx",
            method: "getTransaction",
            params: [
              sig.signature,
              {
                encoding: "jsonParsed"
              }
            ]
          }
        );
        
        const txDetails = txDetailsResponse.data.result;
        if (txDetails) {
          const blockTime = txDetails.blockTime || (Date.now() / 1000);
          const fee = txDetails.meta ? txDetails.meta.fee : 0;
          
          // Determine direction (send/receive) based on fee payer
          const feePayer = txDetails.transaction?.message?.accountKeys?.[0] || '';
          const isOutgoing = feePayer === address;
          
          transactions.push({
            hash: sig.signature,
            timestamp: blockTime * 1000, // Convert to milliseconds
            from: feePayer,
            to: '', // Would need more complex logic to determine actual recipient
            value: (fee / 1e9).toString(), // Convert lamports to SOL
            fee: (fee / 1e9).toString(),
            status: 'success', // Assuming confirmed transactions are successful
            type: isOutgoing ? 'send' : 'receive'
          });
        }
      } catch (txError) {
        console.error(`Error fetching transaction ${sig.signature}:`, txError);
        // Continue with next transaction
      }
    }
    
    return {
      address,
      blockchain: 'solana',
      nativeBalance: balanceSol,
      nativeBalanceUsd: balanceUsd,
      tokens: tokenBalances,
      transactions
    };
  } catch (error) {
    console.error('Error fetching Solana wallet data:', error);
    throw new Error('Failed to fetch Solana wallet data');
  }
};
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// API Keys from environment variables
const ALCHEMY_ETH_API_KEY = process.env.ALCHEMY_API_KEY || '';
const ALCHEMY_SOL_API_KEY = process.env.ALCHEMY_API_KEY || '';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || '';

// Log API key availability (don't log the actual keys)
console.log('API Keys loaded: ', {
  ALCHEMY_API_KEY: !!ALCHEMY_ETH_API_KEY,
  HELIUS_API_KEY: !!HELIUS_API_KEY,
  ETHERSCAN_API_KEY: !!ETHERSCAN_API_KEY,
  COINGECKO_API_KEY: !!COINGECKO_API_KEY
});

// API Endpoints
const ALCHEMY_ETH_ENDPOINT = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_ETH_API_KEY}`;
const ALCHEMY_SOL_ENDPOINT = `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_SOL_API_KEY}`;
const ETHERSCAN_ENDPOINT = `https://api.etherscan.io/api?apikey=${ETHERSCAN_API_KEY}`;
// Helius RPC endpoint format
const HELIUS_RPC_ENDPOINT = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
// Helius API endpoint format for v0 endpoints
const HELIUS_API_ENDPOINT = `https://api.helius.xyz/v0`;
const COINGECKO_ENDPOINT = 'https://api.coingecko.com/api/v3';

// Helper function to add CoinGecko API key to URL
const addCoinGeckoApiKeyToUrlHelper = (url: string): string => {
  if (COINGECKO_API_KEY) {
    return url.includes('?') ? `${url}&x_cg_demo_api_key=${COINGECKO_API_KEY}` : `${url}?x_cg_demo_api_key=${COINGECKO_API_KEY}`;
  }
  return url;
};

// Rate limiting and retry logic
const MIN_DELAY_MS = 500; // Minimum delay between API calls
let lastRequestTime = 0;
const MAX_RETRIES = 3;

/**
 * Sleep for specified milliseconds
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Make a rate-limited API call with exponential backoff
 */
async function rateLimitedRequest(config: any, retries = 0): Promise<any> {
  // Ensure we're not sending requests too quickly
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  
  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed);
  }
  
  // Update last request time
  lastRequestTime = Date.now();
  
  try {
    return await axios(config);
  } catch (error: any) {
    // If we get rate limited (429) or server error (5xx)
    if ((error.response?.status === 429 || (error.response?.status >= 500 && error.response?.status < 600)) && retries < MAX_RETRIES) {
      const backoffTime = Math.pow(2, retries) * 1000; // Exponential backoff
      console.log(`Request failed with ${error.response?.status}, retrying in ${backoffTime}ms (attempt ${retries + 1}/${MAX_RETRIES})`);
      await sleep(backoffTime);
      return rateLimitedRequest(config, retries + 1);
    }
    throw error;
  }
}

// Types
export interface Token {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  tokenAddress: string;
  logo?: string;
  price?: number;
  value?: number;
}

export interface Transaction {
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  value: string;
  fee: string;
  status: string;
  type: string;
}

export interface WalletData {
  address: string;
  blockchain: 'ethereum' | 'solana';
  balance: string;
  balanceUsd?: number;
  tokens: Token[];
  transactions: Transaction[];
}

/**
 * Detect blockchain type from wallet address
 * @param address Wallet address
 * @returns Blockchain type ('ethereum', 'solana', or null if invalid)
 */
export const detectBlockchain = (address: string): 'ethereum' | 'solana' | null => {
  // Basic validation for Ethereum addresses
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return 'ethereum';
  }
  
  // Basic validation for Solana addresses (base58 encoding, typically 32-44 chars)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return 'solana';
  }
  
  return null;
};

/**
 * Get Ethereum wallet data
 * @param address Ethereum wallet address
 * @returns Promise with wallet data
 */
export const getEthereumWalletData = async (address: string): Promise<WalletData> => {
  try {
    // Get ETH balance
    const balanceResponse = await axios.post(ALCHEMY_ETH_ENDPOINT, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest']
    });
    
    const balanceWei = parseInt(balanceResponse.data.result, 16);
    const balanceEth = balanceWei / 1e18;
    
    // Get token balances (ERC-20)
    const tokensResponse = await axios.post(ALCHEMY_ETH_ENDPOINT, {
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getTokenBalances',
      params: [address]
    });
    
    // Process tokens
    const tokenBalances = tokensResponse.data.result.tokenBalances || [];
    const tokens: Token[] = await Promise.all(
      tokenBalances.map(async (token: any) => {
        // Get token metadata
        const metadataResponse = await axios.post(ALCHEMY_ETH_ENDPOINT, {
          jsonrpc: '2.0',
          id: 1,
          method: 'alchemy_getTokenMetadata',
          params: [token.contractAddress]
        });
        
        const metadata = metadataResponse.data.result;
        const balance = parseInt(token.tokenBalance, 16) / Math.pow(10, metadata.decimals || 18);
        
        // Get token price from CoinGecko
        let price = 0;
        try {
          const priceUrl = addCoinGeckoApiKeyToUrlHelper(
            `${COINGECKO_ENDPOINT}/simple/token_price/ethereum?contract_addresses=${token.contractAddress}&vs_currencies=usd`
          );
          const priceResponse = await rateLimitedRequest({
            method: 'get',
            url: priceUrl,
          });
          price = priceResponse.data[token.contractAddress.toLowerCase()]?.usd || 0;
        } catch (error: any) {
          console.error(`Error fetching token price for ${metadata.symbol || token.contractAddress}:`, error.message);
        }
        
        return {
          symbol: metadata.symbol || 'UNKNOWN',
          name: metadata.name || 'Unknown Token',
          balance: balance.toString(),
          decimals: metadata.decimals || 18,
          tokenAddress: token.contractAddress,
          logo: metadata.logo,
          price: price,
          value: balance * price
        };
      })
    );
    
    // Get transactions
    const txResponse = await axios.get(
      `${ETHERSCAN_ENDPOINT}&module=account&action=txlist&address=${address}&sort=desc&page=1&offset=10`
    );

    let transactions: Transaction[] = []; // Initialize as empty array

    // Check if the API call was successful and if result is an array
    if (txResponse.data && txResponse.data.status === '1' && Array.isArray(txResponse.data.result)) {
      transactions = txResponse.data.result.map((tx: any) => ({
        hash: tx.hash,
        timestamp: parseInt(tx.timeStamp),
        from: tx.from,
        to: tx.to,
        value: (parseInt(tx.value) / 1e18).toString(),
        fee: (parseInt(tx.gasPrice) * parseInt(tx.gasUsed) / 1e18).toString(),
        status: tx.isError === '0' ? 'success' : 'failed',
        type: tx.from.toLowerCase() === address.toLowerCase() ? 'send' : 'receive'
      }));
    } else if (txResponse.data && txResponse.data.message) {
      // Log the message if there are no transactions or an API error occurred
      console.log(`Etherscan API message for ${address}: ${txResponse.data.message}`);
    } else {
      // Log a generic error if the response structure is unexpected
      console.error(`Unexpected Etherscan API response for ${address}:`, txResponse.data);
    }
    
    // Get ETH price
    let ethPrice = 0;
    try {
      const ethPriceUrl = addCoinGeckoApiKeyToUrlHelper(
        `${COINGECKO_ENDPOINT}/simple/price?ids=ethereum&vs_currencies=usd`
      );
      const ethPriceResponse = await rateLimitedRequest({
        method: 'get',
        url: ethPriceUrl,
      });
      ethPrice = ethPriceResponse.data.ethereum?.usd || 0;
    } catch (error: any) {
      console.error('Error fetching ETH price:', error.message);
    }

    return {
      address,
      blockchain: 'ethereum',
      balance: balanceEth.toString(),
      balanceUsd: balanceEth * ethPrice,
      tokens,
      transactions
    };
  } catch (error: any) {
    console.error('Error fetching Ethereum wallet data:', error);
    throw new Error('Failed to fetch Ethereum wallet data');
  }
};

/**
 * Get Solana wallet data
 * @param address Solana wallet address
 * @returns Promise with wallet data
 */
export const getSolanaWalletData = async (address: string): Promise<WalletData> => {
  try {
    if (!HELIUS_API_KEY) {
      console.error('Helius API Key is missing. Cannot fetch Solana data.');
      // Return a structure indicating the error or an empty state
      return {
        address,
        blockchain: 'solana',
        balance: '0',
        tokens: [],
        transactions: [],
        balanceUsd: 0,
        // You could add an error field here if your WalletData interface supports it
      };
    }

    console.log(`Fetching Solana wallet data for ${address} using Helius...`);
    
    // Get SOL balance with rate limiting
    const balanceResponse = await rateLimitedRequest({
      method: 'post',
      url: HELIUS_RPC_ENDPOINT,
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address]
      }
    });
    
    const balanceLamports = balanceResponse.data.result.value;
    const balanceSol = balanceLamports / 1e9;
    
    // Get token accounts (SPL tokens) with rate limiting
    const tokensResponse = await rateLimitedRequest({
      method: 'post',
      url: HELIUS_RPC_ENDPOINT,
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [
          address,
          { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
          { encoding: 'jsonParsed' }
        ]
      }
    });
    
    // Process tokens
    const tokenAccounts = tokensResponse.data.result.value || [];
    const tokens: Token[] = await Promise.all(
      tokenAccounts.map(async (account: any) => {
        const tokenData = account.account.data.parsed.info;
        const mintAddress = tokenData.mint;
        
        // Get token metadata
        let tokenInfo: any = {
          symbol: 'UNKNOWN',
          name: 'Unknown Token',
          decimals: tokenData.tokenAmount.decimals || 9,
          logo: ''
        };
        
        try {
          // Try to get token metadata from Solana token list
          const tokenListResponse = await rateLimitedRequest({
            method: 'get',
            url: 'https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json'
          });
          
          const foundToken = tokenListResponse.data.tokens.find(
            (t: any) => t.address === mintAddress
          );
          
          if (foundToken) {
            tokenInfo.symbol = foundToken.symbol;
            tokenInfo.name = foundToken.name;
            tokenInfo.logo = foundToken.logoURI;
          }
        } catch (error: any) {
          console.error('Error fetching token metadata:', error);
        }
        
        // Get token price from CoinGecko
        let price = 0;
        try {
          const priceUrl = addCoinGeckoApiKeyToUrlHelper(
            `${COINGECKO_ENDPOINT}/simple/token_price/solana?contract_addresses=${mintAddress}&vs_currencies=usd`
          );
          const priceResponse = await rateLimitedRequest({
            method: 'get',
            url: priceUrl,
          });
          price = priceResponse.data[mintAddress.toLowerCase()]?.usd || 0;
        } catch (error: any) {
          console.error(`Error fetching token price for ${tokenInfo.symbol || mintAddress} (Solana):`, error.message);
        }
        
        const balance = tokenData.tokenAmount.uiAmount;
        
        return {
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          balance: balance.toString(),
          decimals: tokenInfo.decimals,
          tokenAddress: mintAddress,
          logo: tokenInfo.logo,
          price: price,
          value: balance * price
        };
      })
    );
    
    // Get transactions with rate limiting
    const txResponse = await rateLimitedRequest({
      method: 'post',
      url: HELIUS_RPC_ENDPOINT,
      data: {
        jsonrpc: '2.0',
        id: 'helius-test',
        method: 'getSignaturesForAddress',
        params: [address, { limit: 5 }] // Reduced from 10 to 5 to lower API load
      }
    });
    
    const signatures = (txResponse.data && Array.isArray(txResponse.data.result)) ? txResponse.data.result : [];
    const transactions: Transaction[] = [];

    // Process up to 5 transactions for performance
    if (signatures.length > 0) {
      for (const sig of signatures.slice(0, 5)) {
        if (!sig || !sig.signature) continue; // Skip if signature is invalid
        try {
          // Get transaction details with rate limiting
          const txDetailsResponse = await rateLimitedRequest({
            method: 'post',
            url: HELIUS_RPC_ENDPOINT,
            data: {
              jsonrpc: '2.0',
              id: 'tx-details',
              method: 'getTransaction',
              params: [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
            }
          });

          const txDetails = txDetailsResponse.data && txDetailsResponse.data.result;
          if (txDetails) {
            const blockTime = txDetails.blockTime || (Date.now() / 1000);
            const fee = txDetails.meta?.fee || 0;

            // Simplified transaction parsing
            const feePayerAccount = txDetails.transaction?.message?.accountKeys?.find((acc: any) => acc.signer && acc.writable);
            const feePayer = feePayerAccount ? feePayerAccount.pubkey : (txDetails.transaction?.message?.accountKeys?.[0]?.pubkey || '');
            
            // Determine transaction type (send/receive) more reliably
            let type = 'unknown';
            const accountIndex = txDetails.transaction?.message?.accountKeys?.findIndex((acc: any) => acc.pubkey === address);
            
            if (accountIndex !== -1 && txDetails.meta?.preBalances && txDetails.meta?.postBalances) {
              const preBalance = txDetails.meta.preBalances[accountIndex];
              const postBalance = txDetails.meta.postBalances[accountIndex];
              if (postBalance < preBalance) {
                type = 'send';
              } else if (postBalance > preBalance) {
                type = 'receive';
              }
            }
            // Fallback if balance comparison is not definitive (e.g. token interaction without SOL change for the address itself)
            if (type === 'unknown' && feePayer === address) {
                 type = 'send'; // If user paid the fee, likely a send or contract interaction
            }

            transactions.push({
              hash: sig.signature,
              timestamp: blockTime * 1000, // Convert to milliseconds
              from: feePayer, // Best guess for 'from'
              to: '', // To determine recipient needs deeper parsing of instructions, complex for now
              value: (fee / 1e9).toString(), // This is just the fee, actual value transfer is more complex
              fee: (fee / 1e9).toString(),
              status: txDetails.meta?.err ? 'failed' : 'success',
              type: type
            });
          } else {
            console.log(`No details found for Solana signature: ${sig.signature}`);
          }
        } catch (err: any) {
          console.error(`Error fetching Solana transaction details for sig ${sig.signature}:`, err.message);
          // Continue to next transaction
        }
      }
    } else {
      console.log(`No Solana transaction signatures found for address ${address}`);
    }
    
    // Get SOL native price from CoinGecko
    let solPrice = 0;
    try {
      const solPriceUrl = addCoinGeckoApiKeyToUrlHelper(
        `${COINGECKO_ENDPOINT}/simple/price?ids=solana&vs_currencies=usd`
      );
      const solPriceResponse = await rateLimitedRequest({
        method: 'get',
        url: solPriceUrl,
      });
      solPrice = solPriceResponse.data.solana?.usd || 0;
    } catch (error: any) {
      console.error('Error fetching SOL price:', error.message);
    }

    return {
      address,
      blockchain: 'solana',
      balance: balanceSol.toString(),
      balanceUsd: balanceSol * solPrice,
      tokens,
      transactions
    };
  } catch (error: any) {
    console.error('Error fetching Solana wallet data:', error);
    throw new Error('Failed to fetch Solana wallet data');
  }
};

/**
 * Get wallet data for any supported blockchain
 * @param address Wallet address
 * @returns Promise with wallet data
 */
export const getWalletData = async (address: string): Promise<WalletData> => {
  const blockchain = detectBlockchain(address);
  
  if (!blockchain) {
    throw new Error('Invalid wallet address');
  }
  
  if (blockchain === 'ethereum') {
    return getEthereumWalletData(address);
  } else {
    return getSolanaWalletData(address);
  }
};
import axios from 'axios';

// Base URLs for APIs
const DEXSCREENER_API = 'https://api.dexscreener.com/latest';
const COINPAPRIKA_API = 'https://api.coinpaprika.com/v1';

// CoinPaprika API key - for Pro features, loaded from .env
const COINPAPRIKA_API_KEY = process.env.COINPAPRIKA_API_KEY || '';

// Rate limiting for CoinPaprika
const MIN_PAPRIKA_DELAY_MS = 1000; // 1 second, adjust based on CoinPaprika's free/paid tier limits
let lastPaprikaRequestTime = Date.now();
let hasLoggedPaprikaRateLimitWarning = false;

// Helper function to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Rate-limited request function for CoinPaprika
async function rateLimitedCoinPaprikaRequest(config: any) {
  const now = Date.now();
  const elapsed = now - lastPaprikaRequestTime;

  if (elapsed < MIN_PAPRIKA_DELAY_MS) {
    await sleep(MIN_PAPRIKA_DELAY_MS - elapsed);
  }

  // Add API key if available and it's a CoinPaprika API URL
  if (COINPAPRIKA_API_KEY && config.url && config.url.includes(COINPAPRIKA_API)) {
    if (!config.headers) config.headers = {};
    // CoinPaprika Pro API key is typically sent as an 'Authorization' header
    // For the free tier, no key is needed. This example assumes a Pro key setup.
    // If using a free plan, this header might not be necessary or could cause issues.
    // Refer to CoinPaprika documentation for specific key usage.
    config.headers['Authorization'] = COINPAPRIKA_API_KEY; 
  }

  lastPaprikaRequestTime = Date.now();

  try {
    console.log('Making CoinPaprika request with config:', JSON.stringify(config, null, 2));
    const response = await axios(config);
    console.log('CoinPaprika response status:', response.status);
    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Axios error in CoinPaprika request:', error.message);
      if (error.response) {
        console.error('CoinPaprika error response status:', error.response.status);
        console.error('CoinPaprika error response data:', JSON.stringify(error.response.data, null, 2));
        if (error.response.status === 401) { // Unauthorized - API key issue
          console.error('CoinPaprika API Key is invalid, missing, or not authorized for this resource.');
        } else if (error.response.status === 429) { // Too Many Requests
          if (!hasLoggedPaprikaRateLimitWarning) {
            console.warn('CoinPaprika API rate limit reached (429 Too Many Requests)');
            hasLoggedPaprikaRateLimitWarning = true;
            setTimeout(() => { hasLoggedPaprikaRateLimitWarning = false; }, 60000);
          }
        }
      }
    } else {
      console.error('Non-Axios error in CoinPaprika request:', error);
    }
    throw error; // Still throw so the controller can handle it
  }
}

// Regular request function for non-CoinGecko APIs
async function regularRequest(config: any) {
  return axios(config);
}

// Controller for cryptocurrency operations
export const cryptoController = {
  /**
   * Search for coins by query string
   * @param query Search query
   * @returns Promise with search results
   */
  searchCoins: async (query: string) => {
    try {
      console.log(`Searching for coins with query: ${query}`);
      
      if (!query || query.trim().length < 2) {
        return {
          success: true,
          data: {
            memeAndTrendingCoins: [],
            majorCoins: []
          }
        };
      }
      
      // Search in Dexscreener for tokens (remains the same)
      const dexResponse = await regularRequest({
        method: 'get',
        url: `${DEXSCREENER_API}/dex/search?q=${encodeURIComponent(query)}`
      });
      
      const dexTokens = dexResponse.data.pairs || [];
      const formattedDexTokens = dexTokens
        .slice(0, 5) 
        .map((token: any) => ({
          id: token.pairAddress,
          name: token.baseToken.name,
          symbol: token.baseToken.symbol,
          price: parseFloat(token.priceUsd || '0'),
          priceChange24h: parseFloat(token.priceChange.h24 || '0'),
          volume24h: parseFloat(token.volume.h24 || '0'),
          liquidity: parseFloat(token.liquidity.usd || '0'),
          isMemeCoin: true,
          source: 'dexscreener'
        }));
      
      let formattedPaprikaCoins: any[] = [];
      try {
        // Search in CoinPaprika
        // CoinPaprika's search endpoint: /search?q={query}&c=currencies (for coins)
        const searchResponse = await rateLimitedCoinPaprikaRequest({
          method: 'get',
          url: `${COINPAPRIKA_API}/search?q=${encodeURIComponent(query)}&c=currencies&limit=5` // Limit results
        });
        
        const coinResults = searchResponse.data.currencies || [];
        
        if (coinResults.length > 0) {
          // Fetch ticker data for these coins to get market details
          // CoinPaprika's /tickers endpoint can take multiple IDs, but it's often easier to fetch one by one or use /tickers and filter if the list is small
          // For simplicity here, we'll fetch tickers for the found coin IDs. 
          // A more optimized approach might be to fetch all tickers and filter, or use a batch endpoint if available.
          const paprikaCoinPromises = coinResults.map(async (coin: any) => {
            try {
              const tickerResponse = await rateLimitedCoinPaprikaRequest({
                method: 'get',
                url: `${COINPAPRIKA_API}/tickers/${coin.id}?quotes=USD`
              });
              const tickerData = tickerResponse.data;
              return {
                id: tickerData.id,
                name: tickerData.name,
                symbol: tickerData.symbol.toUpperCase(),
                price: tickerData.quotes?.USD?.price || 0,
                priceChange24h: tickerData.quotes?.USD?.percent_change_24h || 0,
                volume24h: tickerData.quotes?.USD?.volume_24h || 0,
                marketCap: tickerData.quotes?.USD?.market_cap || 0,
                rank: tickerData.rank,
                logoUrl: `https://static.coinpaprika.com/coin/${tickerData.id}/logo.png`, // Construct logo URL
                source: 'coinpaprika'
              };
            } catch (err) {
              console.error(`Error fetching ticker for ${coin.id} from CoinPaprika:`, err);
              // Fallback to basic info from search if ticker fails
              return {
                id: coin.id,
                name: coin.name,
                symbol: coin.symbol.toUpperCase(),
                price: 0, priceChange24h: 0, volume24h: 0, marketCap: 0,
                rank: coin.rank,
                logoUrl: `https://static.coinpaprika.com/coin/${coin.id}/logo.png`,
                source: 'coinpaprika'
              };
            }
          });
          formattedPaprikaCoins = await Promise.all(paprikaCoinPromises);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 429) {
          console.log('Using only DEX results due to CoinPaprika rate limit');
        } else {
          console.error('Error with CoinPaprika search:', error);
        }
      }
      
      return {
        success: true,
        data: {
          memeAndTrendingCoins: formattedDexTokens,
          majorCoins: formattedPaprikaCoins
        }
      };
    } catch (error) {
      console.error('Error searching coins:', error);
      return {
        success: false,
        error: 'Failed to search coins'
      };
    }
  },
  
  getCoinDetails: async (coinId: string, source: string) => {
    try {
      console.log(`Getting details for coin: ${coinId} from source: ${source}`);
      
      if (source === 'dexscreener') {
        // Dexscreener logic remains the same
        const response = await regularRequest({
          method: 'get',
          url: `${DEXSCREENER_API}/dex/pairs/${coinId}`
        });
        const pair = response.data.pairs?.[0];
        if (!pair) throw new Error('Pair not found');
        return {
          success: true,
          data: {
            id: pair.pairAddress,
            name: pair.baseToken.name,
            symbol: pair.baseToken.symbol,
            price: parseFloat(pair.priceUsd || '0'),
            priceChange24h: parseFloat(pair.priceChange.h24 || '0'),
            volume24h: parseFloat(pair.volume.h24 || '0'),
            liquidity: parseFloat(pair.liquidity.usd || '0'),
            website: pair.url || '',
            isMemeCoin: true,
            source: 'dexscreener'
          }
        };
      } else { // Assuming 'coinpaprika' or default to coinpaprika
        try {
          // Get coin details from CoinPaprika: /coins/{coin_id}
          const coinDetailsResponse = await rateLimitedCoinPaprikaRequest({
            method: 'get',
            url: `${COINPAPRIKA_API}/coins/${coinId}`
          });
          const details = coinDetailsResponse.data;

          // Get ticker data for market info: /tickers/{coin_id}
          const tickerResponse = await rateLimitedCoinPaprikaRequest({
            method: 'get',
            url: `${COINPAPRIKA_API}/tickers/${coinId}?quotes=USD`
          });
          const ticker = tickerResponse.data;
          
          return {
            success: true,
            data: {
              id: details.id,
              name: details.name,
              symbol: details.symbol.toUpperCase(),
              price: ticker.quotes?.USD?.price || 0,
              priceChange24h: ticker.quotes?.USD?.percent_change_24h || 0,
              volume24h: ticker.quotes?.USD?.volume_24h || 0,
              marketCap: ticker.quotes?.USD?.market_cap || 0,
              rank: details.rank,
              logoUrl: `https://static.coinpaprika.com/coin/${details.id}/logo.png`,
              description: details.description || '',
              website: details.links?.website?.[0] || '',
              twitter: details.links?.twitter?.[0]?.url || '',
              reddit: details.links?.reddit?.[0]?.url || '',
              github: details.links?.source_code?.[0] || '',
              source: 'coinpaprika'
            }
          };
        } catch (error) {
          // Handle specific error cases
          if (axios.isAxiosError(error)) {
            if (error.response?.status === 404) {
              console.log(`Coin ID not found in Coinpaprika: ${coinId}`);
              return {
                success: false,
                error: 'Token not found in database',
                data: {
                  id: coinId,
                  name: 'Unknown Token',
                  symbol: 'N/A',
                  message: 'This token was not found in our database. It might be a new or unlisted token.'
                }
              };
            } else if (error.response?.status === 429 || error.response?.status === 401) {
              return {
                success: false,
                error: `CoinPaprika API error: ${error.response.status === 429 ? 'Rate limit reached.' : 'Unauthorized.'} Please try again later or check API key.`
              };
            }
          }
          // Re-throw other errors
          throw error;
        }
      }
    } catch (error) {
      console.error(`Error getting coin details for ${coinId}:`, error);
      return {
        success: false,
        error: 'Failed to get coin details',
        message: axios.isAxiosError(error) ? error.response?.data?.error || error.message : 'Unknown error'
      };
    }
  },
  
  getPriceHistory: async (coinId: string, days: string = '7') => {
    try {
      console.log(`Getting price history for coin: ${coinId} (CoinPaprika) for ${days} days`);
      const numDays = parseInt(days, 10);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - numDays);
      const startISO = startDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // CoinPaprika historical ticker data: /tickers/{coin_id}/historical
      const response = await rateLimitedCoinPaprikaRequest({
        method: 'get',
        url: `${COINPAPRIKA_API}/tickers/${coinId}/historical?start=${startISO}&interval=1d&quotes=USD`
      });

      const historyData = response.data;
      if (!historyData || historyData.length === 0) {
        return {
          success: true,
          data: [] // Return empty array if no history
        };
      }

      // Format: [{ timestamp: string (ISO), price: number, volume_24h: number, market_cap: number }]
      // We need [timestamp_ms, price]
      const formattedHistory = historyData.map((dataPoint: any) => [
        new Date(dataPoint.timestamp).getTime(), // Convert ISO string to milliseconds timestamp
        dataPoint.price
      ]);

      return {
        success: true,
        data: formattedHistory
      };
    } catch (error) {
      console.error(`Error getting price history for ${coinId} from CoinPaprika:`, error);
      if (axios.isAxiosError(error) && (error.response?.status === 429 || error.response?.status === 401)) {
        return {
          success: false,
          error: `CoinPaprika API error: ${error.response.status === 429 ? 'Rate limit reached.' : 'Unauthorized.'} Cannot fetch price history.`
        };
      }
      return {
        success: false,
        error: `Failed to get price history for ${coinId}`
      };
    }
  },
};

// Remove CoinGecko specific environment variable loading and functions.
// The COINGECKO_API_KEY is already removed from the top.
// The rateLimitedCoinGeckoRequest function is replaced by rateLimitedCoinPaprikaRequest.
// All CoinGecko API calls are replaced with CoinPaprika calls.

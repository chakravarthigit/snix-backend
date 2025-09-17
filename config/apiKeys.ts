import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Get the current directory
const currentDir = __dirname;
console.log('Current directory:', currentDir);

// Load environment variables from .env file
// First try the .env file in the current directory
const envPath = path.resolve(currentDir, '../.env');
console.log('Looking for .env at:', envPath);

// Check if .env file exists
if (fs.existsSync(envPath)) {
  console.log('.env file found at:', envPath);
  dotenv.config({ path: envPath });
  console.log('Loaded environment variables from .env');
  console.log('HELIUS_API_KEY loaded:', process.env.HELIUS_API_KEY ? 'Yes' : 'No');
} else {
  console.log('WARNING: .env file not found at:', envPath);
  // Try to load from default location
  dotenv.config();
}

// API keys for various blockchain services
export const API_KEYS = {
  // Ethereum APIs
  ALCHEMY_ETH_API_KEY: process.env.ALCHEMY_API_KEY || '',
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || '',
  
  // Solana APIs
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || '',
  
  // Price APIs
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || '', // Free tier if not provided
};

// API endpoints
export const API_ENDPOINTS = {
  // Ethereum endpoints
  ALCHEMY_ETH: 'https://eth-mainnet.g.alchemy.com/v2/',
  ETHERSCAN: 'https://api.etherscan.io/api',
  
  // Solana endpoints
  HELIUS: 'https://api.helius.xyz/v0/',
  SOLANA_RPC: 'https://api.mainnet-beta.solana.com',
  
  // Price APIs
  COINGECKO: 'https://api.coingecko.com/api/v3',
};
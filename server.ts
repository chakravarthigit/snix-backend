import express, { Request } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { walletController } from './controllers/walletController';
import { cryptoController } from './controllers/cryptoController';
import { userController } from './controllers/userController';
import newsRoutes from './routes/newsRoutes';
import aiRoutes from './routes/aiRoutes';

// Define custom interface to extend Express Request
interface CustomRequest extends Request {
  user?: {
    userId: string;
    email: string;
    [key: string]: any;
  };
}

// Load environment variables
dotenv.config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("No MongoDB connection string. Set MONGODB_URI environment variable.");
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Successfully connected to MongoDB!');
    console.log(`🔗 Using MongoDB URI: ${MONGODB_URI.replace(/\/\/(.+?)@/, '//****:****@')}`);
  })
  .catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
    process.exit(1);
  });

// Initialize express app
const app = express();
const PORT = Number(process.env.PORT || 3000); // Ensure PORT is a number

// Middleware
app.use(cors({
  origin: '*', // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/api/health', (req, res) => {
  // Check MongoDB connection status
  const isMongoConnected = mongoose.connection.readyState === 1; // 1 means connected
  
  res.json({ 
    status: 'ok', 
    message: 'Snix API is running',
    database: {
      connected: isMongoConnected,
      status: isMongoConnected ? 'connected' : 'disconnected'
    }
  });
});

// News API routes
app.use('/api/news', newsRoutes);

// AI API routes
app.use('/api/ai', aiRoutes);

// Crypto routes
app.get('/api/crypto/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    const result = await cryptoController.searchCoins(query);
    res.json(result);
  } catch (error) {
    console.error('Error in /api/crypto/search:', error);
    res.status(500).json({ success: false, error: 'Failed to search coins' });
  }
});

app.get('/api/crypto/details/:coinId', async (req, res) => {
  try {
    const coinId = req.params.coinId;
    const source = req.query.source as string || 'coingecko'; // Default to coingecko
    const result = await cryptoController.getCoinDetails(coinId, source);
    res.json(result);
  } catch (error) {
    console.error(`Error in /api/crypto/details/${req.params.coinId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to get coin details' });
  }
});

app.get('/api/crypto/price-history/:coinId', async (req, res) => {
  try {
    const coinId = req.params.coinId;
    const days = req.query.days as string || '7';
    const result = await cryptoController.getPriceHistory(coinId, days);
    res.json(result);
  } catch (error) {
    console.error(`Error in /api/crypto/price-history/${req.params.coinId}:`, error);
    res.status(500).json({ success: false, error: 'Failed to get price history' });
  }
});

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    
    // Validate request body
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await userController.register({ fullName, email, password });
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error in /api/auth/register:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate request body
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }
    
    const result = await userController.login(email, password);
    if (!result.success) {
      return res.status(401).json({ error: result.message });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in /api/auth/login:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Protected route - Get current user profile
app.get('/api/auth/profile', userController.verifyToken, async (req: CustomRequest, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const result = await userController.getProfile(req.user.userId);
    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in /api/auth/profile:', error);
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

// Wallet routes
app.get('/api/wallet/validate/:address', (req, res) => {
  try {
    const { address } = req.params;
    const result = walletController.validateAddress(address);
    res.json(result);
  } catch (error) {
    console.error('Error validating wallet address:', error);
    res.status(500).json({ error: 'Failed to validate wallet address' });
  }
});

// Protected route - Update user's wallet address
app.put('/api/auth/wallet-address', userController.verifyToken, async (req: CustomRequest, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }
    
    // Validate the wallet address format
    const isValid = walletController.validateAddress(walletAddress);
    if (!isValid.isValid) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }
    
    const result = await userController.updateWalletAddress(req.user.userId, walletAddress);
    if (!result.success) {
      return res.status(404).json({ error: result.message });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error updating wallet address:', error);
    res.status(500).json({ error: 'Server error updating wallet address' });
  }
});

// Protected route - Get user's wallet address
app.get('/api/auth/wallet-address', userController.verifyToken, async (req: CustomRequest, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const result = await userController.getProfile(req.user.userId);
    if (!result.success || !result.user) {
      return res.status(404).json({ error: result.message || 'User not found' });
    }
    
    res.json({
      success: true,
      walletAddress: result.user.walletAddress || ''
    });
  } catch (error) {
    console.error('Error fetching wallet address:', error);
    res.status(500).json({ error: 'Server error fetching wallet address' });
  }
});

app.get('/api/wallet/data/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const data = await walletController.getWalletData(address);
    res.json(data);
  } catch (error) {
    console.error('Error fetching wallet data:', error);
    res.status(500).json({ error: 'Failed to fetch wallet data' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Snix backend server running on port ${PORT}`);
  console.log(`🌐 Server accessible at http://localhost:${PORT} and http://192.168.1.3:${PORT}`);
});

export default app;

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose, { CallbackError } from 'mongoose';
import { Request, Response, NextFunction } from 'express';

// Use JWT_SECRET from local .env file
const JWT_SECRET = process.env.JWT_SECRET as string;

// Ensure JWT_SECRET is defined
if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in the environment variables.');
  process.exit(1);
}

// Define custom interface to extend Express Request
interface CustomRequest extends Request {
  user?: {
    userId: string;
    email: string;
    [key: string]: any;
  };
}

// Define JWT payload interface
interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Define user data interface
interface UserData {
  fullName: string;
  email: string;
  password: string;
}

// Error type
interface ApiError extends Error {
  message: string;
}

// Define the User schema
const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  walletAddress: {
    type: String,
    trim: true,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to hash the password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: unknown) {
    next(error as CallbackError);
  }
});

// Create the User model
const User = mongoose.model('User', userSchema);

// User controller functions
class UserController {
  // Register a new user
  async register(userData: UserData) {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        return { success: false, message: 'User already exists with this email' };
      }
      
      // Create new user
      const user = new User({
        fullName: userData.fullName,
        email: userData.email,
        password: userData.password
      });
      
      // Save the user to the database
      await user.save();
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id.toString(), email: user.email } as JWTPayload,
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      return {
        success: true,
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email
        }
      };
    } catch (error: unknown) {
      console.error('Error in register:', error);
      const apiError = error as ApiError;
      return { success: false, message: 'Failed to register user', error: apiError.message };
    }
  }
  
  // Login user
  async login(email: string, password: string) {
    try {
      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return { success: false, message: 'Invalid email or password' };
      }
      
      // Compare passwords
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return { success: false, message: 'Invalid email or password' };
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id.toString(), email: user.email } as JWTPayload,
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      return {
        success: true,
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email
        }
      };
    } catch (error: unknown) {
      console.error('Error in login:', error);
      const apiError = error as ApiError;
      return { success: false, message: 'Failed to login', error: apiError.message };
    }
  }
  
  // Get user profile
  async getProfile(userId: string) {
    try {
      const user = await User.findById(userId).select('-password');
      if (!user) {
        return { success: false, message: 'User not found' };
      }
      
      return {
        success: true,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          walletAddress: user.walletAddress || '',
          createdAt: user.createdAt
        }
      };
    } catch (error: unknown) {
      console.error('Error in getProfile:', error);
      const apiError = error as ApiError;
      return { success: false, message: 'Failed to get user profile', error: apiError.message };
    }
  }
  
  // Update wallet address for a user
  async updateWalletAddress(userId: string, walletAddress: string) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { walletAddress },
        { new: true, runValidators: true }
      ).select('-password');
      
      if (!user) {
        return { success: false, message: 'User not found' };
      }
      
      return {
        success: true,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          walletAddress: user.walletAddress,
          createdAt: user.createdAt
        }
      };
    } catch (error: unknown) {
      console.error('Error in updateWalletAddress:', error);
      const apiError = error as ApiError;
      return { success: false, message: 'Failed to update wallet address', error: apiError.message };
    }
  }
  
  // Middleware to verify JWT token
  verifyToken(req: CustomRequest, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ message: 'No token provided' });
      }
      
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = { userId: decoded.userId, email: decoded.email };
      next();
    } catch (error: unknown) {
      return res.status(401).json({ message: 'Invalid token' });
    }
  }
}

export const userController = new UserController(); 
import express from 'express';
import { newsService } from '../services/newsService';

const router = express.Router();

/**
 * @route   GET /api/news/crypto
 * @desc    Get latest cryptocurrency news
 * @access  Public
 */
router.get('/crypto', async (req, res) => {
  try {
    const result = await newsService.getCryptoNews();
    
    if (result.error) {
      return res.status(500).json({ 
        success: false, 
        message: result.error 
      });
    }
    
    return res.json({ 
      success: true, 
      data: result.articles 
    });
  } catch (err) {
    console.error('Server error in /api/news/crypto:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

export default router; 
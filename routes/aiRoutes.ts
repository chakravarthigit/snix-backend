import express from 'express';
import dotenv from 'dotenv';
import axios, { AxiosError } from 'axios';

// Load environment variables from .env file
dotenv.config();

const router = express.Router();

// Log API key availability at startup
console.log('AI Routes - TOGETHER_API_KEY available:', !!process.env.TOGETHER_API_KEY);
if (!process.env.TOGETHER_API_KEY) {
  console.warn('WARNING: TOGETHER_API_KEY is not set in environment variables!');
}

/**
 * @route   GET /api/ai/credentials
 * @desc    Get Together API credentials (for accessing Llama models)
 * @access  Public (should be protected in production)
 */
router.get('/credentials', async (req, res) => {
  try {
    console.log('Received request for AI credentials');
    
    // Get API key from environment variable
    const togetherApiKey = process.env.TOGETHER_API_KEY;
    
    if (!togetherApiKey) {
      console.error('TOGETHER_API_KEY not found in environment variables');
      return res.status(500).json({ 
        success: false, 
        message: 'Together API key not configured on server' 
      });
    }
    
    console.log('Returning API key (first 8 chars):', togetherApiKey.substring(0, 8) + '...');
    return res.json({ 
      success: true, 
      data: {
        togetherApiKey
      }
    });
  } catch (err: any) {
    console.error('Server error in /api/ai/credentials:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

/**
 * @route   GET /api/ai/test
 * @desc    Test the API key directly with Together API
 * @access  Public (for testing only)
 */
router.get('/test', async (req, res) => {
  try {
    console.log('Testing Together API key directly from backend...');
    
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        success: false, 
        message: 'Together API key not configured on server' 
      });
    }
    
    // Log key format for debugging
    console.log(`Key format: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
    console.log(`Key length: ${apiKey.length}`);
    
    try {
      // First, test the models endpoint which requires less permissions
      const modelsResponse = await axios.get('https://api.together.xyz/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      console.log('Models API response status:', modelsResponse.status);
      
      // Now try a simple completion request
      const completionResponse = await axios.post('https://api.together.xyz/v1/completions', {
        model: "mistralai/Mistral-7B-Instruct-v0.2",
        prompt: "Hello, how are you?",
        max_tokens: 10,
        temperature: 0.7
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      console.log('Completion API response status:', completionResponse.status);
      
      // Return success with sample response
      return res.json({
        success: true,
        message: 'API key works with Together API',
        models: modelsResponse.data.data ? modelsResponse.data.data.length : 'unknown',
        sampleResponse: completionResponse.data.choices[0]?.text || 'No response text'
      });
    } catch (error) {
      const apiError = error as AxiosError;
      console.error('Together API error:', apiError.message);
      let errorDetails = 'Unknown error';
      
      if (apiError.response) {
        console.error('API Error response status:', apiError.response.status);
        console.error('API Error response data:', JSON.stringify(apiError.response.data, null, 2));
        errorDetails = `Status ${apiError.response.status}: ${JSON.stringify(apiError.response.data)}`;
      } else if (apiError.request) {
        errorDetails = 'No response received from API';
      }
      
      return res.status(500).json({
        success: false,
        message: 'API key authentication failed with Together API',
        error: apiError.message,
        details: errorDetails
      });
    }
  } catch (error: any) {
    console.error('Server error in /api/ai/test:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/ai/chat
 * @desc    Get a chat response from the AI
 * @access  Public
 */
router.post('/chat', async (req, res) => {
  try {
    const { prompt, systemPrompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        message: 'Prompt is required' 
      });
    }

    // This endpoint will be implemented later to directly call the Together API from the backend
    // This helps keep the API key secure on the server
    
    return res.status(501).json({
      success: false,
      message: 'This endpoint is not yet implemented'
    });
  } catch (error: any) {
    console.error('Server error in /api/ai/chat:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

export default router; 
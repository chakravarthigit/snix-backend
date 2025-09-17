import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  image: string;
  source: {
    name: string;
  };
  publishedAt: string;
}

interface NewsResponse {
  articles: NewsArticle[];
  error?: string;
}

export const newsService = {
  /**
   * Fetch cryptocurrency news from GNews API
   * @returns Promise<NewsResponse> - Array of news articles or error
   */
  getCryptoNews: async (): Promise<NewsResponse> => {
    try {
      const apiKey = process.env.GNEWS_API_KEY;
      
      if (!apiKey) {
        console.error('GNEWS_API_KEY is not defined in environment variables');
        return { 
          articles: [],
          error: 'API key not configured' 
        };
      }

      // Keywords related to cryptocurrency
      const keywords = 'crypto OR bitcoin OR ethereum OR "rug pull" OR hack';
      
      const response = await axios.get('https://gnews.io/api/v4/search', {
        params: {
          q: keywords,
          token: apiKey,
          lang: 'en',
          max: 10,
          sortby: 'publishedAt'
        }
      });

      // Check if response has expected structure
      if (!response.data || !Array.isArray(response.data.articles)) {
        console.error('Invalid API response structure:', response.data);
        return { 
          articles: [],
          error: 'Invalid API response' 
        };
      }

      return { 
        articles: response.data.articles.map((article: any) => ({
          title: article.title,
          description: article.description,
          url: article.url,
          image: article.image,
          source: {
            name: article.source?.name || 'Unknown'
          },
          publishedAt: article.publishedAt
        }))
      };
    } catch (error) {
      console.error('Error fetching crypto news:', error);
      return { 
        articles: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}; 
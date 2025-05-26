import axios from 'axios';
import * as cheerio from 'cheerio';
import { OpenAI } from 'openai';
import { logger } from './logger.js';
import { config } from './config.js';

export class WebsiteAnalyzer {
  constructor() {
    this.lmStudioClient = new OpenAI({
      baseURL: config.lmStudio.baseURL,
      apiKey: 'lm-studio',
      timeout: config.lmStudio.timeout
    });
  }

  async fetchWebsite(url) {
    try {
      logger.info(`Fetching website: ${url}`);
      
      // Validate URL
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Invalid URL protocol. Only HTTP and HTTPS are supported.');
      }

      const response = await axios.get(url, {
        timeout: config.analysis.requestTimeout,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      // Check content type
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html')) {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $('script, style, noscript').remove();
      
      const content = {
        url,
        title: $('title').text().trim() || '',
        metaDescription: $('meta[name="description"]').attr('content')?.trim() || '',
        metaKeywords: $('meta[name="keywords"]').attr('content')?.trim() || '',
        headings: this.extractHeadings($),
        bodyText: this.extractBodyText($),
        links: this.extractLinks($, urlObj),
        images: this.extractImages($, urlObj),
        fetchedAt: new Date().toISOString(),
        statusCode: response.status,
        contentLength: response.data.length
      };

      logger.success(`Successfully fetched website: ${url}`, {
        title: content.title,
        contentLength: content.contentLength,
        headingsCount: content.headings.length,
        linksCount: content.links.length
      });

      return content;
    } catch (error) {
      logger.error(`Failed to fetch website: ${url}`, { error: error.message });
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
  }

  extractHeadings($) {
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((i, el) => {
      const text = $(el).text().trim();
      if (text) {
        headings.push({
          level: parseInt(el.tagName.substring(1)),
          text: text.substring(0, 200)
        });
      }
    });
    return headings;
  }

  extractBodyText($) {
    // Remove unwanted elements
    $('nav, footer, aside, .ad, .advertisement, .sidebar').remove();
    
    const bodyText = $('body').text()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, config.analysis.maxContentLength);
    
    return bodyText;
  }

  extractLinks($, baseUrl) {
    const links = [];
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && text) {
        try {
          const fullUrl = new URL(href, baseUrl.href).href;
          links.push({ url: fullUrl, text: text.substring(0, 100) });
        } catch (e) {
          // Skip invalid URLs
        }
      }
    });
    return links.slice(0, 20); // Limit to first 20 links
  }

  extractImages($, baseUrl) {
    const images = [];
    $('img[src]').each((i, el) => {
      const src = $(el).attr('src');
      const alt = $(el).attr('alt') || '';
      if (src) {
        try {
          const fullUrl = new URL(src, baseUrl.href).href;
          images.push({ url: fullUrl, alt: alt.substring(0, 100) });
        } catch (e) {
          // Skip invalid URLs
        }
      }
    });
    return images.slice(0, 10); // Limit to first 10 images
  }

  async analyzeBambiSleepRelevance(content) {
    try {
      logger.info(`Analyzing content for BambiSleep relevance: ${content.url}`);

      // First, do a quick keyword check
      const keywordAnalysis = this.performKeywordAnalysis(content);
      
      // If no keywords found, skip expensive AI analysis
      if (keywordAnalysis.score === 0) {
        logger.info('No BambiSleep keywords found, skipping AI analysis');
        return {
          isBambiSleep: false,
          relevanceScore: 0,
          summary: 'No relevant keywords found',
          keywords: [],
          confidence: 'high',
          analysisMethod: 'keyword',
          analysisDate: new Date().toISOString()
        };
      }

      // Perform AI analysis for potentially relevant content
      try {
        const aiAnalysis = await this.performAIAnalysis(content);
        logger.success('AI analysis completed', { 
          url: content.url, 
          score: aiAnalysis.relevanceScore 
        });
        return aiAnalysis;
      } catch (aiError) {
        logger.warn('AI analysis failed, using keyword fallback', { 
          url: content.url, 
          error: aiError.message 
        });
        return this.createFallbackAnalysis(content, keywordAnalysis);
      }
    } catch (error) {
      logger.error('Content analysis failed', { url: content.url, error: error.message });
      throw error;
    }
  }
  performKeywordAnalysis(content) {
    const text = [
      content.title,
      content.metaDescription,
      content.metaKeywords,
      content.headings.map(h => h.text).join(' '),
      content.bodyText
    ].join(' ').toLowerCase();

    const foundKeywords = config.analysis.bambiKeywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );

    // Improved scoring algorithm
    let score = 0;
    
    // Base keyword score
    score += foundKeywords.length * 15;
    
    // URL-based scoring boost
    const url = content.url.toLowerCase();
    if (url.includes('bambisleep') || url.includes('bambi-sleep')) {
      score += 30;
    }
    if (url.includes('hypno') || url.includes('sissy') || url.includes('bimbo')) {
      score += 20;
    }
    if (url.includes('reddit.com/r/bambisleep')) {
      score += 25;
    }
    
    // Title and heading boost
    const titleText = content.title.toLowerCase();
    if (titleText.includes('bambisleep') || titleText.includes('bambi sleep')) {
      score += 25;
    }
    if (titleText.includes('hypnosis') || titleText.includes('trance') || titleText.includes('conditioning')) {
      score += 15;
    }
    
    // Content density bonus
    const keywordDensity = foundKeywords.length / Math.max(1, text.split(' ').length / 100);
    if (keywordDensity > 0.5) {
      score += 10;
    }
    
    score = Math.min(score, 100);
    
    return { foundKeywords, score };
  }

  async performAIAnalysis(content) {
    const prompt = `Analyze this website content to determine if it's related to BambiSleep hypnosis content.

BambiSleep is a specific hypnosis series known for:
- Feminization and bimbification themes
- Hypnotic conditioning and mind control
- Adult transformation content
- Sissy training and submission

Website Details:
URL: ${content.url}
Title: ${content.title}
Meta Description: ${content.metaDescription}
Headings: ${content.headings.map(h => h.text).join(', ')}
Content Preview: ${content.bodyText.substring(0, 1000)}

Analyze the content carefully and respond with a JSON object containing:
- isBambiSleep: boolean (true if directly related to BambiSleep)
- relevanceScore: number (0-100, relevance to BambiSleep themes)
- summary: string (brief analysis of the content)
- keywords: array (relevant keywords found)
- contentType: string (website category: hypnosis, blog, forum, etc.)
- confidence: string (low/medium/high confidence in analysis)`;

    const response = await this.lmStudioClient.chat.completions.create({
      model: "any",
      messages: [
        {
          role: "system",
          content: "You are an expert content analyzer specializing in hypnosis and adult content categorization. Respond only with valid JSON. Be thorough but objective in your analysis."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "bambisleep_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              isBambiSleep: { type: "boolean" },
              relevanceScore: { type: "number" },
              summary: { type: "string" },
              keywords: { type: "array", items: { type: "string" } },
              contentType: { type: "string" },
              confidence: { type: "string" }
            },
            required: ["isBambiSleep", "relevanceScore", "summary", "keywords", "contentType", "confidence"]
          }
        }
      },
      temperature: 0.3,
      max_tokens: 800
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    return {
      ...analysis,
      analysisMethod: 'ai',
      analysisDate: new Date().toISOString()
    };
  }

  createFallbackAnalysis(content, keywordAnalysis) {
    return {
      isBambiSleep: keywordAnalysis.foundKeywords.length > 0,
      relevanceScore: keywordAnalysis.score,
      summary: `Keyword-based analysis. Found relevant terms: ${keywordAnalysis.foundKeywords.join(', ')}`,
      keywords: keywordAnalysis.foundKeywords,
      contentType: 'unknown',
      confidence: keywordAnalysis.foundKeywords.length > 2 ? 'medium' : 'low',
      analysisMethod: 'keyword',
      analysisDate: new Date().toISOString()
    };
  }

  async testLMStudioConnection() {
    try {
      logger.info('Testing LM Studio connection...');
      const response = await this.lmStudioClient.chat.completions.create({
        model: "any",
        messages: [{ role: "user", content: "Hello! Please respond with 'OK' if you're working correctly." }],
        max_tokens: 10,
        temperature: 0
      });
      
      const responseText = response.choices[0].message.content.trim();
      logger.success('LM Studio connection successful', { response: responseText });
      return true;
    } catch (error) {
      logger.error('LM Studio connection failed', { error: error.message });
      return false;
    }
  }
}

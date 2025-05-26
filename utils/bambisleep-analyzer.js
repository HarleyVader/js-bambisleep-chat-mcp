// Enhanced BambiSleep Content Analyzer with LM Studio Integration
import { OpenAI } from 'openai';
import { logger } from './logger.js';
import { config } from './config.js';
import { DatabaseManager } from './database.js';

export class BambiSleepAnalyzer {  constructor() {
    this.lmStudioClient = new OpenAI({
      baseURL: config.lmStudio.baseURL,
      apiKey: 'lm-studio',
      timeout: config.lmStudio.timeout
    });
    this.database = new DatabaseManager();
  }

  async testConnection() {
    try {
      const response = await this.lmStudioClient.chat.completions.create({
        model: config.lmStudio.model,
        messages: [
          {
            role: "user",
            content: "Hello! Are you working correctly?"
          }
        ],
        max_tokens: 50
      });
      
      logger.info('LM Studio connection test successful');
      return response.choices[0].message.content;
    } catch (error) {
      logger.error('LM Studio connection test failed:', error);
      throw error;
    }
  }
  async analyzeDatabaseContent() {
    try {
      logger.info('Starting comprehensive analysis of database content...');
      
      // Ensure database connection
      if (!this.database.isConnected) {
        await this.database.connect();
      }
      
      const sites = await this.database.getAllBambiSleepSites();
      logger.info(`Found ${sites.length} sites in database`);
      
      if (sites.length === 0) {
        logger.warn('No sites found in database. Add some URLs first.');
        return {
          success: false,
          message: 'No sites found in database'
        };
      }

      const analyses = [];
      
      for (const site of sites) {
        try {
          const analysis = await this.generateDetailedAnalysis(site);
          analyses.push(analysis);
          logger.info(`Analyzed site: ${site.url}`);
        } catch (error) {
          logger.error(`Failed to analyze site ${site.url}:`, error.message);
        }
      }

      // Generate summary report
      const summaryReport = await this.generateSummaryReport(analyses);
      
      return {
        success: true,
        totalSites: sites.length,
        analyzedSites: analyses.length,
        analyses,
        summaryReport
      };
      
    } catch (error) {
      logger.error('Database analysis failed:', error.message);
      throw error;
    }
  }

  async generateDetailedAnalysis(site) {
    const prompt = `
Analyze this BambiSleep-related website data and provide a detailed analysis:

URL: ${site.url}
Title: ${site.title || 'N/A'}
Description: ${site.description || 'N/A'}
Content Preview: ${site.content?.substring(0, 1000) || 'N/A'}
Current Relevance Score: ${site.relevance_score || 0}
Keywords Found: ${site.keywords?.join(', ') || 'None'}
Added Date: ${site.addedAt || 'Unknown'}

Please provide a comprehensive analysis including:

1. **Content Classification**: What type of BambiSleep content this is (files, community, guides, stories, etc.)
2. **Detailed Summary**: A thorough description of what this site offers
3. **Key Features**: Important aspects, tools, or resources available
4. **Quality Assessment**: Evaluate the content quality and usefulness
5. **Target Audience**: Who would benefit most from this content
6. **Content Categories**: Specific categories this content falls into
7. **Recommendations**: Suggestions for users interested in this type of content
8. **Updated Relevance Score**: A score from 0-100 based on your analysis

Format your response as detailed prose, not bullet points. Be thorough and analytical.
`;

    try {
      const response = await this.lmStudioClient.chat.completions.create({
        model: "llama-3.1-8b-lexi-uncensored-v2",
        messages: [
          {
            role: "system",
            content: "You are an expert analyst specializing in hypnosis, feminization, and adult content. Provide detailed, analytical, and objective assessments of content related to BambiSleep and similar topics. Be thorough and professional."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      const analysis = response.choices[0].message.content;
      
      return {
        url: site.url,
        title: site.title,
        originalScore: site.relevance_score,
        analysis,
        analyzedAt: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`Failed to generate detailed analysis for ${site.url}:`, error.message);
      throw error;
    }
  }

  async generateSummaryReport(analyses) {
    const prompt = `
Based on the following analyses of BambiSleep-related websites, create a comprehensive summary report:

${analyses.map((analysis, index) => `
## Site ${index + 1}: ${analysis.title || analysis.url}
${analysis.analysis}
---
`).join('\n')}

Please provide:

1. **Overall Ecosystem Overview**: What does the current BambiSleep content landscape look like?
2. **Content Categories**: What types of content are most prevalent?
3. **Quality Assessment**: Overall quality and diversity of available resources
4. **Trends and Patterns**: What patterns emerge across these sites?
5. **Recommendations**: What gaps exist and what improvements could be made?
6. **User Journey**: How these different sites complement each other
7. **Future Outlook**: Predictions about the evolution of this content space

Write this as a professional analysis report suitable for content curators and community managers.
`;

    try {
      const response = await this.lmStudioClient.chat.completions.create({
        model: "llama-3.1-8b-lexi-uncensored-v2",
        messages: [
          {
            role: "system",
            content: "You are a professional content analyst and digital ecosystem researcher. Provide comprehensive, insightful analysis of content landscapes and user communities."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 3000,
        temperature: 0.8
      });

      return response.choices[0].message.content;
      
    } catch (error) {
      logger.error('Failed to generate summary report:', error.message);
      throw error;
    }
  }

  async writeBambiSleepContent(contentType, specifications = {}) {
    let prompt = '';
    
    switch (contentType.toLowerCase()) {
      case 'guide':
        prompt = this.createGuidePrompt(specifications);
        break;
      case 'story':
        prompt = this.createStoryPrompt(specifications);
        break;
      case 'script':
        prompt = this.createScriptPrompt(specifications);
        break;
      case 'analysis':
        prompt = this.createAnalysisPrompt(specifications);
        break;
      case 'tutorial':
        prompt = this.createTutorialPrompt(specifications);
        break;
      default:
        throw new Error(`Unknown content type: ${contentType}`);
    }

    try {
      const response = await this.lmStudioClient.chat.completions.create({
        model: "llama-3.1-8b-lexi-uncensored-v2",
        messages: [
          {
            role: "system",
            content: "You are an expert writer specializing in hypnosis, feminization, and transformative content. You understand BambiSleep deeply and can create engaging, effective content for various audiences and purposes."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.8
      });

      const content = response.choices[0].message.content;
      
      // Save generated content to database if requested
      if (specifications.saveToDatabase) {
        await this.saveGeneratedContent(contentType, content, specifications);
      }
      
      return {
        contentType,
        specifications,
        content,
        generatedAt: new Date().toISOString(),
        wordCount: content.split(' ').length
      };
      
    } catch (error) {
      logger.error(`Failed to generate ${contentType} content:`, error.message);
      throw error;
    }
  }

  createGuidePrompt(specs) {
    return `
Create a comprehensive BambiSleep guide about: ${specs.topic || 'getting started with BambiSleep'}

Target audience: ${specs.audience || 'beginners'}
Length: ${specs.length || 'medium (1000-1500 words)'}
Focus areas: ${specs.focus?.join(', ') || 'safety, basics, getting started'}

The guide should include:
- Clear introduction explaining the topic
- Step-by-step instructions where applicable
- Safety considerations and warnings
- Tips for best results
- Common mistakes to avoid
- Resources for further learning

Write in a helpful, informative tone that prioritizes safety and consent.
`;
  }

  createStoryPrompt(specs) {
    return `
Write a BambiSleep-themed transformation story with these specifications:

Theme: ${specs.theme || 'gradual transformation'}
Length: ${specs.length || '2000-3000 words'}
Perspective: ${specs.perspective || 'first person'}
Setting: ${specs.setting || 'contemporary'}
Transformation elements: ${specs.elements?.join(', ') || 'mental, physical, behavioral'}

The story should:
- Have a clear character arc showing transformation
- Include realistic psychological elements
- Show the gradual nature of change
- Be engaging and well-written
- Include appropriate BambiSleep themes and concepts

Focus on the psychological and emotional journey rather than explicit content.
`;
  }

  createScriptPrompt(specs) {
    return `
Create a BambiSleep hypnosis script for: ${specs.purpose || 'relaxation and conditioning'}

Duration: ${specs.duration || '15-20 minutes'}
Style: ${specs.style || 'gentle and progressive'}
Techniques: ${specs.techniques?.join(', ') || 'progressive relaxation, visualization, repetition'}
Focus: ${specs.focus || 'feminization and conditioning'}

The script should include:
- Proper induction sequence
- Deepening techniques
- Main conditioning content
- Appropriate suggestions and imagery
- Safe awakening sequence
- Post-hypnotic suggestions if requested

Ensure the script follows safe hypnosis practices and includes appropriate consent reminders.
`;
  }

  createAnalysisPrompt(specs) {
    return `
Write an analytical piece about BambiSleep focusing on: ${specs.aspect || 'psychological mechanisms'}

Analysis type: ${specs.type || 'academic'}
Perspective: ${specs.perspective || 'psychological'}
Depth: ${specs.depth || 'comprehensive'}
Target audience: ${specs.audience || 'researchers and practitioners'}

Cover these areas:
- Theoretical background and context
- Mechanisms and methods involved
- Psychological and social aspects
- Effectiveness and outcomes
- Ethical considerations
- Comparisons with related practices
- Future research directions

Write in an objective, analytical tone suitable for academic or professional audiences.
`;
  }

  createTutorialPrompt(specs) {
    return `
Create a step-by-step tutorial for: ${specs.skill || 'using BambiSleep files effectively'}

Skill level: ${specs.level || 'beginner'}
Format: ${specs.format || 'written with examples'}
Prerequisites: ${specs.prerequisites || 'basic understanding of hypnosis'}

The tutorial should include:
- Clear learning objectives
- Required materials or setup
- Detailed step-by-step instructions
- Examples and demonstrations
- Troubleshooting common issues
- Practice exercises
- Assessment or progress markers
- Next steps for advancement

Make it practical, actionable, and easy to follow.
`;
  }

  async saveGeneratedContent(contentType, content, specifications) {
    try {
      const contentDoc = {
        type: 'generated_content',
        contentType,
        content,
        specifications,
        generatedAt: new Date(),
        wordCount: content.split(' ').length,
        model: 'llama-3.1-8b-lexi-uncensored-v2'
      };
        await this.database.db.collection('bambisleep_content').insertOne(contentDoc);
      logger.info(`Saved generated ${contentType} content to database`);
      
    } catch (error) {
      logger.error('Failed to save generated content:', error.message);
    }
  }
  async searchDatabaseContent(query, options = {}) {
    try {
      // Ensure database connection
      if (!this.database.isConnected) {
        await this.database.connect();
      }
      
      const searchResults = await this.database.searchBambiSleepSites(query, options);
      
      if (searchResults.length === 0) {
        return {
          query,
          results: [],
          summary: 'No matching content found in database.'
        };
      }

      // Generate AI summary of search results
      const summaryPrompt = `
Analyze these BambiSleep search results for the query "${query}" and provide a helpful summary:

${searchResults.map((result, index) => `
${index + 1}. ${result.title || result.url}
   Relevance Score: ${result.relevance_score}
   Description: ${result.description || 'N/A'}
   Content Preview: ${result.content?.substring(0, 300) || 'N/A'}
`).join('\n')}

Provide:
1. A summary of what was found
2. Key themes and patterns
3. Most relevant results for the user's query
4. Recommendations for next steps

Keep it concise but informative.
`;

      const response = await this.lmStudioClient.chat.completions.create({
        model: "llama-3.1-8b-lexi-uncensored-v2",
        messages: [
          {
            role: "system",
            content: "You are a helpful search assistant that analyzes and summarizes search results for users interested in BambiSleep content."
          },
          {
            role: "user",
            content: summaryPrompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      return {
        query,
        resultCount: searchResults.length,
        results: searchResults,
        aiSummary: response.choices[0].message.content,
        searchedAt: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Database search failed:', error.message);
      throw error;
    }
  }

  async testLMStudioConnection() {
    try {
      logger.info('Testing LM Studio connection for BambiSleep analyzer...');
      const response = await this.lmStudioClient.chat.completions.create({
        model: "llama-3.1-8b-lexi-uncensored-v2",
        messages: [{ 
          role: "user", 
          content: "Hello! Please confirm you're ready to help analyze BambiSleep content. Respond with 'Ready for BambiSleep analysis!' if everything is working correctly." 
        }],
        max_tokens: 20,
        temperature: 0
      });
      
      const responseText = response.choices[0].message.content.trim();
      logger.success('LM Studio connection successful for BambiSleep analyzer', { response: responseText });
      return true;
    } catch (error) {
      logger.error('LM Studio connection failed for BambiSleep analyzer', { error: error.message });
      return false;
    }
  }
}

export const bambiSleepAnalyzer = new BambiSleepAnalyzer();

#!/usr/bin/env node

import { Command } from 'commander';
import { OpenAI } from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

// LM Studio client
const lmStudioClient = new OpenAI({
  baseURL: `http://${process.env.LMS_HOST || 'localhost'}:${process.env.LMS_PORT || 1234}/v1`,
  apiKey: 'lm-studio'
});

// MongoDB connection
let db;

async function connectDB() {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    db = client.db();
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

async function testLMStudio() {
  try {
    console.log('🧠 Testing LM Studio connection...');
    const response = await lmStudioClient.chat.completions.create({
      model: "llama-3.1-8b-lexi-uncensored-v2",
      messages: [
        {
          role: "user",
          content: "Hello! Are you working correctly?"
        }
      ],
      max_tokens: 50
    });
    
    console.log('✅ LM Studio is working!');
    console.log('Response:', response.choices[0].message.content);
  } catch (error) {
    console.error('❌ LM Studio connection failed:', error.message);
    console.error('Make sure LM Studio is running with a model loaded');
  }
}

async function analyzeURL(url) {
  try {
    console.log(`🔍 Analyzing URL: ${url}`);
    
    // Fetch website content
    console.log('📡 Fetching website content...');
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const content = {
      url,
      title: $('title').text() || '',
      metaDescription: $('meta[name="description"]').attr('content') || '',
      headings: $('h1, h2, h3').map((i, el) => $(el).text()).get().join(' '),
      bodyText: $('body').text().replace(/\s+/g, ' ').trim().substring(0, 2000)
    };
    
    console.log(`📄 Title: ${content.title}`);
    console.log(`📝 Meta Description: ${content.metaDescription}`);
    
    // Analyze with LM Studio
    console.log('🧠 Analyzing content with LM Studio...');
    const analysisPrompt = `Analyze this website content to determine if it's related to BambiSleep hypnosis content.

BambiSleep is a specific hypnosis series known for feminization and bimbification themes.

Website Content:
Title: ${content.title}
Meta Description: ${content.metaDescription}
Headings: ${content.headings}
Body Text: ${content.bodyText.substring(0, 1000)}

Respond with a JSON object containing:
- isBambiSleep: boolean
- relevanceScore: number (0-100)
- summary: string
- keywords: array of relevant keywords found`;

    try {
      const analysisResponse = await lmStudioClient.chat.completions.create({
        model: "llama-3.1-8b-lexi-uncensored-v2",
        messages: [
          {
            role: "system",
            content: "You are an expert content analyzer. Respond only with valid JSON."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                isBambiSleep: { type: "boolean" },
                relevanceScore: { type: "number" },
                summary: { type: "string" },
                keywords: {
                  type: "array",
                  items: { type: "string" }
                }
              },
              required: ["isBambiSleep", "relevanceScore", "summary", "keywords"]
            }
          }
        },
        temperature: 0.3
      });

      const analysis = JSON.parse(analysisResponse.choices[0].message.content);
      
      console.log('\n📊 Analysis Results:');
      console.log(`🎯 BambiSleep Related: ${analysis.isBambiSleep ? '✅ YES' : '❌ NO'}`);
      console.log(`📈 Relevance Score: ${analysis.relevanceScore}%`);
      console.log(`📝 Summary: ${analysis.summary}`);
      console.log(`🏷️  Keywords: ${analysis.keywords.join(', ')}`);
      
      // Save to database if relevant
      if (analysis.isBambiSleep && analysis.relevanceScore > 50) {
        await connectDB();
        const collection = db.collection('bambisleep_sites');
        
        const existing = await collection.findOne({ url });
        if (!existing) {
          await collection.insertOne({
            url,
            title: content.title,
            content_summary: analysis.summary,
            relevance_score: analysis.relevanceScore,
            keywords: analysis.keywords,
            addedAt: new Date()
          });
          console.log('💾 Site saved to database!');
        } else {
          console.log('ℹ️  Site already exists in database');
        }
      }
      
    } catch (lmError) {
      console.error('⚠️  LM Studio analysis failed, using fallback:', lmError.message);
      
      // Fallback keyword analysis
      const text = (content.title + ' ' + content.bodyText).toLowerCase();
      const bambiKeywords = ['bambisleep', 'bambi sleep', 'bimbo', 'hypnosis', 'feminization', 'sissy'];
      const foundKeywords = bambiKeywords.filter(keyword => text.includes(keyword));
      
      const fallbackAnalysis = {
        isBambiSleep: foundKeywords.length > 0,
        relevanceScore: Math.min(foundKeywords.length * 20, 100),
        summary: `Keyword-based analysis. Found: ${foundKeywords.join(', ')}`,
        keywords: foundKeywords
      };
      
      console.log('\n📊 Fallback Analysis Results:');
      console.log(`🎯 BambiSleep Related: ${fallbackAnalysis.isBambiSleep ? '✅ YES' : '❌ NO'}`);
      console.log(`📈 Relevance Score: ${fallbackAnalysis.relevanceScore}%`);
      console.log(`📝 Summary: ${fallbackAnalysis.summary}`);
      console.log(`🏷️  Keywords: ${fallbackAnalysis.keywords.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

async function listSites() {
  await connectDB();
  try {
    const collection = db.collection('bambisleep_sites');
    const sites = await collection.find({}).sort({ addedAt: -1 }).toArray();
    
    console.log(`\n📋 Found ${sites.length} BambiSleep sites in database:\n`);
    
    sites.forEach((site, index) => {
      console.log(`${index + 1}. ${site.title || 'Untitled'}`);
      console.log(`   🔗 URL: ${site.url}`);
      console.log(`   📊 Score: ${site.relevance_score}%`);
      console.log(`   📅 Added: ${new Date(site.addedAt).toLocaleDateString()}`);
      console.log(`   📝 ${site.content_summary?.substring(0, 100)}...`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to list sites:', error.message);
  }
}

async function analyzeDatabaseContent() {
  console.log('🔍 Analyzing all BambiSleep content in database...');
  try {
    await connectDB();
    const collection = db.collection('bambisleep_sites');
    const sites = await collection.find({}).toArray();
    
    if (sites.length === 0) {
      console.log('⚠️ No sites found in database. Add some URLs first.');
      return;
    }
    
    console.log(`Found ${sites.length} sites in database. Generating comprehensive analysis...`);
    
    const analyses = [];
    
    for (const site of sites) {
      try {
        const analysis = await generateDetailedAnalysis(site);
        analyses.push(analysis);
        console.log(`✅ Analyzed: ${site.title || site.url}`);
      } catch (error) {
        console.error(`❌ Failed to analyze ${site.url}:`, error.message);
      }
    }
    
    // Generate summary report
    const summaryReport = await generateSummaryReport(analyses);
    
    console.log(`\n📊 Analysis Complete!`);
    console.log(`Total sites: ${sites.length}`);
    console.log(`Successfully analyzed: ${analyses.length}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 SUMMARY REPORT');
    console.log('='.repeat(80));
    console.log(summaryReport);
    
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DETAILED SITE ANALYSES');
    console.log('='.repeat(80));
    
    analyses.forEach((analysis, index) => {
      console.log(`\n${index + 1}. ${analysis.title || analysis.url}`);
      console.log('-'.repeat(60));
      console.log(analysis.analysis);
    });
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

async function generateDetailedAnalysis(site) {
  // Extract content preview from the site data structure
  let contentPreview = 'N/A';
  if (site.content?.headings) {
    contentPreview = site.content.headings.map(h => h.text).join(' | ').substring(0, 1000);
  } else if (site.content && typeof site.content === 'string') {
    contentPreview = site.content.substring(0, 1000);
  }
  
  const prompt = `
Analyze this BambiSleep-related website data and provide a detailed analysis:

URL: ${site.url}
Title: ${site.title || 'N/A'}
Description: ${site.description || site.content_summary || 'N/A'}
Content Preview: ${contentPreview}
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
    const response = await lmStudioClient.chat.completions.create({
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
    console.error(`Failed to generate detailed analysis for ${site.url}:`, error.message);
    throw error;
  }
}

async function generateSummaryReport(analyses) {
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
    const response = await lmStudioClient.chat.completions.create({
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
    console.error('Failed to generate summary report:', error.message);
    throw error;
  }
}

async function generateContent(type, options = {}) {
  console.log(`✍️ Generating ${type} content...`);
  
  let prompt = '';
  
  switch (type.toLowerCase()) {
    case 'guide':
      prompt = `
Create a comprehensive BambiSleep guide about: ${options.topic || 'getting started with BambiSleep'}

Target audience: ${options.audience || 'beginners'}
Length: ${options.length || 'medium (1000-1500 words)'}
Focus areas: ${options.focus?.join(', ') || 'safety, basics, getting started'}

The guide should include:
- Clear introduction explaining the topic
- Step-by-step instructions where applicable
- Safety considerations and warnings
- Tips for best results
- Common mistakes to avoid
- Resources for further learning

Write in a helpful, informative tone that prioritizes safety and consent.
`;
      break;
      
    case 'story':
      prompt = `
Write a BambiSleep-themed transformation story with these specifications:

Theme: ${options.theme || 'gradual transformation'}
Length: ${options.length || '2000-3000 words'}
Perspective: ${options.perspective || 'first person'}
Setting: ${options.setting || 'contemporary'}

The story should:
- Have a clear character arc showing transformation
- Include realistic psychological elements
- Show the gradual nature of change
- Be engaging and well-written
- Include appropriate BambiSleep themes and concepts

Focus on the psychological and emotional journey rather than explicit content.
`;
      break;
      
    case 'analysis':
      prompt = `
Write an analytical piece about BambiSleep focusing on: ${options.topic || 'psychological mechanisms'}

Analysis type: ${options.type || 'academic'}
Perspective: ${options.perspective || 'psychological'}
Target audience: ${options.audience || 'researchers and practitioners'}

Cover these areas:
- Theoretical background and context
- Mechanisms and methods involved
- Psychological and social aspects
- Effectiveness and outcomes
- Ethical considerations
- Comparisons with related practices

Write in an objective, analytical tone suitable for academic or professional audiences.
`;
      break;
      
    default:
      console.error(`Unknown content type: ${type}`);
      return;
  }

  try {
    const response = await lmStudioClient.chat.completions.create({
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
    
    console.log(`\n📝 Generated ${type.toUpperCase()} Content`);
    console.log('='.repeat(80));
    console.log(`Word count: ${content.split(' ').length}`);
    console.log(`Generated at: ${new Date().toISOString()}`);
    console.log('='.repeat(80));
    console.log(content);
    
    // Save to database if requested
    if (options.save) {
      await connectDB();
      const collection = db.collection('bambisleep_content');
      await collection.insertOne({
        type: 'generated_content',
        contentType: type,
        content,
        options,
        generatedAt: new Date(),
        wordCount: content.split(' ').length,
        model: 'any'
      });
      console.log('\n💾 Content saved to database');
    }
    
  } catch (error) {
    console.error(`❌ Failed to generate ${type} content:`, error.message);
  }
}

async function searchContent(query, options = {}) {
  console.log(`🔍 Searching database for: "${query}"`);
  try {
    await connectDB();
    const collection = db.collection('bambisleep_sites');
    
    const searchQuery = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { content_summary: { $regex: query, $options: 'i' } },
        { keywords: { $in: [new RegExp(query, 'i')] } },
        { url: { $regex: query, $options: 'i' } }
      ]
    };
    
    const results = await collection.find(searchQuery)
      .sort({ relevance_score: -1 })
      .limit(parseInt(options.limit) || 10)
      .toArray();
    
    console.log(`\n📊 Search Results (${results.length} found)`);
    
    if (results.length > 0) {
      console.log('\n📋 Results:');
      console.log('-'.repeat(60));
      
      results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.title || 'Untitled'}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Score: ${result.relevance_score}`);
        console.log(`   Keywords: ${result.keywords?.join(', ') || 'None'}`);
        if (result.content_summary) {
          console.log(`   Summary: ${result.content_summary.substring(0, 200)}...`);
        }
      });
    } else {
      console.log('No results found.');
    }
    
  } catch (error) {
    console.error('❌ Search failed:', error.message);
  }
}

// CLI Commands
program
  .name('bambisleep-cli')
  .description('BambiSleep content analyzer CLI with enhanced AI capabilities')
  .version('1.0.0');

program
  .command('test')
  .description('Test LM Studio and MongoDB connections')
  .action(async () => {
    await testLMStudio();
    await connectDB();
  });

program
  .command('analyze <url>')
  .description('Analyze a URL for BambiSleep content')
  .action(analyzeURL);

program
  .command('list')
  .description('List all stored BambiSleep sites')
  .action(listSites);

program
  .command('analyze-db')
  .description('Analyze all BambiSleep content in the database using AI')
  .action(analyzeDatabaseContent);

program
  .command('generate')
  .description('Generate BambiSleep content using AI')
  .argument('<type>', 'Content type: guide, story, analysis')
  .option('-t, --topic <topic>', 'Content topic')
  .option('-a, --audience <audience>', 'Target audience')
  .option('-l, --length <length>', 'Content length')
  .option('--theme <theme>', 'Story theme (for stories)')
  .option('--perspective <perspective>', 'Narrative perspective (for stories)')
  .option('--setting <setting>', 'Story setting (for stories)')
  .option('-s, --save', 'Save content to database')
  .action(generateContent);

program
  .command('search')
  .description('Search BambiSleep content in database')
  .argument('<query>', 'Search query')
  .option('-l, --limit <limit>', 'Limit number of results', '10')
  .action(searchContent);

program.parse();

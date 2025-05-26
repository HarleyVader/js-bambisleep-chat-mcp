#!/usr/bin/env node

import { Command } from 'commander';
import { OpenAI } from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { bambiSleepAnalyzer } from './utils/bambisleep-analyzer.js';

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
      model: "any",
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
        model: "any",
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
    const results = await bambiSleepAnalyzer.analyzeDatabaseContent();
    
    if (!results.success) {
      console.log(`⚠️ ${results.message}`);
      return;
    }
    
    console.log(`\n📊 Analysis Complete!`);
    console.log(`Total sites: ${results.totalSites}`);
    console.log(`Successfully analyzed: ${results.analyzedSites}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('📝 SUMMARY REPORT');
    console.log('='.repeat(80));
    console.log(results.summaryReport);
    
    console.log('\n' + '='.repeat(80));
    console.log('🔍 DETAILED SITE ANALYSES');
    console.log('='.repeat(80));
    
    results.analyses.forEach((analysis, index) => {
      console.log(`\n${index + 1}. ${analysis.title || analysis.url}`);
      console.log('-'.repeat(60));
      console.log(analysis.analysis);
    });
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

async function generateContent(type, options = {}) {
  console.log(`✍️ Generating ${type} content...`);
  try {
    await connectDB();
    
    const specifications = {
      topic: options.topic,
      audience: options.audience,
      length: options.length,
      theme: options.theme,
      perspective: options.perspective,
      setting: options.setting,
      purpose: options.purpose,
      style: options.style,
      saveToDatabase: options.save || false
    };
    
    const result = await bambiSleepAnalyzer.writeBambiSleepContent(type, specifications);
    
    console.log(`\n📝 Generated ${type.toUpperCase()} Content`);
    console.log('='.repeat(80));
    console.log(`Word count: ${result.wordCount}`);
    console.log(`Generated at: ${result.generatedAt}`);
    console.log('='.repeat(80));
    console.log(result.content);
    
    if (specifications.saveToDatabase) {
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
    const results = await bambiSleepAnalyzer.searchDatabaseContent(query, options);
    
    console.log(`\n📊 Search Results (${results.resultCount} found)`);
    console.log('='.repeat(80));
    console.log(results.aiSummary);
    
    if (results.results.length > 0) {
      console.log('\n📋 Detailed Results:');
      console.log('-'.repeat(60));
      
      results.results.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.title || 'Untitled'}`);
        console.log(`   URL: ${result.url}`);
        console.log(`   Score: ${result.relevance_score}`);
        console.log(`   Keywords: ${result.keywords?.join(', ') || 'None'}`);
        if (result.description) {
          console.log(`   Description: ${result.description.substring(0, 200)}...`);
        }
      });
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
  .command('server')
  .description('Start the web server')
  .action(async () => {
    const { spawn } = await import('child_process');
    console.log('🚀 Starting web server...');
    const server = spawn('node', ['server.js'], { stdio: 'inherit' });
    
    process.on('SIGINT', () => {
      server.kill('SIGINT');
      process.exit(0);
    });
  });

// New enhanced commands
program
  .command('analyze-db')
  .description('Analyze all BambiSleep content in the database using AI')
  .action(analyzeDatabaseContent);

program
  .command('generate')
  .description('Generate BambiSleep content using AI')
  .argument('<type>', 'Content type: guide, story, script, analysis, tutorial')
  .option('-t, --topic <topic>', 'Content topic')
  .option('-a, --audience <audience>', 'Target audience')
  .option('-l, --length <length>', 'Content length')
  .option('--theme <theme>', 'Story theme (for stories)')
  .option('--perspective <perspective>', 'Narrative perspective (for stories)')
  .option('--setting <setting>', 'Story setting (for stories)')
  .option('--purpose <purpose>', 'Script purpose (for scripts)')
  .option('--style <style>', 'Writing style')
  .option('-s, --save', 'Save content to database')
  .action(generateContent);

program
  .command('search')
  .description('Search BambiSleep content in database with AI analysis')
  .argument('<query>', 'Search query')
  .option('-l, --limit <limit>', 'Limit number of results', '10')
  .action(searchContent);

program
  .command('test-bambi')
  .description('Test BambiSleep analyzer connection')
  .action(async () => {
    console.log('🧠 Testing BambiSleep analyzer...');
    try {
      const isWorking = await bambiSleepAnalyzer.testLMStudioConnection();
      if (isWorking) {
        console.log('✅ BambiSleep analyzer is ready!');
      } else {
        console.log('❌ BambiSleep analyzer connection failed');
      }
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  });

program.parse();

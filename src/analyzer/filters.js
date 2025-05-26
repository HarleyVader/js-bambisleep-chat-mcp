// Enhanced content filtering and relevance scoring for BambiSleep content
import { logger } from '../../src/utils/logger.js';

// Comprehensive BambiSleep-related keywords and their importance weights
export const BAMBISLEEP_KEYWORDS = {
  // Primary terms (highest weight)
  primary: {
    'bambi': 10,
    'bambisleep': 15,
    'bambi sleep': 15,
    'bambi conditioning': 12,
    'bambi training': 12,
    'bambi triggers': 12,
    'bambi files': 10,
    'bambi playlist': 10
  },
  
  // Hypnosis and conditioning terms (high weight)
  hypnosis: {
    'hypnosis': 8,
    'hypnotic': 7,
    'trance': 8,
    'conditioning': 9,
    'brainwashing': 8,
    'mind control': 7,
    'subliminal': 6,
    'mantras': 6,
    'affirmations': 5,
    'repetition': 4,
    'induction': 6,
    'deepener': 5,
    'spiral': 4,
    'programming': 7
  },
  
  // Transformation themes (medium-high weight)
  transformation: {
    'feminization': 8,
    'bimbofication': 9,
    'sissy': 6,
    'transformation': 6,
    'makeup': 4,
    'clothes': 3,
    'outfit': 3,
    'dress up': 4,
    'pink': 3,
    'girly': 4,
    'feminine': 5,
    'pretty': 3,
    'cute': 3,
    'princess': 4
  },
  
  // Audio/media terms (medium weight)
  media: {
    'audio': 5,
    'file': 4,
    'mp3': 4,
    'download': 4,
    'listen': 5,
    'session': 6,
    'episode': 4,
    'track': 4,
    'playlist': 6,
    'soundcloud': 4,
    'youtube': 3,
    'meditation': 4
  },
  
  // Community terms (lower weight but relevant)
  community: {
    'discord': 3,
    'reddit': 3,
    'community': 4,
    'discussion': 3,
    'experience': 4,
    'journey': 3,
    'progress': 3,
    'routine': 4,
    'schedule': 3,
    'daily': 3,
    'practice': 4
  },
  
  // Technical terms (lower weight)
  technical: {
    'triggers': 8,
    'effect': 5,
    'response': 4,
    'behavior': 5,
    'habit': 4,
    'routine': 4,
    'protocol': 3,
    'method': 3,
    'technique': 4,
    'process': 3
  }
};

// Content quality indicators
export const QUALITY_INDICATORS = {
  positive: {
    'detailed': 3,
    'comprehensive': 4,
    'guide': 5,
    'tutorial': 4,
    'instruction': 4,
    'explanation': 3,
    'analysis': 3,
    'review': 3,
    'experience': 4,
    'personal': 3,
    'story': 2,
    'journey': 3,
    'progress': 3,
    'results': 4,
    'effective': 4,
    'successful': 3,
    'helpful': 3,
    'useful': 3,
    'important': 3,
    'essential': 4
  },
  
  negative: {
    'spam': -10,
    'scam': -10,
    'fake': -8,
    'virus': -10,
    'malware': -10,
    'illegal': -8,
    'pirated': -6,
    'stolen': -6,
    'clickbait': -5,
    'advertisement': -3,
    'ad': -2,
    'promotion': -2,
    'sale': -2,
    'buy now': -4,
    'limited time': -3,
    'hurry': -3,
    'urgent': -3
  }
};

// Content categories for classification
export const CONTENT_CATEGORIES = {
  CORE_CONTENT: 'core_content',       // Main BambiSleep files/content
  COMMUNITY: 'community',             // Community discussions, experiences
  GUIDE: 'guide',                     // How-to guides, tutorials
  TECHNICAL: 'technical',             // Technical information, troubleshooting
  EXPERIENCE: 'experience',           // Personal experiences, stories
  RESOURCE: 'resource',               // Resources, links, collections
  NEWS: 'news',                       // Updates, announcements
  OFF_TOPIC: 'off_topic'             // Not directly related
};

/**
 * Calculate enhanced relevance score using weighted keywords and quality indicators
 */
export function calculateEnhancedRelevanceScore(content, options = {}) {
  const text = (content.mainContent || content.text || '').toLowerCase();
  const title = (content.title || '').toLowerCase();
  const description = (content.description || '').toLowerCase();
  
  if (!text && !title) {
    return { score: 0, details: { reason: 'No content to analyze' } };
  }
  
  const combinedText = `${title} ${description} ${text}`;
  let score = 0;
  const details = {
    keywordMatches: {},
    qualityScore: 0,
    contentLength: text.length,
    titleRelevance: 0,
    categoryScores: {}
  };
  
  // Base content length score (0-0.1)
  const lengthScore = Math.min(text.length / 2000, 1) * 0.1;
  score += lengthScore;
  
  // Keyword scoring with categories
  for (const [category, keywords] of Object.entries(BAMBISLEEP_KEYWORDS)) {
    let categoryScore = 0;
    const categoryMatches = {};
    
    for (const [keyword, weight] of Object.entries(keywords)) {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      
      // Count matches in different sections with different weights
      const titleMatches = (title.match(regex) || []).length;
      const descMatches = (description.match(regex) || []).length;
      const contentMatches = (text.match(regex) || []).length;
      
      if (titleMatches || descMatches || contentMatches) {
        const keywordScore = (titleMatches * weight * 0.5) + 
                           (descMatches * weight * 0.3) + 
                           (contentMatches * weight * 0.1);
        
        categoryScore += keywordScore;
        categoryMatches[keyword] = {
          title: titleMatches,
          description: descMatches,
          content: contentMatches,
          score: keywordScore
        };
      }
    }
    
    if (categoryScore > 0) {
      details.keywordMatches[category] = categoryMatches;
      details.categoryScores[category] = categoryScore;
      score += categoryScore * 0.01; // Scale down to reasonable range
    }
  }
  
  // Quality indicators
  let qualityScore = 0;
  for (const [indicator, weight] of Object.entries(QUALITY_INDICATORS.positive)) {
    const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
    const matches = (combinedText.match(regex) || []).length;
    qualityScore += matches * weight * 0.01;
  }
  
  for (const [indicator, weight] of Object.entries(QUALITY_INDICATORS.negative)) {
    const regex = new RegExp(`\\b${indicator}\\b`, 'gi');
    const matches = (combinedText.match(regex) || []).length;
    qualityScore += matches * weight * 0.01; // Weight is negative
  }
  
  details.qualityScore = qualityScore;
  score += qualityScore;
  
  // Title relevance bonus
  const titleRelevanceScore = calculateTitleRelevance(title);
  details.titleRelevance = titleRelevanceScore;
  score += titleRelevanceScore * 0.2;
  
  // Normalize score to 0-1 range
  const finalScore = Math.max(0, Math.min(1, score));
  
  details.finalScore = finalScore;
  details.recommendation = getRecommendation(finalScore, details);
  
  return { score: finalScore, details };
}

/**
 * Calculate title relevance specifically
 */
function calculateTitleRelevance(title) {
  if (!title) return 0;
  
  let relevance = 0;
  
  // Check for primary keywords in title
  for (const keyword of Object.keys(BAMBISLEEP_KEYWORDS.primary)) {
    if (title.includes(keyword.toLowerCase())) {
      relevance += BAMBISLEEP_KEYWORDS.primary[keyword] * 0.1;
    }
  }
  
  return Math.min(relevance, 1);
}

/**
 * Categorize content based on analysis
 */
export function categorizeContent(content, relevanceDetails) {
  const { categoryScores, keywordMatches } = relevanceDetails;
  const text = (content.mainContent || content.text || '').toLowerCase();
  const title = (content.title || '').toLowerCase();
  
  // Determine primary category based on keyword matches and content patterns
  let primaryCategory = CONTENT_CATEGORIES.OFF_TOPIC;
  let confidence = 0;
  
  // Check for core content indicators
  if (categoryScores.primary > 5 || 
      title.includes('bambi') || 
      text.includes('official') ||
      text.includes('original files')) {
    primaryCategory = CONTENT_CATEGORIES.CORE_CONTENT;
    confidence = 0.9;
  }
  // Check for community content
  else if (categoryScores.community > 3 || 
           text.includes('reddit') || 
           text.includes('discord') ||
           text.includes('community') ||
           text.includes('discussion')) {
    primaryCategory = CONTENT_CATEGORIES.COMMUNITY;
    confidence = 0.7;
  }
  // Check for guides/tutorials
  else if (text.includes('guide') || 
           text.includes('how to') ||
           text.includes('tutorial') ||
           text.includes('instruction')) {
    primaryCategory = CONTENT_CATEGORIES.GUIDE;
    confidence = 0.8;
  }
  // Check for personal experiences
  else if (text.includes('experience') || 
           text.includes('journey') ||
           text.includes('my story') ||
           text.includes('personal')) {
    primaryCategory = CONTENT_CATEGORIES.EXPERIENCE;
    confidence = 0.6;
  }
  // Check for resources
  else if (text.includes('download') || 
           text.includes('collection') ||
           text.includes('playlist') ||
           text.includes('resources')) {
    primaryCategory = CONTENT_CATEGORIES.RESOURCE;
    confidence = 0.7;
  }
  // Check for technical content
  else if (categoryScores.technical > 2 ||
           text.includes('troubleshoot') ||
           text.includes('problem') ||
           text.includes('fix')) {
    primaryCategory = CONTENT_CATEGORIES.TECHNICAL;
    confidence = 0.6;
  }
  
  // If we have some BambiSleep relevance but no clear category, default to community
  if (primaryCategory === CONTENT_CATEGORIES.OFF_TOPIC && 
      (categoryScores.primary > 1 || categoryScores.hypnosis > 2)) {
    primaryCategory = CONTENT_CATEGORIES.COMMUNITY;
    confidence = 0.4;
  }
  
  return {
    primary: primaryCategory,
    confidence,
    alternativeCategories: suggestAlternativeCategories(categoryScores, text)
  };
}

/**
 * Suggest alternative categories based on content analysis
 */
function suggestAlternativeCategories(categoryScores, text) {
  const alternatives = [];
  
  // Add alternatives based on secondary keyword matches
  if (categoryScores.community > 1) alternatives.push(CONTENT_CATEGORIES.COMMUNITY);
  if (categoryScores.technical > 1) alternatives.push(CONTENT_CATEGORIES.TECHNICAL);
  if (text.includes('guide') || text.includes('how')) alternatives.push(CONTENT_CATEGORIES.GUIDE);
  
  return alternatives.slice(0, 2); // Return top 2 alternatives
}

/**
 * Get recommendation based on relevance score and details
 */
function getRecommendation(score, details) {
  if (score >= 0.8) {
    return {
      action: 'PRIORITY_PROCESS',
      reason: 'Highly relevant BambiSleep content',
      priority: 1
    };
  } else if (score >= 0.6) {
    return {
      action: 'PROCESS',
      reason: 'Relevant BambiSleep content',
      priority: 2
    };
  } else if (score >= 0.4) {
    return {
      action: 'CONDITIONAL_PROCESS',
      reason: 'Moderately relevant content',
      priority: 3
    };
  } else if (score >= 0.2) {
    return {
      action: 'LOW_PRIORITY',
      reason: 'Low relevance content',
      priority: 4
    };
  } else {
    return {
      action: 'SKIP',
      reason: 'Not relevant to BambiSleep',
      priority: 5
    };
  }
}

/**
 * Filter content by relevance threshold with detailed analysis
 */
export function filterByRelevance(contentArray, threshold = 0.4, options = {}) {
  logger.info('Filtering content by relevance', { 
    totalItems: contentArray.length, 
    threshold 
  });
  
  const results = contentArray.map(item => {
    const relevanceAnalysis = calculateEnhancedRelevanceScore(item.content || item, options);
    const category = categorizeContent(item.content || item, relevanceAnalysis.details);
    
    return {
      ...item,
      relevanceAnalysis,
      category,
      isRelevant: relevanceAnalysis.score >= threshold
    };
  }).filter(item => item.isRelevant);
  
  logger.info('Content filtering completed', {
    originalCount: contentArray.length,
    filteredCount: results.length,
    rejectedCount: contentArray.length - results.length
  });
  
  return results;
}

/**
 * Generate content quality report
 */
export function generateQualityReport(contentArray) {
  const report = {
    totalItems: contentArray.length,
    categories: {},
    qualityDistribution: {
      high: 0,    // score >= 0.8
      medium: 0,  // score 0.4-0.8
      low: 0      // score < 0.4
    },
    averageScore: 0,
    recommendations: {
      PRIORITY_PROCESS: 0,
      PROCESS: 0,
      CONDITIONAL_PROCESS: 0,
      LOW_PRIORITY: 0,
      SKIP: 0
    },
    keywordFrequency: {}
  };
  
  let totalScore = 0;
  
  for (const item of contentArray) {
    const relevanceAnalysis = calculateEnhancedRelevanceScore(item.content || item);
    const category = categorizeContent(item.content || item, relevanceAnalysis.details);
    
    totalScore += relevanceAnalysis.score;
    
    // Quality distribution
    if (relevanceAnalysis.score >= 0.8) report.qualityDistribution.high++;
    else if (relevanceAnalysis.score >= 0.4) report.qualityDistribution.medium++;
    else report.qualityDistribution.low++;
    
    // Category tracking
    if (!report.categories[category.primary]) {
      report.categories[category.primary] = 0;
    }
    report.categories[category.primary]++;
    
    // Recommendation tracking
    report.recommendations[relevanceAnalysis.details.recommendation.action]++;
    
    // Keyword frequency
    for (const [category, matches] of Object.entries(relevanceAnalysis.details.keywordMatches)) {
      for (const keyword of Object.keys(matches)) {
        if (!report.keywordFrequency[keyword]) {
          report.keywordFrequency[keyword] = 0;
        }
        report.keywordFrequency[keyword]++;
      }
    }
  }
  
  report.averageScore = contentArray.length > 0 ? totalScore / contentArray.length : 0;
  
  return report;
}

export default {
  calculateEnhancedRelevanceScore,
  categorizeContent,
  filterByRelevance,
  generateQualityReport,
  BAMBISLEEP_KEYWORDS,
  QUALITY_INDICATORS,
  CONTENT_CATEGORIES
};

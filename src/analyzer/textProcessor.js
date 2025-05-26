export function cleanText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove special characters that might interfere with processing
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Normalize unicode
    .normalize('NFKC')
    // Trim
    .trim();
}

export function extractKeyPhrases(text, keywords = []) {
  const phrases = [];
  const lowercaseText = text.toLowerCase();
  
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      phrases.push({
        keyword,
        count: matches.length,
        positions: []
      });
    }
  }
  
  return phrases;
}

export function calculateRelevanceScore(content, keywords = []) {
  const text = cleanText(content.mainContent || content.text || '');
  const title = cleanText(content.title || '');
  
  if (!text && !title) {
    return 0;
  }
  
  let score = 0;
  const totalText = (title + ' ' + text).toLowerCase();
  
  // Base score from content length (normalized)
  const lengthScore = Math.min(text.length / 1000, 1) * 0.1;
  score += lengthScore;
  
  // Keyword matching score
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
    const matches = totalText.match(regex) || [];
    
    // Higher weight for title matches
    const titleMatches = title.toLowerCase().match(regex) || [];
    const contentMatches = matches.length - titleMatches.length;
    
    score += titleMatches.length * 0.3;
    score += contentMatches * 0.1;
  }
  
  // Normalize score to 0-1 range
  return Math.min(score, 1);
}

export function summarizeContent(text, maxLength = 200) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  let summary = '';
  
  for (const sentence of sentences) {
    if (summary.length + sentence.length + 1 <= maxLength) {
      summary += (summary ? ' ' : '') + sentence.trim();
    } else {
      break;
    }
  }
  
  return summary + (summary.length < text.length ? '...' : '');
}

export function processScrapedContent(scrapedData, config = {}) {
  const keywords = config.bambisleepKeywords || [];
  const relevanceThreshold = config.relevanceThreshold || 0.4;
  const useEnhancedAnalysis = config.useEnhancedAnalysis !== false; // Default to true
  
  let relevanceScore, relevanceDetails, category;
  
  if (useEnhancedAnalysis) {
    // Use enhanced analysis if available
    try {
      const { calculateEnhancedRelevanceScore, categorizeContent } = await import('./filters.js');
      const relevanceAnalysis = calculateEnhancedRelevanceScore(scrapedData.content || {});
      relevanceScore = relevanceAnalysis.score;
      relevanceDetails = relevanceAnalysis.details;
      category = categorizeContent(scrapedData.content || {}, relevanceDetails);
    } catch (error) {
      // Fallback to basic analysis
      relevanceScore = calculateRelevanceScore(scrapedData.content, keywords);
      relevanceDetails = { fallback: true, basicScore: relevanceScore };
      category = { primary: 'unknown', confidence: 0.5 };
    }
  } else {
    // Use basic analysis
    relevanceScore = calculateRelevanceScore(scrapedData.content, keywords);
    relevanceDetails = { basicScore: relevanceScore };
    category = { primary: 'unknown', confidence: 0.5 };
  }
  
  const processed = {
    ...scrapedData,
    processed: {
      cleanedContent: cleanText(scrapedData.content?.mainContent || ''),
      cleanedTitle: cleanText(scrapedData.content?.title || ''),
      keyPhrases: extractKeyPhrases(scrapedData.content?.mainContent || '', keywords),
      relevanceScore,
      relevanceDetails,
      category,
      summary: summarizeContent(scrapedData.content?.mainContent || ''),
      wordCount: scrapedData.content?.wordCount || 0,
      processedAt: new Date().toISOString(),
      analysisVersion: useEnhancedAnalysis ? 'enhanced' : 'basic'
    }
  };
  
  processed.isRelevant = relevanceScore >= relevanceThreshold;
  
  return processed;
}

# Enhanced Features Guide

This document outlines the new enhanced features implemented in the LM Studio URL Scraper MCP Toolset.

## New Features Overview

### 1. Enhanced Content Analysis (src/analyzer/filters.js)
- **BambiSleep-specific keyword detection** with weighted scoring
- **Content categorization** into 8 predefined categories
- **Quality scoring** with positive/negative indicators
- **Advanced relevance analysis** with detailed metrics

### 2. Browser Automation (src/scraper/browser.js)
- **Playwright integration** supporting Chromium, Firefox, and WebKit
- **JavaScript detection** and automatic browser selection
- **Session management** with timeout and cleanup
- **Performance optimization** with resource blocking
- **Dynamic content handling** for modern web applications

### 3. Improved Web Interface (views/enhanced.ejs)
- **Tabbed navigation** with Scraper, Search, Dashboard, and MCP Tools
- **Real-time metrics dashboard** with animated indicators
- **Advanced search** with category, relevance, and date filtering
- **Analytics charts** using Chart.js for data visualization
- **Enhanced result display** with quality meters and relevance scoring

## API Endpoints

### Enhanced Scraping
- `POST /api/scraper/enhanced-single` - Enhanced single URL scraping
- `POST /api/scraper/enhanced-batch` - Enhanced batch URL scraping
- `POST /api/scraper/test-url` - Test URL for JavaScript detection

### Analytics
- `GET /api/analytics/stats` - Get analytics statistics
- `GET /api/analytics/activity` - Get activity timeline data

### Search
- `POST /api/scraper/search` - Enhanced search with filtering

## Configuration

Enhanced features can be configured in `config/default.json`:

```json
{
  "scraper": {
    "browser": {
      "headless": true,
      "timeout": 30000,
      "maxSessions": 5
    },
    "enhanced": {
      "enabled": true,
      "jsDetection": true,
      "dynamicContent": true
    }
  },
  "analyzer": {
    "enhanced": {
      "enabled": true,
      "categoryDetection": true,
      "qualityScoring": true
    }
  }
}
```

## Usage Examples

### Enhanced Single URL Scraping
```javascript
const response = await fetch('/api/scraper/enhanced-single', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://bambisleep.miraheze.org/wiki/Main_Page',
    options: { enhanced: true }
  })
});

const result = await response.json();
console.log(result.analysis.relevanceScore); // 0.95
console.log(result.analysis.category); // "hypnosis-content"
```

### Testing URL for JavaScript
```javascript
const response = await fetch('/api/scraper/test-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://example.com'
  })
});

const result = await response.json();
console.log(result.needsBrowser); // true/false
console.log(result.recommendation); // "Use browser automation"
```

### Enhanced Search
```javascript
const response = await fetch('/api/scraper/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'hypnosis training',
    filters: {
      category: 'hypnosis-content',
      minRelevance: 0.7,
      dateFrom: '2024-01-01'
    },
    limit: 10
  })
});

const results = await response.json();
```

## Testing

Run the enhanced test suite:
```bash
npm run test:enhanced
```

This will test:
- Browser Manager functionality
- Enhanced Fetcher with fallback mechanisms
- Enhanced Content Analysis with categorization
- Full pipeline integration

## Access Points

1. **Standard Interface**: `http://localhost:3000/` - Original interface
2. **Enhanced Interface**: `http://localhost:3000/enhanced` - New enhanced interface with dashboard

## Performance Notes

- Enhanced features may take longer but provide better results
- Browser automation automatically falls back to standard fetching when appropriate
- Resource blocking improves browser performance by skipping images, stylesheets, etc.
- Session management prevents memory leaks and optimizes browser usage

## Fallback Mechanisms

The system includes comprehensive fallback mechanisms:
- Enhanced analysis falls back to basic analysis if modules are unavailable
- Browser automation falls back to standard HTTP fetching
- All enhanced features degrade gracefully to maintain system stability

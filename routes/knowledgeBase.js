import express from 'express';
import { bambiSleepKB } from '../src/knowledgeBase/bambiSleepKB.js';

const router = express.Router();

// Initialize knowledge base
router.post('/init', async (req, res) => {
  try {
    await bambiSleepKB.initialize();
    res.json({ 
      success: true, 
      message: 'BambiSleep Knowledge Base initialized',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('KB initialization error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to initialize knowledge base' 
    });
  }
});

// Get overview
router.get('/overview', async (req, res) => {
  try {
    if (!bambiSleepKB.initialized) {
      await bambiSleepKB.initialize();
    }
    
    const overview = bambiSleepKB.getOverview();
    res.json({ 
      success: true, 
      overview,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('KB overview error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get overview' 
    });
  }
});

// Get specific section
router.get('/section/:sectionName', async (req, res) => {
  try {
    if (!bambiSleepKB.initialized) {
      await bambiSleepKB.initialize();
    }
    
    const { sectionName } = req.params;
    const section = bambiSleepKB.getSection(sectionName);
    
    if (section === null) {
      return res.status(404).json({ 
        success: false, 
        error: `Section '${sectionName}' not found` 
      });
    }
    
    res.json({ 
      success: true, 
      section,
      sectionName,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('KB section error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get section' 
    });
  }
});

// Search knowledge base
router.get('/search', async (req, res) => {
  try {
    if (!bambiSleepKB.initialized) {
      await bambiSleepKB.initialize();
    }
    
    const { query, section, limit } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query parameter is required' 
      });
    }
    
    const options = {};
    if (limit) options.limit = parseInt(limit);
    
    let results;
    if (section) {
      // Search within specific section
      const sectionData = bambiSleepKB.getSection(section);
      if (sectionData) {
        // Simple search within section (could be enhanced)
        results = bambiSleepKB.search(query, options);
        results = results.filter(result => result.path[0] === section);
      } else {
        results = [];
      }
    } else {
      // Search all sections
      results = bambiSleepKB.search(query, options);
    }
    
    res.json({ 
      success: true, 
      results,
      query,
      section: section || 'all',
      count: results.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('KB search error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Search failed' 
    });
  }
});

// Get analytics
router.get('/analytics', async (req, res) => {
  try {
    if (!bambiSleepKB.initialized) {
      await bambiSleepKB.initialize();
    }
    
    const analytics = bambiSleepKB.getAnalytics();
    res.json({ 
      success: true, 
      analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('KB analytics error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get analytics' 
    });
  }
});

// Get detailed section info
router.get('/detailed/:sectionName', async (req, res) => {
  try {
    if (!bambiSleepKB.initialized) {
      await bambiSleepKB.initialize();
    }
    
    const { sectionName } = req.params;
    const detailedSection = bambiSleepKB.getDetailedSection(sectionName);
    
    if (!detailedSection) {
      return res.status(404).json({ 
        success: false, 
        error: `Section '${sectionName}' not found` 
      });
    }
    
    res.json({ 
      success: true, 
      detailedSection,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('KB detailed section error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get detailed section' 
    });
  }
});

// Export knowledge base
router.get('/export', async (req, res) => {
  try {
    if (!bambiSleepKB.initialized) {
      await bambiSleepKB.initialize();
    }
    
    const { format, sections } = req.query;
    const exportFormat = format || 'json';
    
    let exportData;
    if (exportFormat === 'summary') {
      exportData = bambiSleepKB.generateSummary();
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename=bambisleep-knowledge-base-summary.txt');
    } else {
      exportData = bambiSleepKB.export(exportFormat);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=bambisleep-knowledge-base.json');
    }
    
    res.send(exportData);
  } catch (error) {
    console.error('KB export error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Export failed' 
    });
  }
});

// Get all section names
router.get('/sections', async (req, res) => {
  try {
    if (!bambiSleepKB.initialized) {
      await bambiSleepKB.initialize();
    }
    
    const sections = Object.keys(bambiSleepKB.data);
    res.json({ 
      success: true, 
      sections,
      count: sections.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('KB sections error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get sections' 
    });
  }
});

// Get knowledge base status
router.get('/status', async (req, res) => {
  try {
    const status = {
      initialized: bambiSleepKB.initialized,
      lastUpdated: bambiSleepKB.analytics.lastUpdated,
      queriesProcessed: bambiSleepKB.analytics.queriesProcessed,
      popularTopics: bambiSleepKB.analytics.popularTopics
    };
    
    res.json({ 
      success: true, 
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('KB status error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get status' 
    });
  }
});

export default router;

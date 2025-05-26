// Enhanced UI JavaScript for LM Studio URL Scraper
class EnhancedUI {
    constructor() {
        this.API_BASE = '/api';
        this.activityLog = [];
        this.currentResults = [];
        this.searchIndex = new Map();
        this.analytics = {
            totalScraped: 0,
            successfulScrapes: 0,
            totalEmbeddings: 0,
            totalRelevanceScore: 0,
            scrapingActivity: [],
            categoryDistribution: {},
            keywordFrequency: {},
            performanceMetrics: {
                averageResponseTime: 0,
                responseTimes: []
            }
        };
        
        // Chart instances
        this.charts = {
            category: null,
            relevance: null,
            timeline: null
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupThresholdSlider();
        this.loadMcpTools();
        this.loadAnalytics();
        this.startRealTimeUpdates();
        this.logActivity('Enhanced URL Scraper initialized');
    }
    
    setupEventListeners() {
        // Form submissions
        document.getElementById('singleUrlForm')?.addEventListener('submit', (e) => this.scrapeSingleUrl(e));
        document.getElementById('batchUrlForm')?.addEventListener('submit', (e) => this.scrapeBatchUrls(e));
        document.getElementById('testUrlForm')?.addEventListener('submit', (e) => this.testUrl(e));
        document.getElementById('searchForm')?.addEventListener('submit', (e) => this.performSearch(e));
        
        // Real-time search
        document.getElementById('searchQuery')?.addEventListener('input', (e) => this.debounceSearch(e));
        
        // Filter changes
        document.getElementById('categoryFilter')?.addEventListener('change', () => this.performSearch());
        document.getElementById('relevanceFilter')?.addEventListener('input', () => this.performSearch());
        document.getElementById('dateFilter')?.addEventListener('change', () => this.performSearch());
        
        // Tab changes for analytics refresh
        document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                if (e.target.id === 'dashboard-tab') {
                    this.refreshCharts();
                }
            });
        });
    }
    
    setupThresholdSlider() {
        const slider = document.getElementById('relevanceThreshold');
        const valueDisplay = document.getElementById('thresholdValue');
        
        if (slider && valueDisplay) {
            slider.addEventListener('input', (e) => {
                valueDisplay.textContent = e.target.value;
            });
        }
    }
    
    // Activity Logging
    logActivity(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            message,
            type,
            fullMessage: `[${timestamp}] ${type.toUpperCase()}: ${message}`
        };
        
        this.activityLog.unshift(logEntry);
        
        // Keep only last 100 entries
        if (this.activityLog.length > 100) {
            this.activityLog = this.activityLog.slice(0, 100);
        }
        
        this.updateActivityDisplay();
    }
    
    updateActivityDisplay() {
        const logElement = document.getElementById('activityLog');
        if (logElement) {
            logElement.innerHTML = this.activityLog
                .slice(0, 50) // Show only last 50 in UI
                .map(entry => `<div class="log-entry log-${entry.type}">${entry.fullMessage}</div>`)
                .join('');
        }
    }
    
    // Single URL Scraping
    async scrapeSingleUrl(event) {
        event.preventDefault();
        
        const urlInput = document.getElementById('singleUrl');
        const url = urlInput.value.trim();
        
        if (!url) return;
        
        const options = this.getScrapingOptions();
        const submitBtn = event.target.querySelector('button[type="submit"]');
        
        this.setLoadingState(submitBtn, true);
        this.logActivity(`Starting scrape of: ${url}`);
        
        const startTime = Date.now();
        
        try {
            const response = await fetch(`${this.API_BASE}/scraper/single`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, options })
            });
            
            const result = await response.json();
            const duration = Date.now() - startTime;
            
            if (result.success) {
                this.logActivity(`Successfully scraped: ${url} (${duration}ms)`, 'success');
                this.displaySingleResult(result.data, duration);
                this.updateAnalytics(result.data, duration, true);
                
                // Generate embeddings if requested
                if (options.generateEmbeddings) {
                    await this.generateEmbeddings(result.data);
                }
            } else {
                throw new Error(result.error || 'Unknown error');
            }
            
        } catch (error) {
            this.logActivity(`Failed to scrape ${url}: ${error.message}`, 'error');
            this.displayError(error.message);
            this.updateAnalytics(null, Date.now() - startTime, false);
        } finally {
            this.setLoadingState(submitBtn, false);
        }
    }
    
    // Batch URL Scraping
    async scrapeBatchUrls(event) {
        event.preventDefault();
        
        const urlsInput = document.getElementById('batchUrls');
        const urls = urlsInput.value.trim().split('\\n').filter(url => url.trim());
        
        if (urls.length === 0) return;
        if (urls.length > 50) {
            this.logActivity('Maximum 50 URLs allowed for batch processing', 'error');
            return;
        }
        
        const options = this.getScrapingOptions();
        const submitBtn = event.target.querySelector('button[type="submit"]');
        
        this.setLoadingState(submitBtn, true);
        this.logActivity(`Starting batch scrape of ${urls.length} URLs`);
        
        const startTime = Date.now();
        
        try {
            const response = await fetch(`${this.API_BASE}/scraper/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls, options })
            });
            
            const result = await response.json();
            const duration = Date.now() - startTime;
            
            if (result.success) {
                const successful = result.results.filter(r => r.success).length;
                this.logActivity(`Batch completed: ${successful}/${urls.length} successful (${duration}ms)`, 'success');
                this.displayBatchResults(result.results);
                
                // Update analytics for each result
                result.results.forEach(item => {
                    this.updateAnalytics(item.success ? item.data : null, duration / urls.length, item.success);
                });
                
                // Generate embeddings for successful results
                if (options.generateEmbeddings) {
                    const successfulResults = result.results.filter(r => r.success);
                    for (const item of successfulResults) {
                        await this.generateEmbeddings(item.data);
                    }
                }
            } else {
                throw new Error(result.error || 'Batch processing failed');
            }
            
        } catch (error) {
            this.logActivity(`Batch scraping failed: ${error.message}`, 'error');
            this.displayError(error.message);
        } finally {
            this.setLoadingState(submitBtn, false);
        }
    }
    
    // URL Testing
    async testUrl(event) {
        event.preventDefault();
        
        const urlInput = document.getElementById('testUrl');
        const url = urlInput.value.trim();
        
        if (!url) return;
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        this.setLoadingState(submitBtn, true);
        this.logActivity(`Testing URL: ${url}`);
        
        try {
            const response = await fetch(`${this.API_BASE}/scraper/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.logActivity(`URL test completed for: ${url}`, 'success');
                this.displayTestResults(result.data);
            } else {
                throw new Error(result.error || 'Test failed');
            }
            
        } catch (error) {
            this.logActivity(`URL test failed: ${error.message}`, 'error');
            this.displayError(error.message);
        } finally {
            this.setLoadingState(submitBtn, false);
        }
    }
    
    // Embedding Generation
    async generateEmbeddings(data) {
        try {
            this.logActivity('Generating embeddings...');
            
            const response = await fetch(`${this.API_BASE}/mcp/process-content`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: data.content?.mainContent || '',
                    metadata: {
                        title: data.content?.title,
                        url: data.url,
                        source: 'web_scraper'
                    }
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.analytics.totalEmbeddings += result.embeddingsGenerated || 1;
                this.updateDashboardMetrics();
                this.logActivity('Embeddings generated successfully', 'success');
            } else {
                throw new Error(result.error || 'Embedding generation failed');
            }
            
        } catch (error) {
            this.logActivity(`Embedding generation failed: ${error.message}`, 'error');
        }
    }
    
    // Search Functionality
    async performSearch(event = null) {
        if (event) event.preventDefault();
        
        const query = document.getElementById('searchQuery')?.value || '';
        const category = document.getElementById('categoryFilter')?.value || '';
        const minRelevance = parseFloat(document.getElementById('relevanceFilter')?.value || 0);
        const dateFilter = document.getElementById('dateFilter')?.value || '';
        
        try {
            this.logActivity(`Searching: "${query}"`);
            
            const response = await fetch(`${this.API_BASE}/mcp/embedding-search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    limit: 50,
                    threshold: minRelevance
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                let results = result.results || [];
                
                // Apply additional filters
                results = this.applyFilters(results, { category, dateFilter });
                
                this.displaySearchResults(results, query);
                this.updateSearchStats(results);
                this.logActivity(`Found ${results.length} results`, 'success');
            } else {
                throw new Error(result.error || 'Search failed');
            }
            
        } catch (error) {
            this.logActivity(`Search failed: ${error.message}`, 'error');
            this.displaySearchResults([], query);
        }
    }
    
    // Debounced search for real-time filtering
    debounceSearch = this.debounce(this.performSearch.bind(this), 500);
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Filter application
    applyFilters(results, filters) {
        return results.filter(item => {
            // Category filter
            if (filters.category && item.metadata?.category !== filters.category) {
                return false;
            }
            
            // Date filter
            if (filters.dateFilter) {
                const itemDate = new Date(item.metadata?.scrapedAt || item.metadata?.processedAt);
                const now = new Date();
                
                switch (filters.dateFilter) {
                    case 'today':
                        if (itemDate.toDateString() !== now.toDateString()) return false;
                        break;
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        if (itemDate < weekAgo) return false;
                        break;
                    case 'month':
                        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        if (itemDate < monthAgo) return false;
                        break;
                    case 'year':
                        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                        if (itemDate < yearAgo) return false;
                        break;
                }
            }
            
            return true;
        });
    }
    
    // Display Functions
    displaySingleResult(result, duration) {
        const resultsDiv = document.getElementById('results');
        const content = result.content;
        const analysis = result.metadata?.analysis || {};
        
        const relevanceScore = analysis.relevanceScore || 0;
        const category = analysis.category?.primary || 'unknown';
        
        resultsDiv.innerHTML = `
            <div class="result-item border rounded p-3 mb-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0">${this.escapeHtml(content.title || 'No Title')}</h6>
                    <div>
                        <span class="badge bg-success status-badge me-1">Success</span>
                        <span class="badge ${this.getRelevanceBadgeClass(relevanceScore)} relevance-badge">
                            ${(relevanceScore * 100).toFixed(1)}% relevant
                        </span>
                    </div>
                </div>
                
                <div class="text-muted small mb-2">
                    <i class="bi bi-link"></i> ${this.escapeHtml(result.url)}
                </div>
                
                ${content.description ? `<p class="text-muted small">${this.escapeHtml(content.description)}</p>` : ''}
                
                <div class="row g-2 mb-3">
                    <div class="col-sm-3">
                        <small class="text-muted">Words: <strong>${content.wordCount || 0}</strong></small>
                    </div>
                    <div class="col-sm-3">
                        <small class="text-muted">Duration: <strong>${duration}ms</strong></small>
                    </div>
                    <div class="col-sm-3">
                        <span class="badge ${this.getCategoryBadgeClass(category)} category-badge">
                            ${category.replace('_', ' ')}
                        </span>
                    </div>
                    <div class="col-sm-3">
                        <div class="quality-meter">
                            <div class="quality-fill ${this.getQualityClass(relevanceScore)}" 
                                 style="width: ${relevanceScore * 100}%"></div>
                        </div>
                    </div>
                </div>
                
                ${analysis.keyPhrases && analysis.keyPhrases.length > 0 ? `
                    <div class="mb-3">
                        <h6>Key Phrases:</h6>
                        <div class="d-flex flex-wrap gap-1">
                            ${analysis.keyPhrases.slice(0, 10).map(phrase => 
                                `<span class="badge bg-light text-dark">${this.escapeHtml(phrase.keyword)}</span>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${content.headings && content.headings.length > 0 ? `
                    <div class="mb-3">
                        <h6>Headings:</h6>
                        <ul class="list-unstyled">
                            ${content.headings.slice(0, 5).map(h => 
                                `<li class="small">H${h.level}: ${this.escapeHtml(h.text)}</li>`
                            ).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="content-preview">
                    <h6>Content Preview:</h6>
                    <div class="small text-muted">
                        ${this.escapeHtml(this.truncateText(content.mainContent || 'No content extracted', 500))}
                    </div>
                </div>
                
                <div class="mt-3">
                    <button class="btn btn-sm btn-outline-primary" onclick="ui.viewFullContent('${result.url}')">
                        <i class="bi bi-eye"></i> View Full
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="ui.exportSingle('${result.url}')">
                        <i class="bi bi-download"></i> Export
                    </button>
                </div>
            </div>
        `;
        
        this.currentResults = [result];
    }
    
    displayBatchResults(results) {
        const resultsDiv = document.getElementById('results');
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        resultsDiv.innerHTML = `
            <div class="mb-3">
                <h6>Batch Results Summary</h6>
                <div class="row g-2">
                    <div class="col-sm-4">
                        <span class="badge bg-success">Successful: ${successful.length}</span>
                    </div>
                    <div class="col-sm-4">
                        <span class="badge bg-danger">Failed: ${failed.length}</span>
                    </div>
                    <div class="col-sm-4">
                        <span class="badge bg-info">Total: ${results.length}</span>
                    </div>
                </div>
            </div>
            
            <div class="results-list">
                ${results.map(result => this.createResultCard(result)).join('')}
            </div>
        `;
        
        this.currentResults = successful.map(r => r.data);
    }
    
    displayTestResults(testData) {
        const resultsDiv = document.getElementById('results');
        
        resultsDiv.innerHTML = `
            <div class="test-results">
                <h6><i class="bi bi-speedometer2"></i> URL Test Results</h6>
                
                <div class="row g-3">
                    <div class="col-md-6">
                        <div class="card ${testData.accessible ? 'border-success' : 'border-danger'}">
                            <div class="card-body text-center">
                                <h5 class="card-title">
                                    <i class="bi bi-${testData.accessible ? 'check-circle text-success' : 'x-circle text-danger'}"></i>
                                    ${testData.accessible ? 'Accessible' : 'Not Accessible'}
                                </h5>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="card ${testData.requiresBrowser ? 'border-warning' : 'border-info'}">
                            <div class="card-body text-center">
                                <h5 class="card-title">
                                    <i class="bi bi-${testData.requiresBrowser ? 'browser-chrome text-warning' : 'file-text text-info'}"></i>
                                    ${testData.requiresBrowser ? 'Needs Browser' : 'Basic Scraping OK'}
                                </h5>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-3">
                    <h6>Performance</h6>
                    <div class="row g-2">
                        <div class="col-md-6">
                            <small class="text-muted">Basic Scraper:</small>
                            <div class="d-flex justify-content-between">
                                <span class="badge ${testData.basicWorking ? 'bg-success' : 'bg-danger'}">
                                    ${testData.basicWorking ? 'Working' : 'Failed'}
                                </span>
                                <small>${testData.performance?.basic || 0}ms</small>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <small class="text-muted">Browser Automation:</small>
                            <div class="d-flex justify-content-between">
                                <span class="badge ${testData.browserWorking ? 'bg-success' : 'bg-danger'}">
                                    ${testData.browserWorking ? 'Working' : 'Failed'}
                                </span>
                                <small>${testData.performance?.browser || 0}ms</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${testData.recommendations.length > 0 ? `
                    <div class="mt-3">
                        <h6>Recommendations</h6>
                        <ul class="list-group">
                            ${testData.recommendations.map(rec => 
                                `<li class="list-group-item">${this.escapeHtml(rec)}</li>`
                            ).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    displaySearchResults(results, query) {
        const searchResultsDiv = document.getElementById('searchResults');
        
        if (results.length === 0) {
            searchResultsDiv.innerHTML = `
                <div class="text-muted text-center py-5">
                    <i class="bi bi-search fs-1"></i>
                    <h6 class="mt-3">No results found</h6>
                    <p>${query ? `No results for "${query}"` : 'Try adjusting your search filters'}</p>
                </div>
            `;
            return;
        }
        
        searchResultsDiv.innerHTML = `
            <div class="mb-3">
                <small class="text-muted">Found ${results.length} results${query ? ` for "${query}"` : ''}</small>
            </div>
            
            <div class="search-results-list">
                ${results.map(result => this.createSearchResultCard(result, query)).join('')}
            </div>
        `;
    }
    
    // Helper Functions
    createResultCard(result) {
        const analysis = result.data?.metadata?.analysis || {};
        const relevanceScore = analysis.relevanceScore || 0;
        const category = analysis.category?.primary || 'unknown';
        
        return `
            <div class="result-item border rounded p-2 mb-2 ${result.success ? 'border-success' : 'border-danger'}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="small fw-bold">
                            ${this.escapeHtml(result.data?.content?.title || result.url)}
                        </div>
                        <div class="text-muted small">
                            ${this.escapeHtml(result.url)}
                        </div>
                        ${!result.success ? `<div class="text-danger small">${this.escapeHtml(result.error)}</div>` : ''}
                        ${result.success ? `
                            <div class="mt-1">
                                <span class="badge ${this.getCategoryBadgeClass(category)} category-badge me-1">
                                    ${category.replace('_', ' ')}
                                </span>
                                <span class="badge ${this.getRelevanceBadgeClass(relevanceScore)} relevance-badge">
                                    ${(relevanceScore * 100).toFixed(1)}%
                                </span>
                            </div>
                        ` : ''}
                    </div>
                    <span class="badge ${result.success ? 'bg-success' : 'bg-danger'} status-badge">
                        ${result.success ? 'Success' : 'Failed'}
                    </span>
                </div>
            </div>
        `;
    }
    
    createSearchResultCard(result, query) {
        const metadata = result.metadata || {};
        const relevanceScore = metadata.relevanceScore || result.similarity || 0;
        const category = metadata.category || 'unknown';
        
        // Highlight search terms
        let content = result.content || metadata.cleanedContent || '';
        if (query) {
            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
            content = content.replace(regex, '<span class="search-highlight">$1</span>');
        }
        
        return `
            <div class="search-result-item border rounded p-3 mb-2">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h6 class="mb-0">${this.escapeHtml(metadata.title || metadata.source || 'Untitled')}</h6>
                    <div>
                        <span class="badge ${this.getRelevanceBadgeClass(relevanceScore)} relevance-badge">
                            ${(relevanceScore * 100).toFixed(1)}%
                        </span>
                        <span class="badge ${this.getCategoryBadgeClass(category)} category-badge">
                            ${category.replace('_', ' ')}
                        </span>
                    </div>
                </div>
                
                ${metadata.url ? `
                    <div class="text-muted small mb-2">
                        <i class="bi bi-link"></i> ${this.escapeHtml(metadata.url)}
                    </div>
                ` : ''}
                
                <div class="content-preview">
                    <div class="small">
                        ${this.truncateText(content, 300)}
                    </div>
                </div>
                
                <div class="mt-2">
                    <small class="text-muted">
                        <i class="bi bi-calendar"></i> ${new Date(metadata.processedAt || metadata.scrapedAt).toLocaleDateString()}
                        ${metadata.wordCount ? `| <i class="bi bi-file-text"></i> ${metadata.wordCount} words` : ''}
                    </small>
                </div>
            </div>
        `;
    }
    
    // Analytics and Charts
    updateAnalytics(result, duration, success) {
        this.analytics.totalScraped++;
        if (success) {
            this.analytics.successfulScrapes++;
            
            if (result?.metadata?.analysis?.relevanceScore) {
                this.analytics.totalRelevanceScore += result.metadata.analysis.relevanceScore;
            }
            
            // Update category distribution
            const category = result?.metadata?.analysis?.category?.primary || 'unknown';
            this.analytics.categoryDistribution[category] = (this.analytics.categoryDistribution[category] || 0) + 1;
            
            // Update keyword frequency
            const keyPhrases = result?.metadata?.analysis?.keyPhrases || [];
            keyPhrases.forEach(phrase => {
                this.analytics.keywordFrequency[phrase.keyword] = (this.analytics.keywordFrequency[phrase.keyword] || 0) + phrase.count;
            });
        }
        
        // Update performance metrics
        this.analytics.performanceMetrics.responseTimes.push(duration);
        if (this.analytics.performanceMetrics.responseTimes.length > 100) {
            this.analytics.performanceMetrics.responseTimes = this.analytics.performanceMetrics.responseTimes.slice(-100);
        }
        
        this.analytics.performanceMetrics.averageResponseTime = 
            this.analytics.performanceMetrics.responseTimes.reduce((a, b) => a + b, 0) / 
            this.analytics.performanceMetrics.responseTimes.length;
        
        // Add to activity timeline
        this.analytics.scrapingActivity.push({
            timestamp: new Date(),
            success,
            duration,
            category: result?.metadata?.analysis?.category?.primary
        });
        
        // Keep only last 100 activities
        if (this.analytics.scrapingActivity.length > 100) {
            this.analytics.scrapingActivity = this.analytics.scrapingActivity.slice(-100);
        }
        
        this.updateDashboardMetrics();
    }
    
    updateDashboardMetrics() {
        // Update metric cards
        document.getElementById('totalScraped').textContent = this.analytics.totalScraped;
        
        const avgRelevance = this.analytics.successfulScrapes > 0 ? 
            (this.analytics.totalRelevanceScore / this.analytics.successfulScrapes * 100).toFixed(1) : 0;
        document.getElementById('averageRelevance').textContent = `${avgRelevance}%`;
        
        document.getElementById('totalEmbeddings').textContent = this.analytics.totalEmbeddings;
        
        const successRate = this.analytics.totalScraped > 0 ? 
            (this.analytics.successfulScrapes / this.analytics.totalScraped * 100).toFixed(1) : 0;
        document.getElementById('successRate').textContent = `${successRate}%`;
    }
    
    updateSearchStats(results) {
        document.getElementById('statsTotal').textContent = results.length;
        
        const avgRelevance = results.length > 0 ? 
            (results.reduce((sum, r) => sum + (r.similarity || r.metadata?.relevanceScore || 0), 0) / results.length * 100).toFixed(1) : 0;
        document.getElementById('statsAvgRelevance').textContent = `${avgRelevance}%`;
    }
    
    // Utility Functions
    getScrapingOptions() {
        return {
            respectRobots: document.getElementById('respectRobots')?.checked || false,
            useBrowserAutomation: document.getElementById('useBrowserAutomation')?.checked || false,
            enhancedAnalysis: document.getElementById('enhancedAnalysis')?.checked || true,
            generateEmbeddings: document.getElementById('generateEmbeddings')?.checked || true,
            relevanceThreshold: parseFloat(document.getElementById('relevanceThreshold')?.value || 0.4)
        };
    }
    
    setLoadingState(button, loading) {
        const spinner = button.querySelector('.loading');
        if (spinner) {
            spinner.style.display = loading ? 'inline-block' : 'none';
        }
        button.disabled = loading;
    }
    
    getRelevanceBadgeClass(score) {
        if (score >= 0.8) return 'bg-success';
        if (score >= 0.6) return 'bg-warning';
        if (score >= 0.4) return 'bg-info';
        return 'bg-secondary';
    }
    
    getCategoryBadgeClass(category) {
        const classes = {
            core_content: 'bg-success',
            community: 'bg-primary',
            guide: 'bg-info',
            technical: 'bg-warning',
            experience: 'bg-purple',
            resource: 'bg-dark',
            news: 'bg-danger',
            unknown: 'bg-secondary'
        };
        return classes[category] || 'bg-secondary';
    }
    
    getQualityClass(score) {
        if (score >= 0.7) return 'quality-high';
        if (score >= 0.4) return 'quality-medium';
        return 'quality-low';
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    // Chart Management
    initializeCharts() {
        // Category Distribution Chart
        const categoryCtx = document.getElementById('categoryChart');
        if (categoryCtx) {
            this.charts.category = new Chart(categoryCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#28a745', '#007bff', '#17a2b8', '#ffc107',
                            '#6f42c1', '#343a40', '#dc3545', '#6c757d'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }
        
        // Relevance Distribution Chart
        const relevanceCtx = document.getElementById('relevanceChart');
        if (relevanceCtx) {
            this.charts.relevance = new Chart(relevanceCtx, {
                type: 'bar',
                data: {
                    labels: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'],
                    datasets: [{
                        label: 'Content Count',
                        data: [0, 0, 0, 0, 0],
                        backgroundColor: '#007bff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
        
        // Timeline Chart
        const timelineCtx = document.getElementById('timelineChart');
        if (timelineCtx) {
            this.charts.timeline = new Chart(timelineCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Successful Scrapes',
                        data: [],
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        fill: true
                    }, {
                        label: 'Failed Scrapes',
                        data: [],
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { type: 'time', time: { unit: 'hour' } },
                        y: { beginAtZero: true }
                    }
                }
            });
        }
    }
    
    refreshCharts() {
        // Update category chart
        if (this.charts.category) {
            const categoryData = Object.entries(this.analytics.categoryDistribution);
            this.charts.category.data.labels = categoryData.map(([key]) => key.replace('_', ' '));
            this.charts.category.data.datasets[0].data = categoryData.map(([, value]) => value);
            this.charts.category.update();
        }
        
        // Update relevance distribution chart
        if (this.charts.relevance) {
            // Calculate relevance distribution from activity
            const distribution = [0, 0, 0, 0, 0];
            // This would need actual relevance data from stored results
            this.charts.relevance.data.datasets[0].data = distribution;
            this.charts.relevance.update();
        }
        
        // Update timeline chart
        if (this.charts.timeline) {
            // Group activity by hour
            const hourlyData = {};
            this.analytics.scrapingActivity.forEach(activity => {
                const hour = new Date(activity.timestamp).toISOString().substr(0, 13);
                if (!hourlyData[hour]) {
                    hourlyData[hour] = { success: 0, failed: 0 };
                }
                if (activity.success) {
                    hourlyData[hour].success++;
                } else {
                    hourlyData[hour].failed++;
                }
            });
            
            const hours = Object.keys(hourlyData).sort();
            this.charts.timeline.data.labels = hours;
            this.charts.timeline.data.datasets[0].data = hours.map(hour => hourlyData[hour].success);
            this.charts.timeline.data.datasets[1].data = hours.map(hour => hourlyData[hour].failed);
            this.charts.timeline.update();
        }
    }
    
    // MCP Tools
    async loadMcpTools() {
        try {
            this.logActivity('Loading MCP tools...');
            
            const response = await fetch(`${this.API_BASE}/mcp/tools`);
            const data = await response.json();
            
            const toolsList = document.getElementById('mcpToolsList');
            if (toolsList) {
                toolsList.innerHTML = `
                    <div class="row">
                        ${data.tools.map(tool => `
                            <div class="col-md-6 mb-3">
                                <div class="card">
                                    <div class="card-body">
                                        <h6 class="card-title">
                                            <i class="bi bi-tool"></i> ${tool.name}
                                        </h6>
                                        <p class="card-text small text-muted">
                                            ${tool.description}
                                        </p>
                                        ${tool.inputSchema ? `
                                            <details>
                                                <summary class="small">Parameters</summary>
                                                <pre class="small mt-2"><code>${JSON.stringify(tool.inputSchema.properties, null, 2)}</code></pre>
                                            </details>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }
            
            this.logActivity(`Loaded ${data.tools.length} MCP tools`, 'success');
        } catch (error) {
            this.logActivity(`Failed to load MCP tools: ${error.message}`, 'error');
        }
    }
    
    // Load initial analytics
    async loadAnalytics() {
        try {
            const response = await fetch(`${this.API_BASE}/mcp/embedding-stats`);
            const data = await response.json();
            
            if (data.success) {
                this.analytics.totalEmbeddings = data.stats.totalEmbeddings || 0;
                this.updateDashboardMetrics();
            }
        } catch (error) {
            console.warn('Could not load initial analytics:', error);
        }
    }
    
    // Real-time updates
    startRealTimeUpdates() {
        // Update metrics every 30 seconds
        setInterval(() => {
            this.loadAnalytics();
        }, 30000);
        
        // Initialize charts after DOM is ready
        setTimeout(() => {
            this.initializeCharts();
        }, 1000);
    }
    
    // Utility actions
    clearResults() {
        document.getElementById('results').innerHTML = `
            <div class="text-muted text-center py-5">
                <i class="bi bi-info-circle fs-1"></i>
                <h6 class="mt-3">Results cleared</h6>
                <p>Enter a URL and click "Scrape URL" to see results here</p>
            </div>
        `;
        this.currentResults = [];
    }
    
    clearLog() {
        this.activityLog = [];
        this.updateActivityDisplay();
        this.logActivity('Activity log cleared');
    }
    
    exportResults() {
        if (this.currentResults.length === 0) {
            this.logActivity('No results to export', 'warning');
            return;
        }
        
        const dataStr = JSON.stringify(this.currentResults, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `scraper-results-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        this.logActivity('Results exported successfully', 'success');
    }
    
    // Dark mode toggle
    toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        // Implementation would require additional CSS
    }
    
    // Additional utility methods for specific result viewing
    viewFullContent(url) {
        // Implementation for viewing full content in modal
        this.logActivity(`Viewing full content for: ${url}`);
    }
    
    exportSingle(url) {
        const result = this.currentResults.find(r => r.url === url);
        if (result) {
            const dataStr = JSON.stringify(result, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `scraper-result-${new Date().toISOString().slice(0, 10)}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            this.logActivity('Single result exported', 'success');
        }
    }
}

// Initialize the enhanced UI when the page loads
let ui;
document.addEventListener('DOMContentLoaded', () => {
    ui = new EnhancedUI();
});

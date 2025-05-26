/**
 * BambiSleep Knowledge Base UI
 * Interactive dashboard for exploring BambiSleep information
 */

class KnowledgeBaseUI {
    constructor() {
        this.API_BASE = '/api';
        this.knowledgeBase = null;
        this.searchResults = [];
        this.analytics = {
            queriesProcessed: 0,
            popularTopics: {},
            lastUpdated: null
        };
    }

    async init() {
        console.log('Initializing BambiSleep Knowledge Base UI...');
        
        // Initialize the knowledge base
        await this.initializeKnowledgeBase();
        
        // Load all sections
        await this.loadAllSections();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load analytics
        await this.loadAnalytics();
        
        console.log('BambiSleep Knowledge Base UI initialized successfully');
    }

    async initializeKnowledgeBase() {
        try {
            const response = await fetch(`${this.API_BASE}/knowledge-base/init`, {
                method: 'POST'
            });
            
            if (response.ok) {
                const result = await response.json();
                this.knowledgeBase = result.success;
                console.log('Knowledge base initialized');
            } else {
                console.warn('Failed to initialize knowledge base, using fallback');
                this.initializeFallbackKB();
            }
        } catch (error) {
            console.warn('Error initializing knowledge base:', error);
            this.initializeFallbackKB();
        }
    }

    initializeFallbackKB() {
        // Fallback initialization if API is not available
        this.knowledgeBase = {
            identity: {
                name: "BambiSleep",
                type: "Hypnosis Series",
                creator: "BambiSleep Community",
                firstRelease: "2018"
            },
            description: {
                whatIs: "BambiSleep is a sophisticated hypnosis series designed to create a specific mental state and personality transformation through advanced psychological conditioning techniques."
            }
        };
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    this.searchKnowledgeBase();
                }
            });
        }

        // Section filter
        const sectionFilter = document.getElementById('sectionFilter');
        if (sectionFilter) {
            sectionFilter.addEventListener('change', () => {
                if (searchInput && searchInput.value.trim()) {
                    this.searchKnowledgeBase();
                }
            });
        }

        // Tab change events
        document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(tab => {
            tab.addEventListener('shown.bs.tab', (e) => {
                const targetId = e.target.getAttribute('data-bs-target');
                this.onTabChange(targetId);
            });
        });
    }

    async loadAllSections() {
        console.log('Loading all knowledge base sections...');
        
        // Load overview
        await this.loadOverview();
        
        // Load identity
        await this.loadIdentitySection();
        
        // Load personality
        await this.loadPersonalitySection();
        
        // Load triggers
        await this.loadTriggersSection();
        
        // Load content
        await this.loadContentSection();
        
        // Load resources
        await this.loadResourcesSection();
        
        // Load safety
        await this.loadSafetySection();
    }

    async loadOverview() {
        try {
            const response = await fetch(`${this.API_BASE}/knowledge-base/overview`);
            const data = await response.json();
            
            if (data.success) {
                const overview = data.overview;
                
                // Description
                document.getElementById('overviewDescription').innerHTML = `
                    <p class="lead">${overview.summary?.description || 'Loading...'}</p>
                    <div class="mt-3">
                        <strong>Creator:</strong> ${overview.identity?.creator || 'Unknown'}<br>
                        <strong>Type:</strong> ${overview.identity?.type || 'Unknown'}<br>
                        <strong>First Release:</strong> ${overview.identity?.firstRelease || 'Unknown'}
                    </div>
                `;
                
                // Goals
                if (overview.summary?.primaryGoals) {
                    document.getElementById('overviewGoals').innerHTML = `
                        <ul class="list-unstyled">
                            ${overview.summary.primaryGoals.map(goal => 
                                `<li class="mb-2"><i class="bi bi-arrow-right text-primary"></i> ${goal}</li>`
                            ).join('')}
                        </ul>
                    `;
                }
                
                // Triggers
                if (overview.summary?.keyTriggers) {
                    document.getElementById('overviewTriggers').innerHTML = `
                        <div class="row">
                            ${overview.summary.keyTriggers.map(trigger => 
                                `<div class="col-md-6 mb-2">
                                    <div class="trigger-item">
                                        <strong>"${trigger}"</strong>
                                    </div>
                                </div>`
                            ).join('')}
                        </div>
                    `;
                }
                
                // Sites
                if (overview.summary?.mainSites) {
                    document.getElementById('overviewSites').innerHTML = `
                        ${overview.summary.mainSites.map(site => 
                            `<div class="site-item mb-2">
                                <strong>${site.type}</strong><br>
                                <a href="${site.url}" target="_blank" class="text-decoration-none">
                                    <i class="bi bi-link-45deg"></i> ${site.url}
                                </a>
                            </div>`
                        ).join('')}
                    `;
                }
            }
        } catch (error) {
            console.error('Error loading overview:', error);
            this.loadFallbackOverview();
        }
    }

    loadFallbackOverview() {
        document.getElementById('overviewDescription').innerHTML = `
            <p class="lead">BambiSleep is a sophisticated hypnosis series designed to create a specific mental state and personality transformation.</p>
            <div class="mt-3">
                <strong>Creator:</strong> BambiSleep Community<br>
                <strong>Type:</strong> Hypnosis Series<br>
                <strong>First Release:</strong> 2018
            </div>
        `;
    }

    async loadIdentitySection() {
        try {
            const response = await fetch(`${this.API_BASE}/knowledge-base/section/identity`);
            const data = await response.json();
            
            if (data.success && data.section) {
                const identity = data.section;
                
                document.getElementById('identityContent').innerHTML = `
                    <div class="row">
                        <div class="col-md-6">
                            <h6><i class="bi bi-info-circle"></i> Basic Information</h6>
                            <table class="table table-borderless">
                                <tr><th>Name:</th><td>${identity.name || 'N/A'}</td></tr>
                                <tr><th>Type:</th><td>${identity.type || 'N/A'}</td></tr>
                                <tr><th>Creator:</th><td>${identity.creator || 'N/A'}</td></tr>
                                <tr><th>First Release:</th><td>${identity.firstRelease || 'N/A'}</td></tr>
                                <tr><th>Current Version:</th><td>${identity.currentVersion || 'N/A'}</td></tr>
                            </table>
                        </div>
                        <div class="col-md-6">
                            <h6><i class="bi bi-tags"></i> Known Aliases</h6>
                            ${identity.aliases ? `
                                <div class="d-flex flex-wrap">
                                    ${identity.aliases.map(alias => 
                                        `<span class="badge badge-bambi me-2 mb-2">${alias}</span>`
                                    ).join('')}
                                </div>
                            ` : '<p class="text-muted">No aliases available</p>'}
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading identity section:', error);
        }
    }

    async loadPersonalitySection() {
        try {
            const response = await fetch(`${this.API_BASE}/knowledge-base/section/personality`);
            const data = await response.json();
            
            if (data.success && data.section) {
                const personality = data.section;
                
                // Traits
                if (personality.traits) {
                    document.getElementById('personalityTraits').innerHTML = `
                        <div class="mb-3">
                            ${personality.traits.map(trait => 
                                `<div class="personality-trait">${trait}</div>`
                            ).join('')}
                        </div>
                    `;
                }
                
                // Values and Mental State
                document.getElementById('personalityValues').innerHTML = `
                    <h6><i class="bi bi-heart"></i> Core Values</h6>
                    ${personality.coreValues ? `
                        <ul class="list-unstyled">
                            ${personality.coreValues.map(value => 
                                `<li class="mb-2"><i class="bi bi-arrow-right text-primary"></i> ${value}</li>`
                            ).join('')}
                        </ul>
                    ` : '<p class="text-muted">No core values available</p>'}
                    
                    <h6 class="mt-4"><i class="bi bi-brain"></i> Mental State</h6>
                    <p>${personality.mentalState || 'No mental state information available'}</p>
                `;
                
                // Appearance
                if (personality.physicalIdeal || personality.behavioralMannerisms) {
                    document.getElementById('personalityAppearance').innerHTML = `
                        <div class="row">
                            <div class="col-md-6">
                                <h6><i class="bi bi-person"></i> Physical Ideal</h6>
                                ${personality.physicalIdeal ? `
                                    <ul class="list-unstyled">
                                        ${personality.physicalIdeal.map(ideal => 
                                            `<li class="mb-2"><i class="bi bi-check2"></i> ${ideal}</li>`
                                        ).join('')}
                                    </ul>
                                ` : '<p class="text-muted">No physical ideals available</p>'}
                            </div>
                            <div class="col-md-6">
                                <h6><i class="bi bi-activity"></i> Behavioral Mannerisms</h6>
                                ${personality.behavioralMannerisms ? `
                                    <ul class="list-unstyled">
                                        ${personality.behavioralMannerisms.map(manner => 
                                            `<li class="mb-2"><i class="bi bi-check2"></i> ${manner}</li>`
                                        ).join('')}
                                    </ul>
                                ` : '<p class="text-muted">No behavioral mannerisms available</p>'}
                            </div>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Error loading personality section:', error);
        }
    }

    async loadTriggersSection() {
        try {
            const response = await fetch(`${this.API_BASE}/knowledge-base/section/triggers`);
            const data = await response.json();
            
            if (data.success && data.section) {
                const triggers = data.section;
                
                // Activation Triggers
                if (triggers.activation) {
                    document.getElementById('activationTriggers').innerHTML = this.formatTriggersList(triggers.activation);
                }
                
                // Behavioral Triggers
                if (triggers.behavioral) {
                    document.getElementById('behavioralTriggers').innerHTML = this.formatTriggersList(triggers.behavioral);
                }
                
                // Conditioning Triggers
                if (triggers.conditioning) {
                    document.getElementById('conditioningTriggers').innerHTML = this.formatTriggersList(triggers.conditioning);
                }
                
                // Advanced Triggers
                if (triggers.advanced) {
                    document.getElementById('advancedTriggers').innerHTML = this.formatTriggersList(triggers.advanced);
                }
            }
        } catch (error) {
            console.error('Error loading triggers section:', error);
        }
    }

    formatTriggersList(triggers) {
        return triggers.map(trigger => 
            `<div class="trigger-item mb-2">
                <strong>"${trigger}"</strong>
            </div>`
        ).join('');
    }

    async loadContentSection() {
        try {
            const response = await fetch(`${this.API_BASE}/knowledge-base/section/content`);
            const data = await response.json();
            
            if (data.success && data.section) {
                const content = data.section;
                
                // Audio Series
                if (content.audioSeries) {
                    document.getElementById('audioSeries').innerHTML = this.formatContentList(content.audioSeries, 'music-note');
                }
                
                // Techniques
                if (content.techniques) {
                    document.getElementById('techniques').innerHTML = this.formatContentList(content.techniques, 'gear');
                }
                
                // Themes
                if (content.themes) {
                    document.getElementById('themes').innerHTML = this.formatContentList(content.themes, 'tag');
                }
            }
        } catch (error) {
            console.error('Error loading content section:', error);
        }
    }

    formatContentList(items, icon) {
        return items.map(item => 
            `<div class="mb-2">
                <i class="bi bi-${icon} text-primary"></i> ${item}
            </div>`
        ).join('');
    }

    async loadResourcesSection() {
        try {
            const response = await fetch(`${this.API_BASE}/knowledge-base/section/sites`);
            const sitesData = await response.json();
            
            const filesResponse = await fetch(`${this.API_BASE}/knowledge-base/section/files`);
            const filesData = await filesResponse.json();
            
            if (sitesData.success && sitesData.section) {
                const sites = sitesData.section;
                
                // Official Sites
                if (sites.official) {
                    document.getElementById('officialSites').innerHTML = this.formatSitesList(sites.official);
                }
                
                // Community Sites
                if (sites.community) {
                    document.getElementById('communitySites').innerHTML = this.formatSitesList(sites.community);
                }
            }
            
            if (filesData.success && filesData.section) {
                const files = filesData.section;
                
                document.getElementById('fileCollections').innerHTML = `
                    <div class="col-md-3">
                        <h6><i class="bi bi-file-earmark"></i> Core Files</h6>
                        ${this.formatFilesList(files.core || [])}
                    </div>
                    <div class="col-md-3">
                        <h6><i class="bi bi-file-earmark-plus"></i> Advanced</h6>
                        ${this.formatFilesList(files.advanced || [])}
                    </div>
                    <div class="col-md-3">
                        <h6><i class="bi bi-file-earmark-music"></i> Supplements</h6>
                        ${this.formatFilesList(files.supplements || [])}
                    </div>
                    <div class="col-md-3">
                        <h6><i class="bi bi-file-earmark-lock"></i> Specialized</h6>
                        ${this.formatFilesList(files.specialized || [])}
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading resources section:', error);
        }
    }

    formatSitesList(sites) {
        return sites.map(site => 
            `<div class="site-item mb-3">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong>${site.type}</strong>
                        <br>
                        <small class="text-muted">${site.description}</small>
                        <br>
                        <a href="${site.url}" target="_blank" class="text-decoration-none">
                            <i class="bi bi-link-45deg"></i> ${site.url}
                        </a>
                    </div>
                    <span class="badge ${site.status === 'Active' ? 'bg-success' : 'bg-warning'}">${site.status}</span>
                </div>
                ${site.content ? `
                    <div class="mt-2">
                        <small class="text-muted">
                            <strong>Content:</strong> ${site.content.join(', ')}
                        </small>
                    </div>
                ` : ''}
            </div>`
        ).join('');
    }

    formatFilesList(files) {
        return files.map(file => 
            `<div class="mb-2">
                <i class="bi bi-file-earmark-music text-primary"></i> 
                <small>${file}</small>
            </div>`
        ).join('');
    }

    async loadSafetySection() {
        try {
            const response = await fetch(`${this.API_BASE}/knowledge-base/section/warnings`);
            const warningsData = await response.json();
            
            const researchResponse = await fetch(`${this.API_BASE}/knowledge-base/section/research`);
            const researchData = await researchResponse.json();
            
            if (warningsData.success && warningsData.section) {
                const warnings = warningsData.section;
                
                // Psychological Warnings
                if (warnings.psychological) {
                    document.getElementById('psychologicalWarnings').innerHTML = this.formatWarningsList(warnings.psychological);
                }
                
                // Behavioral Warnings
                if (warnings.behavioral) {
                    document.getElementById('behavioralWarnings').innerHTML = this.formatWarningsList(warnings.behavioral);
                }
                
                // Safety Guidelines
                if (warnings.safety) {
                    document.getElementById('safetyGuidelines').innerHTML = this.formatWarningsList(warnings.safety, 'shield-check');
                }
            }
            
            if (researchData.success && researchData.section) {
                const research = researchData.section;
                
                document.getElementById('researchInfo').innerHTML = `
                    <div class="row">
                        <div class="col-md-6">
                            <h6><i class="bi bi-book"></i> Research Techniques</h6>
                            ${research.techniques ? `
                                <ul class="list-unstyled">
                                    ${research.techniques.map(technique => 
                                        `<li class="mb-2"><i class="bi bi-arrow-right text-primary"></i> ${technique}</li>`
                                    ).join('')}
                                </ul>
                            ` : '<p class="text-muted">No research techniques available</p>'}
                        </div>
                        <div class="col-md-6">
                            <h6><i class="bi bi-graph-up"></i> Effectiveness Factors</h6>
                            ${research.effectiveness ? `
                                <ul class="list-unstyled">
                                    ${research.effectiveness.map(factor => 
                                        `<li class="mb-2"><i class="bi bi-arrow-right text-primary"></i> ${factor}</li>`
                                    ).join('')}
                                </ul>
                            ` : '<p class="text-muted">No effectiveness factors available</p>'}
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading safety section:', error);
        }
    }

    formatWarningsList(warnings, icon = 'exclamation-triangle') {
        return warnings.map(warning => 
            `<div class="warning-item mb-2">
                <i class="bi bi-${icon} text-warning"></i> ${warning}
            </div>`
        ).join('');
    }

    async searchKnowledgeBase() {
        const query = document.getElementById('searchInput').value.trim();
        const section = document.getElementById('sectionFilter').value;
        
        if (!query) {
            document.getElementById('searchResults').style.display = 'none';
            return;
        }
        
        try {
            const params = new URLSearchParams({ query });
            if (section) params.append('section', section);
            
            const response = await fetch(`${this.API_BASE}/knowledge-base/search?${params}`);
            const data = await response.json();
            
            if (data.success) {
                this.displaySearchResults(data.results, query);
            } else {
                this.displaySearchError(data.error);
            }
        } catch (error) {
            console.error('Search error:', error);
            this.displaySearchError('Search failed');
        }
    }

    displaySearchResults(results, query) {
        const searchResultsDiv = document.getElementById('searchResults');
        
        if (results.length === 0) {
            searchResultsDiv.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> No results found for "${query}"
                </div>
            `;
            searchResultsDiv.style.display = 'block';
            return;
        }
        
        const highlightedResults = results.map(result => {
            const highlightedValue = this.highlightSearchTerm(result.value, query);
            return `
                <div class="card mb-2">
                    <div class="card-body">
                        <h6 class="card-title">
                            <span class="badge bg-secondary">${result.path.join(' > ')}</span>
                        </h6>
                        <p class="card-text">${highlightedValue}</p>
                        <small class="text-muted">Relevance: ${(result.relevance * 100).toFixed(1)}%</small>
                    </div>
                </div>
            `;
        }).join('');
        
        searchResultsDiv.innerHTML = `
            <h6><i class="bi bi-search"></i> Search Results (${results.length})</h6>
            ${highlightedResults}
        `;
        searchResultsDiv.style.display = 'block';
    }

    displaySearchError(error) {
        const searchResultsDiv = document.getElementById('searchResults');
        searchResultsDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> ${error}
            </div>
        `;
        searchResultsDiv.style.display = 'block';
    }

    highlightSearchTerm(text, term) {
        const regex = new RegExp(`(${term})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }

    async loadAnalytics() {
        try {
            const response = await fetch(`${this.API_BASE}/knowledge-base/analytics`);
            const data = await response.json();
            
            if (data.success) {
                this.displayAnalytics(data.analytics);
            } else {
                this.displayFallbackAnalytics();
            }
        } catch (error) {
            console.error('Error loading analytics:', error);
            this.displayFallbackAnalytics();
        }
    }

    displayAnalytics(analytics) {
        document.getElementById('analyticsDisplay').innerHTML = `
            <div class="row text-center">
                <div class="col-6">
                    <h4 class="text-primary">${analytics.queriesProcessed || 0}</h4>
                    <small>Queries Processed</small>
                </div>
                <div class="col-6">
                    <h4 class="text-success">${analytics.knowledgeBaseSize?.totalSections || 0}</h4>
                    <small>Total Sections</small>
                </div>
            </div>
            <div class="row text-center mt-3">
                <div class="col-4">
                    <h6 class="text-info">${analytics.knowledgeBaseSize?.triggerCount || 0}</h6>
                    <small>Triggers</small>
                </div>
                <div class="col-4">
                    <h6 class="text-warning">${analytics.knowledgeBaseSize?.siteCount || 0}</h6>
                    <small>Sites</small>
                </div>
                <div class="col-4">
                    <h6 class="text-danger">${analytics.knowledgeBaseSize?.fileCount || 0}</h6>
                    <small>Files</small>
                </div>
            </div>
            ${analytics.lastUpdated ? `
                <div class="mt-3 text-center">
                    <small class="text-muted">
                        Last Updated: ${new Date(analytics.lastUpdated).toLocaleDateString()}
                    </small>
                </div>
            ` : ''}
        `;
    }

    displayFallbackAnalytics() {
        document.getElementById('analyticsDisplay').innerHTML = `
            <div class="text-center">
                <h4 class="text-primary">Ready</h4>
                <small>Knowledge Base Loaded</small>
            </div>
        `;
    }

    onTabChange(targetId) {
        // Update analytics when users switch tabs
        this.analytics.queriesProcessed++;
        const section = targetId.replace('#', '').replace('-tab', '');
        
        if (!this.analytics.popularTopics[section]) {
            this.analytics.popularTopics[section] = 0;
        }
        this.analytics.popularTopics[section]++;
    }

    async performExport() {
        const format = document.getElementById('exportFormat').value;
        const sections = Array.from(document.getElementById('exportSections').selectedOptions)
                            .map(option => option.value);
        
        try {
            const params = new URLSearchParams({ format });
            if (!sections.includes('all')) {
                sections.forEach(section => params.append('sections', section));
            }
            
            const response = await fetch(`${this.API_BASE}/knowledge-base/export?${params}`);
            
            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = `bambisleep-knowledge-base.${format === 'json' ? 'json' : 'txt'}`;
                link.click();
                
                URL.revokeObjectURL(url);
                
                // Close modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('exportModal'));
                modal.hide();
            } else {
                alert('Export failed');
            }
        } catch (error) {
            console.error('Export error:', error);
            alert('Export failed');
        }
    }
}

// Global functions for HTML event handlers
function searchKnowledgeBase() {
    if (window.kbUI) {
        window.kbUI.searchKnowledgeBase();
    }
}

function performExport() {
    if (window.kbUI) {
        window.kbUI.performExport();
    }
}

function showExportModal() {
    const modal = new bootstrap.Modal(document.getElementById('exportModal'));
    modal.show();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.kbUI = new KnowledgeBaseUI();
    window.kbUI.init();
});

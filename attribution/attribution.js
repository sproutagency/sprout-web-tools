class AttributionTracker {
    constructor(options = {}) {
        console.log('AttributionTracker initialized with new code');
        
        // Configuration with defaults
        this.config = {
            storageKey: 'attribution_touches',
            sessionDuration: 30 * 60 * 1000, // 30 minutes
            attributionWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
            ...options
        };
  
        this.paidMediums = [
            'cpc',           // Google Ads
            'paid_search',   // Paid search general
            'paid_social',   // Paid social media
            'display',       // Display advertising
            'ppc',          // Legacy term, keep for compatibility
            'email',         // Email marketing
            'affiliate',     // Affiliate marketing
            'referral',      // Paid referral
            'retargeting'    // Retargeting/remarketing
        ];
        this.organicMediums = [
            'organic',         // Organic search
            'organic_social',  // Organic social media
            'referral',       // Organic referral
            'email',          // Organic email
            'direct',         // Direct traffic
            'none'            // When no medium is specified
        ];
        
        this.searchEngines = {
            'google': {
                domains: ['google.', 'google.com'],
                searchParams: ['q', 'query'],
                patterns: [/^www\.google\./]
            },
            'bing': {
                domains: ['bing.', 'bing.com'],
                searchParams: ['q', 'query'],
                patterns: [/^www\.bing\./]
            },
            'duckduckgo': {
                domains: ['duckduckgo.', 'duckduckgo.com'],
                searchParams: ['q'],
                patterns: [/^duckduckgo\./]
            }
        };
        
        this.socialNetworks = {
            'facebook': {
                domains: ['facebook.', 'fb.com', 'm.facebook.com'],
                appIds: ['fb_app_id']
            },
            'instagram': {
                domains: ['instagram.', 'ig.com'],
                appIds: ['ig_app_id']
            },
            'youtube': {
                domains: ['youtube.', 'youtu.be'],
                patterns: [/^www\.youtube\./]
            },
            'yelp': {
                domains: ['yelp.'],
                businessId: ['biz_id']
            },
            'nextdoor': {
                domains: ['nextdoor.'],
                patterns: [/^nextdoor\./]
            },
            'twitter': {
                domains: ['twitter.', 'x.com', 't.co'],
                patterns: [/^twitter\./, /^x\.com/]
            },
            'linkedin': {
                domains: ['linkedin.'],
                trackingCodes: ['li_fat_id']
            },
            'spotify': {
                domains: ['spotify.'],
                patterns: [/^open\.spotify\./]
            },
            'pinterest': {
                domains: ['pinterest.'],
                patterns: [/^pin\./]
            },
            'tiktok': {
                domains: ['tiktok.', 'tiktok.com'],
                patterns: [/^vm\.tiktok\./, /^www\.tiktok\./]
            }
        };
  
        this.aiPlatforms = {
            'searchgpt': {
                domains: ['search.openai.com', 'chatgpt.com'],
                patterns: [/openai\./, /chatgpt\./]
            },
            'perplexity': {
                domains: ['perplexity'],
                patterns: [/perplexity\./]
            },
            'gemini': {
                domains: ['gemini.google.com'],
                patterns: [/gemini\.google\./]
            }
        };
  
        // Initialize storage
        this.initializeStorage();
  
        // Initialize page tracking
        this.currentSessionPages = [];
        this.initializePageTracking();
    }
    initializeStorage() {
        try {
            if (typeof localStorage !== 'undefined') {
                this.storage = localStorage;
            } else {
                console.warn('localStorage not available, falling back to memory storage');
                this.storage = new Map();
            }
        } catch (e) {
            console.warn('Error initializing storage:', e);
            this.storage = new Map();
        }
    }
  
    initializePageTracking() {
        // Track initial page
        this.addPageToSession(window.location.pathname);
  
        // Track SPA navigation
        window.addEventListener('popstate', () => {
            this.addPageToSession(window.location.pathname);
        });
  
        // Monitor pushState more safely
        const originalPushState = window.history.pushState;
        window.history.pushState = function() {
            const result = originalPushState.apply(this, arguments);
            window.dispatchEvent(new Event('pushstate'));
            return result;
        };
  
        // Listen for pushstate events
        window.addEventListener('pushstate', () => {
            this.addPageToSession(window.location.pathname);
        });
    }
  
    addPageToSession(pathname) {
        this.currentSessionPages.push(pathname);
        // Update session data
        const sessionData = this.getSessionData();
        sessionData.pagesViewed = this.currentSessionPages;
    }
  
    getJourneyStory() {
        const currentTouch = this.createCurrentTouch();
        const paths = this.currentSessionPages
            .filter(Boolean)
            .filter((path, index, array) => array.indexOf(path) === index);
  
        return `Pages viewed in converting session (${currentTouch.source}/${currentTouch.medium}): ${paths.join(' > ')}`;
    }
  
    getAttributionData() {
        try {
            const currentTouch = this.createCurrentTouch();
            const storedTouches = this.getStoredTouches();
            const updatedTouches = this.updateTouchPoints(storedTouches, currentTouch);
            
            this.storeTouches(updatedTouches);
  
            return {
                firstTouch: {
                    source: updatedTouches[0].source,
                    medium: updatedTouches[0].medium,
                    landingPage: updatedTouches[0].landingPage,
                    referrer: updatedTouches[0].referrer,
                    timestamp: updatedTouches[0].timestamp
                },
                lastTouch: {
                    source: updatedTouches[updatedTouches.length - 1].source,
                    medium: updatedTouches[updatedTouches.length - 1].medium,
                    utmParameters: updatedTouches[updatedTouches.length - 1].utmParameters,
                    timestamp: updatedTouches[updatedTouches.length - 1].timestamp
                },
                touchCount: updatedTouches.length,
                sessionId: this.generateSessionId()
            };
        } catch (error) {
            console.error('Error getting attribution data:', error);
            return this.createEmptyAttribution();
        }
    }
    createCurrentTouch() {
        const urlParams = new URLSearchParams(window.location.search);
        const referrer = document.referrer;
        const utmParams = this.extractUtmParameters(urlParams);
        const searchTerm = this.extractSearchTerm(referrer);
  
        return {
            source: this.determineSource(utmParams.source, referrer),
            medium: this.determineMedium(utmParams.medium),
            timestamp: new Date().toISOString(),
            referrer: referrer,
            landingPage: window.location.pathname,
            utmParameters: {
                ...utmParams,
                term: utmParams.term || searchTerm || ''
            }
        };
    }
  
    getStoredTouches() {
        try {
            const stored = this.storage instanceof Map 
                ? this.storage.get(this.config.storageKey)
                : this.storage.getItem(this.config.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Error retrieving stored touches:', e);
            return [];
        }
    }
  
    updateTouchPoints(storedTouches, currentTouch) {
        if (storedTouches.length === 0) {
            return [currentTouch];
        }
  
        if (this.isSignificantNewTouch(storedTouches[storedTouches.length - 1], currentTouch)) {
            return [...storedTouches, currentTouch];
        }
  
        return storedTouches;
    }
  
    storeTouches(touches) {
        try {
            if (this.storage instanceof Map) {
                this.storage.set(this.config.storageKey, JSON.stringify(touches));
            } else {
                this.storage.setItem(this.config.storageKey, JSON.stringify(touches));
            }
        } catch (e) {
            console.error('Error storing touches:', e);
        }
    }
  
    isSignificantNewTouch(lastTouch, currentTouch) {
        return lastTouch.source !== currentTouch.source || 
               lastTouch.medium !== currentTouch.medium;
    }
  
    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }
    getSessionData() {
        return {
            id: this.generateSessionId(),
            startTime: new Date().toISOString(),
            pagesViewed: this.currentSessionPages,  // Now using tracked pages
            lastActivity: new Date().toISOString()
        };
    }
  
    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9);
    }
  
    extractUtmParameters(urlParams) {
        const utmFields = ['source', 'medium', 'campaign', 'term', 'content'];
        const params = {};
        
        utmFields.forEach(field => {
            const value = urlParams.get(`utm_${field}`)?.toLowerCase();
            params[field] = value || null;
        });
        
        return params;
    }
  
    extractCustomParameters(urlParams) {
        const customParams = {};
        for (const [key, value] of urlParams.entries()) {
            if (!key.startsWith('utm_')) {
                customParams[key] = value;
            }
        }
        return customParams;
    }
  
    analyzeCampaignData(utmParams) {
        return {
            campaign: {
                value: utmParams.campaign || null,
                isSet: !!utmParams.campaign,
                type: this.determineCampaignType(utmParams.campaign)
            },
            searchTerms: {
                value: utmParams.term || null,
                isSet: !!utmParams.term,
                keywords: utmParams.term ? utmParams.term.split(/[\s+_]/) : []
            },
            contentVariation: {
                value: utmParams.content || null,
                isSet: !!utmParams.content,
                testingInfo: this.parseContentTesting(utmParams.content)
            }
        };
    }
  
    determineSource(utmSource, referrer) {
        if (utmSource) {
            return utmSource;
        }
        
        if (referrer) {
            try {
                const referrerUrl = new URL(referrer);
                const referrerDomain = referrerUrl.hostname.toLowerCase();
                
                // Check through all platform types
                for (const [platform, config] of Object.entries(this.aiPlatforms)) {
                    if (config.domains.some(domain => referrerDomain.includes(domain)) ||
                        config.patterns.some(pattern => pattern.test(referrerDomain))) {
                        return platform;
                    }
                }
                for (const [engine, config] of Object.entries(this.searchEngines)) {
                    if (config.domains.some(domain => referrerDomain.includes(domain)) ||
                        config.patterns.some(pattern => pattern.test(referrerDomain))) {
                        return engine;
                    }
                }
                
                for (const [network, config] of Object.entries(this.socialNetworks)) {
                    if (config.domains.some(domain => referrerDomain.includes(domain)) ||
                        (config.patterns && config.patterns.some(pattern => pattern.test(referrerDomain)))) {
                        return network;
                    }
                }
                
                return referrerDomain;
            } catch (e) {
                console.error('Error parsing referrer:', e);
                return 'invalid_referrer';
            }
        }
        
        return 'direct';
    }
  
    determineMedium(utmMedium) {
        if (!utmMedium) {
            return 'none';
        }
        
        const medium = utmMedium.toLowerCase();
        
        // Check for exact matches first
        if (this.paidMediums.includes(medium)) {
            return medium;
        }
        
        if (this.organicMediums.includes(medium)) {
            return medium;
        }
        
        // If no exact match, check for partial matches
        if (this.paidMediums.some(paid => medium.includes(paid))) {
            return medium;
        }
        
        // Default to 'referral' if it's not matching any known patterns
        return 'referral';
    }
  
    determineCampaignType(campaign) {
        if (!campaign) return 'unknown';
        
        if (campaign.includes('email')) return 'email_campaign';
        if (campaign.includes('social')) return 'social_campaign';
        if (campaign.includes('search')) return 'search_campaign';
        if (campaign.includes('display')) return 'display_campaign';
        if (campaign.includes('retarget')) return 'retargeting_campaign';
        
        return 'other_campaign';
    }
  
    parseContentTesting(content) {
        if (!content) return null;
        
        return {
            isABTest: content.includes('test') || content.includes('variant'),
            variant: content,
            category: this.determineContentCategory(content)
        };
    }
    determineContentCategory(content) {
        if (!content) return 'unknown';
        
        if (content.includes('button')) return 'cta_button';
        if (content.includes('image')) return 'image';
        if (content.includes('video')) return 'video';
        if (content.includes('copy')) return 'text';
        
        return 'other';
    }
  
    createEmptyAttribution() {
        return {
            firstTouch: {
                source: 'direct',
                medium: 'organic',
                landingPage: '',
                referrer: '',
                timestamp: new Date().toISOString()
            },
            lastTouch: {
                source: 'direct',
                medium: 'organic',
                utmParameters: {},
                timestamp: new Date().toISOString()
            },
            touchCount: 0,
            sessionId: this.generateSessionId()
        };
    }
  
    extractSearchTerm(referrer) {
        console.log('extractSearchTerm called with:', referrer);
        if (!referrer) return null;
        
        try {
            const referrerUrl = new URL(referrer);
            const referrerDomain = referrerUrl.hostname.toLowerCase();
            
            // Check each search engine
            for (const [engine, config] of Object.entries(this.searchEngines)) {
                if (config.domains.some(domain => referrerDomain.includes(domain)) ||
                    config.patterns.some(pattern => pattern.test(referrerDomain))) {
                    // Try each possible search parameter
                    for (const param of config.searchParams) {
                        const term = referrerUrl.searchParams.get(param);
                        if (term) return decodeURIComponent(term.toLowerCase());
                    }
                }
            }
            return null;
        } catch (e) {
            console.error('Error extracting search term:', e);
            return null;
        }
    }
}
  
// Initialize global tracker instance
window.globalAttributionTracker = new AttributionTracker({
    storageKey: 'site_attribution',
    sessionDuration: 30 * 60 * 1000,
    attributionWindow: 30 * 24 * 60 * 60 * 1000
});
  
// Track attribution on every page
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Update attribution data
        const attributionData = window.globalAttributionTracker.getAttributionData();
        console.log('Attribution Data Updated:', attributionData);
    } catch (error) {
        console.error('Error updating attribution:', error);
    }
});
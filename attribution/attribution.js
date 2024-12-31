class AttributionTracker {
    constructor(options = {}) {
        // Default configuration
        this.config = {
            storageKey: 'attribution_touches',
            sessionDuration: 30 * 60 * 1000, // 30 minutes
            attributionWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
            ...options
        };

        // Dependency injection for testing
        this.window = options.window || window;
        this.document = options.document || document;
        this.navigator = options.navigator || navigator;

        // Enable testing mode if specified
        this.testing = options.testing || false;
        if (this.testing) {
            // Shorten durations for testing purposes
            this.config.sessionDuration = 1000; // 1 second
            this.config.attributionWindow = 5000; // 5 seconds
        }

        // Core channel definitions
        this.paidMediums = ['cpc', 'ppc', 'paid', 'display', 'cpm'];
        this.organicMediums = ['organic', 'social', 'referral', 'email'];
        
        // Core referrer sources
        this.referrerSources = {
            'google': {
                domains: ['google.'],
                patterns: [/^www\.google\./]
            },
            'facebook': {
                domains: ['facebook.', 'fb.com'],
                patterns: [/^facebook\./]
            },
            'instagram': {
                domains: ['instagram.'],
                patterns: [/^instagram\./]
            }
            // Add other referrer sources as needed
        };

        // Initialize storage and session
        this.initializeStorage();
        this.currentSessionPages = [];
        this.initializePageTracking();

        // For testing, store the latest attribution data
        this.latestAttributionData = null;
    }

    initializeStorage() {
        try {
            if (typeof localStorage !== 'undefined' && !this.testing) {
                this.storage = localStorage;
            } else {
                // Use in-memory storage for testing or if localStorage is not available
                this.storage = new Map();
            }
        } catch (e) {
            console.warn('Storage initialization failed:', e);
            this.storage = new Map();
        }
    }

    initializePageTracking() {
        // Track initial page
        this.addPageToSession(this.window.location.pathname);

        // Track SPA navigation
        if (this.window.addEventListener) {
            this.window.addEventListener('popstate', () => {
                this.addPageToSession(this.window.location.pathname);
            });
        }

        // Monitor pushState changes
        const originalPushState = this.window.history.pushState;
        const self = this;
        this.window.history.pushState = function (...args) {
            if (originalPushState) {
                originalPushState.apply(this, args);
                self.addPageToSession(self.window.location.pathname);
            }
        };
    }

    addPageToSession(pathname) {
        this.currentSessionPages.push(pathname);
    }

    getAttributionData() {
        try {
            const currentTouch = this.createCurrentTouch();
            const storedTouches = this.getStoredTouches();
            const updatedTouches = this.updateTouchPoints(storedTouches, currentTouch);

            this.storeTouches(updatedTouches);

            const attributionData = {
                firstTouch: updatedTouches[0],
                lastTouch: updatedTouches[updatedTouches.length - 1],
                allTouches: updatedTouches,
                touchCount: updatedTouches.length,
                deviceInfo: this.getDeviceInfo(),
                sessionData: this.getSessionData(),
                journeyStory: this.getJourneyStory()
            };

            // Store attribution data for testing purposes
            this.latestAttributionData = attributionData;

            return attributionData;
        } catch (error) {
            console.error('Error getting attribution data:', error);
            return this.createEmptyAttribution();
        }
    }

    createCurrentTouch() {
        const urlParams = new URLSearchParams(this.window.location.search);
        const referrer = this.document.referrer;
        const utmParams = this.extractUtmParameters(urlParams);

        const source = this.determineSource(utmParams.source, referrer);
        const medium = this.determineMedium(utmParams.medium, referrer);

        return {
            source,
            medium,
            timestamp: new Date().toISOString(),
            referrer,
            landingPage: this.window.location.pathname,
            utmParameters: utmParams,
            sessionId: this.generateSessionId()
        };
    }

    extractUtmParameters(urlParams) {
        const utmFields = ['source', 'medium', 'campaign', 'term', 'content'];
        const params = {};

        utmFields.forEach(field => {
            const value = urlParams.get(`utm_${field}`)?.toLowerCase() || null;
            params[field] = value;
        });

        return params;
    }

    determineSource(utmSource, referrer) {
        if (utmSource) return utmSource;

        if (referrer) {
            try {
                const referrerUrl = new URL(referrer);
                const referrerDomain = referrerUrl.hostname.toLowerCase();

                for (const [source, config] of Object.entries(this.referrerSources)) {
                    const domainMatch = config.domains.some(domain => referrerDomain.includes(domain));
                    const patternMatch = config.patterns.some(pattern => pattern.test(referrerDomain));

                    if (domainMatch || patternMatch) {
                        return source;
                    }
                }

                return referrerDomain;
            } catch (e) {
                return 'unknown';
            }
        }

        return 'direct';
    }

    determineMedium(utmMedium, referrer) {
        if (utmMedium) return utmMedium;

        if (!referrer) return 'direct';

        try {
            const referrerUrl = new URL(referrer);
            const referrerDomain = referrerUrl.hostname.toLowerCase();

            if (referrerDomain.includes('google')) return 'organic_search';
            if (referrerDomain.includes('facebook') || referrerDomain.includes('instagram')) return 'social';
            return 'referral';
        } catch (e) {
            return 'unknown';
        }
    }

    getStoredTouches() {
        try {
            const stored = this.storage instanceof Map
                ? this.storage.get(this.config.storageKey)
                : this.storage.getItem(this.config.storageKey);

            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    }

    storeTouches(touches) {
        try {
            const data = JSON.stringify(touches);
            if (this.storage instanceof Map) {
                this.storage.set(this.config.storageKey, data);
            } else {
                this.storage.setItem(this.config.storageKey, data);
            }
        } catch (e) {
            console.error('Error storing touches:', e);
        }
    }

    updateTouchPoints(storedTouches, currentTouch) {
        if (storedTouches.length === 0) return [currentTouch];

        const lastTouch = storedTouches[storedTouches.length - 1];

        if (this.isSignificantNewTouch(lastTouch, currentTouch)) {
            return [...storedTouches, currentTouch];
        }

        return storedTouches;
    }

    isSignificantNewTouch(lastTouch, currentTouch) {
        const channelChanged =
            lastTouch.source !== currentTouch.source ||
            lastTouch.medium !== currentTouch.medium;

        const isPaidChannel = this.paidMediums.includes(currentTouch.medium);

        const timeDiff = new Date(currentTouch.timestamp) - new Date(lastTouch.timestamp);
        const significantTimePassed = timeDiff > this.config.sessionDuration;

        return channelChanged || isPaidChannel || significantTimePassed;
    }

    getDeviceInfo() {
        return {
            userAgent: this.navigator.userAgent,
            language: this.navigator.language,
            platform: this.navigator.platform,
            screenResolution: `${this.window.screen.width}x${this.window.screen.height}`,
            viewportSize: `${this.window.innerWidth}x${this.window.innerHeight}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }

    getSessionData() {
        return {
            id: this.generateSessionId(),
            startTime: new Date().toISOString(),
            pagesViewed: this.currentSessionPages,
            lastActivity: new Date().toISOString()
        };
    }

    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9);
    }

    getJourneyStory() {
        const currentTouch = this.createCurrentTouch();
        const paths = this.currentSessionPages
            .filter(Boolean)
            .filter((path, index, array) => array.indexOf(path) === index);

        return `Pages viewed in session (${currentTouch.source}/${currentTouch.medium}): ${paths.join(' > ')}`;
    }

    createEmptyAttribution() {
        return {
            firstTouch: null,
            lastTouch: null,
            allTouches: [],
            touchCount: 0,
            deviceInfo: this.getDeviceInfo(),
            sessionData: this.getSessionData(),
            journeyStory: ''
        };
    }

    // Method to clear storage (useful for testing)
    clearStorage() {
        if (this.storage instanceof Map) {
            this.storage.clear();
        } else {
            this.storage.clear();
        }
    }
}

// Initialize global tracker instance
window.globalAttributionTracker = new AttributionTracker({
    storageKey: 'site_attribution',
    sessionDuration: 30 * 60 * 1000,
    attributionWindow: 30 * 24 * 60 * 60 * 1000
});

// Track attribution on page load
document.addEventListener('DOMContentLoaded', function() {
    try {
        const attributionData = window.globalAttributionTracker.getAttributionData();
        console.log('Attribution Data:', attributionData);
    } catch (error) {
        console.error('Attribution Error:', error);
    }
});

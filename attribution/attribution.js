/**
 * Core Marketing Attribution Script v1.0.4
 * Tracks first and last touch attribution data
 */

class MarketingAttribution {
    constructor(mockData) {
        this.STORAGE_KEY = 'attribution_data';
        this.SESSION_KEY = 'attribution_session';
        this.VISITOR_KEY = 'visitor_data';
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
        this.MAX_PAGEVIEWS = 50; // Limit stored pageviews
        this.MAX_SESSION_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
        this._mockData = mockData; // For testing purposes
        this.ATTRIBUTION_WINDOW = {
            PAID_SEARCH: 30 * 24 * 60 * 60 * 1000,    // 30 days for paid search
            PAID_SOCIAL: 28 * 24 * 60 * 60 * 1000,    // 28 days for paid social
            ORGANIC_SOCIAL: 7 * 24 * 60 * 60 * 1000,  // 7 days for organic social
            ORGANIC_SEARCH: 7 * 24 * 60 * 60 * 1000,  // 7 days for organic search
            EMAIL: 7 * 24 * 60 * 60 * 1000,           // 7 days for email
            REFERRAL: 1 * 24 * 60 * 60 * 1000         // 1 day for referral
        };
        this.CHANNEL_PRIORITY = {
            'paid_search': 1,    // Highest priority
            'cpc': 1,
            'lsa': 1,
            'paid_social': 2,
            'display': 3,
            'email': 4,
            'organic_social': 5,
            'social': 5,
            'organic': 6,
            'referral': 7,
            '(none)': 8         // Lowest priority
        };

        // Standardized mediums for consistency
        this.STANDARD_MEDIUMS = {
            'cpc': 'cpc',
            'ppc': 'cpc',
            'paid': 'cpc',
            'paid_social': 'paid_social',
            'paid-social': 'paid_social',
            'paidsocial': 'paid_social',
            'social': 'social',
            'social-media': 'social',
            'socialmedia': 'social',
            'organic': 'organic',
            'search': 'organic',
            'email': 'email',
            'mail': 'email',
            'newsletter': 'email',
            'referral': 'referral',
            'display': 'display',
            'banner': 'display',
            'none': '(none)'
        };

        // Standardized sources for consistency
        this.STANDARD_SOURCES = {
            'google': 'google',
            'googleads': 'google',
            'google-ads': 'google',
            'facebook': 'facebook',
            'fb': 'facebook',
            'instagram': 'instagram',
            'ig': 'instagram',
            'linkedin': 'linkedin',
            'twitter': 'twitter',
            'x': 'twitter',
            'tiktok': 'tiktok',
            'bing': 'bing',
            'microsoft': 'bing',
            'yahoo': 'yahoo',
            'direct': '(direct)'
        };

        this._storageAvailable = null;

        // Initialize with storage check
        if (!this.isStorageAvailable()) {
            console.warn('localStorage is not available. Attribution tracking will be limited.');
            this._storageAvailable = false;
        } else {
            this._storageAvailable = true;
            this.cleanupOldData();
        }

        this.initializeTracking();
        this.initializeSession();
    }

    sanitizeAttributionValue(value, standardValues) {
        if (!value) return null;
        const cleaned = value.toLowerCase().trim();
        return standardValues[cleaned] || cleaned;
    }

    initializeTracking() {
        console.log('Initializing tracking...');
        const currentTouch = this.createTouch();
        console.log('Current touch data:', currentTouch);
        const storedData = this.getStoredData() || {}; 
        console.log('Previously stored attribution data:', storedData);

        // Set first touch if it doesn't exist
        if (!storedData.firstTouch) {
            console.log('Setting first touch attribution...');
            storedData.firstTouch = currentTouch;
        }

        // Update last touch if:
        // 1. It's a new session AND
        // 2. The current touch has equal or higher priority
        const isNewSession = this.initializeSession();
        if (isNewSession && this.shouldUpdateLastTouch(currentTouch, storedData.lastTouch)) {
            console.log('Updating last touch attribution...');
            storedData.lastTouch = currentTouch;
        }

        this.storeData(storedData);
        console.log('Final stored attribution data:', this.getStoredData());
    }

    initializeSession() {
        console.log('Initializing session...');
        const isNew = this.isNewSession();
        let sessionData = this.getSessionData();
        console.log('Current session data:', sessionData);
        
        if (!sessionData.pageViews || isNew) {
            sessionData = {
                startTime: new Date().toISOString(),
                pageViews: [{
                    path: window.location.pathname,
                    timestamp: new Date().toISOString()
                }]
            };
        } else {
            // Check if this is a refresh (same path as last view)
            const lastPageView = sessionData.pageViews[sessionData.pageViews.length - 1];
            const isRefresh = lastPageView && lastPageView.path === window.location.pathname;
            
            if (!isRefresh) {
                // Only add to session if it's a new page, not a refresh
                sessionData.pageViews.push({
                    path: window.location.pathname,
                    timestamp: new Date().toISOString()
                });
            }
        }
        this.safeSetItem(this.SESSION_KEY, sessionData);

        // Update visitor data
        let visitorData = this.getVisitorData();
        if (!visitorData.firstSeen) {
            visitorData = {
                firstSeen: new Date().toISOString(),
                visitCount: 1,
                touchCount: 1
            };
        } else if (isNew) {
            // Only increment counts on new sessions
            visitorData.visitCount++;
            visitorData.touchCount++;
        }
        this.safeSetItem(this.VISITOR_KEY, visitorData);
        
        return isNew;
    }

    isNewSession() {
        const sessionData = this.getSessionData();
        if (!sessionData.startTime) return true;
        
        const lastTime = new Date(sessionData.startTime).getTime();
        const currentTime = new Date().getTime();
        
        return currentTime - lastTime > this.SESSION_TIMEOUT;
    }

    shouldUpdateLastTouch(currentTouch, lastTouch) {
        if (!lastTouch) return true;

        // Always update last touch for direct visits
        if (currentTouch.source === '(direct)' && currentTouch.medium === '(none)') {
            return true;
        }

        // For all other cases, use the priority system
        const currentPriority = this.CHANNEL_PRIORITY[currentTouch.medium] || this.CHANNEL_PRIORITY['(none)'];
        const lastPriority = this.CHANNEL_PRIORITY[lastTouch.medium] || this.CHANNEL_PRIORITY['(none)'];
        
        return currentPriority <= lastPriority;
    }

    getAttributionWindow(medium) {
        if (medium === 'cpc' || medium === 'paid_search' || medium === 'lsa') {
            return this.ATTRIBUTION_WINDOW.PAID_SEARCH;
        }
        if (medium === 'paid_social' || medium === 'display') {
            return this.ATTRIBUTION_WINDOW.PAID_SOCIAL;
        }
        if (medium === 'social' || medium === 'organic_social') {
            return this.ATTRIBUTION_WINDOW.ORGANIC_SOCIAL;
        }
        if (medium === 'organic') {
            return this.ATTRIBUTION_WINDOW.ORGANIC_SEARCH;
        }
        if (medium === 'email') {
            return this.ATTRIBUTION_WINDOW.EMAIL;
        }
        if (medium === 'referral') {
            return this.ATTRIBUTION_WINDOW.REFERRAL;
        }
        return this.ATTRIBUTION_WINDOW.REFERRAL; // Default to shortest window
    }

    getDeviceType() {
        const ua = navigator.userAgent;
        const mobile = /Mobile|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua);
        const tablet = /Tablet|iPad/i.test(ua);
        
        // More accurate device detection
        if (tablet || (mobile && window.innerWidth >= 768)) {
            return 'tablet';
        }
        if (mobile) {
            return 'mobile';
        }
        return 'desktop';
    }

    createTouch() {
        // Use mock data for testing if available
        const currentUrl = this._mockData?.currentUrl || new URL(window.location.href);
        const referrer = this._mockData?.referrer || document.referrer;
        
        // Get UTM parameters from mock data or current URL
        const currentParams = this._mockData?.urlParams || new URLSearchParams(window.location.search);

        // Get UTM parameters
        const utmParams = this.validateUtmParams(currentParams);

        // Get click IDs
        const clickIds = {
            gclid: currentParams.get('gclid'),
            fbclid: currentParams.get('fbclid'),
            msclkid: currentParams.get('msclkid'),
            dclid: currentParams.get('dclid')
        };

        // Get the landing page path without query parameters
        const landingPath = currentUrl.pathname;

        // Determine source and medium
        let attribution = this.determineAttribution(referrer, utmParams, clickIds, currentUrl);

        // For direct visits (no referrer and no campaign parameters),
        // we should explicitly set it as direct/(none)
        const hasNoReferrer = !referrer || referrer.includes(window.location.hostname);
        const hasNoCampaign = !utmParams.source && !Object.values(clickIds).some(id => id);
        const hasNoBusinessProfile = !currentParams.get('pbid');

        if ((hasNoReferrer || referrer === '') && hasNoCampaign && hasNoBusinessProfile) {
            attribution = {
                source: '(direct)',
                medium: '(none)'
            };
        }

        // Create the touch
        const touch = {
            timestamp: new Date().toISOString(),
            source: attribution.source,
            medium: attribution.medium,
            campaign: utmParams.campaign || null,
            content: utmParams.content || null,
            term: utmParams.term || null,
            landing_page: landingPath,
            referrer: referrer || '(direct)',
            click_id: Object.entries(clickIds).find(([_, value]) => value)?.[0] || null,
            device_type: this.getDeviceType()
        };

        return touch;
    }

    determineAttribution(referrer, utmParams, clickIds, currentUrl) {
        let source = null;
        let medium = null;

        // 1. Campaign Parameters (Highest Priority)
        if (utmParams.source || utmParams.medium) {
            source = this.sanitizeAttributionValue(utmParams.source, this.STANDARD_SOURCES);
            medium = this.sanitizeAttributionValue(utmParams.medium, this.STANDARD_MEDIUMS);
        }

        // 2. Click IDs - Paid Traffic
        if (!source && !medium) {
            if (clickIds.gclid) {
                source = 'google';
                medium = 'cpc';
            } else if (clickIds.fbclid) {
                source = 'facebook';
                medium = 'paid_social';
            } else if (clickIds.msclkid) {
                source = 'bing';
                medium = 'cpc';
            }
        }

        // If we still don't have attribution, process referrer
        if (!source && !medium && referrer) {
            try {
                const referrerUrl = new URL(referrer);
                const referrerDomain = referrerUrl.hostname.replace('www.', '');

                if (referrerDomain.includes('google')) {
                    source = 'google';
                    medium = 'organic';
                } else if (referrerDomain.includes('bing')) {
                    source = 'bing';
                    medium = 'organic';
                } else if (referrerDomain.includes('facebook')) {
                    source = 'facebook';
                    medium = 'social';
                } else {
                    source = referrerDomain;
                    medium = 'referral';
                }
            } catch (e) {
                console.warn('Error processing referrer:', e);
            }
        }

        return {
            source: source || '(direct)',
            medium: medium || '(none)'
        };
    }

    getStoredData() {
        return this.safeGetItem(this.STORAGE_KEY) || {};
    }

    storeData(data) {
        this.safeSetItem(this.STORAGE_KEY, data);
    }

    getSessionData() {
        return this.safeGetItem(this.SESSION_KEY) || {};
    }

    getVisitorData() {
        return this.safeGetItem(this.VISITOR_KEY) || {};
    }

    getAttributionData() {
        const data = this.getStoredData() || {};
        const sessionData = this.getSessionData() || {};
        const visitorData = this.getVisitorData() || {};
        
        return {
            firstTouch: data.firstTouch || null,
            lastTouch: data.lastTouch || null,
            sessionData: sessionData || {},
            touchCount: visitorData.touchCount || 0,
            visitCount: visitorData.visitCount || 0,
            firstSeen: visitorData.firstSeen || null
        };
    }

    calculateDaysSinceFirstTouch(firstTouchTime) {
        const currentTime = new Date().getTime();
        const firstTime = new Date(firstTouchTime).getTime();
        return Math.max(0, Math.floor((currentTime - firstTime) / (1000 * 60 * 60 * 24)));
    }

    getFilloutParameters() {
        const data = this.getAttributionData();
        const sessionData = this.getSessionData();
        const visitorData = this.getVisitorData();
        const params = {};

        // Current page (conversion page)
        params.conversion_page = window.location.pathname;

        // Session journey
        params.session_pages = sessionData.pageViews
            ? sessionData.pageViews.map(pv => pv.path).join(' → ')
            : '';
        
        // Time calculations
        params.days_to_convert = this.calculateDaysSinceFirstTouch(data.firstTouch?.timestamp);

        // Visitor metrics
        params.visitor_type = params.days_to_convert === 0 ? 'new' : 'returning';
        params.total_touches = visitorData.touchCount || 1;
        params.visit_count = visitorData.visitCount || 1;
        
        // Session metrics
        params.pages_in_session = sessionData.pageViews ? sessionData.pageViews.length : 1;

        // Device types
        params.conversion_device = this.getDeviceType(); // Device at form submission
        params.first_device = data.firstTouch?.device_type || this.getDeviceType(); // Device at first visit
        params.device_switch = params.first_device !== params.conversion_device ? 'yes' : 'no'; // Did they switch devices?
        
        // First touch parameters
        if (data.firstTouch) {
            params.ft_source = data.firstTouch.source;
            params.ft_medium = data.firstTouch.medium;
            params.ft_campaign = data.firstTouch.campaign;
            params.ft_content = data.firstTouch.content;
            params.ft_term = data.firstTouch.term;
            params.ft_landing = data.firstTouch.landing_page;
            params.ft_timestamp = data.firstTouch.timestamp;
            params.ft_referrer = data.firstTouch.referrer;
        }

        // Last touch parameters (at conversion)
        if (data.lastTouch) {
            params.lt_source = data.lastTouch.source;
            params.lt_medium = data.lastTouch.medium;
            params.lt_campaign = data.lastTouch.campaign;
            params.lt_content = data.lastTouch.content;
            params.lt_term = data.lastTouch.term;
            params.lt_landing = data.lastTouch.landing_page;
            params.lt_timestamp = data.lastTouch.timestamp;
            params.lt_referrer = data.lastTouch.referrer;
        }

        return params;
    }

    getFilloutQueryString() {
        const params = this.getFilloutParameters();
        return Object.entries(params)
            .filter(([_, value]) => value !== null && value !== undefined)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
    }

    isStorageAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    cleanupOldData() {
        try {
            // Clean up old sessions
            const sessionData = this.getSessionData() || {};
            if (sessionData?.startTime) {
                const sessionAge = Date.now() - new Date(sessionData.startTime).getTime();
                if (sessionAge > this.MAX_SESSION_AGE) {
                    localStorage.removeItem(this.SESSION_KEY);
                }
            }

            // Limit pageviews
            if (sessionData?.pageViews && sessionData.pageViews.length > this.MAX_PAGEVIEWS) {
                sessionData.pageViews = sessionData.pageViews.slice(-this.MAX_PAGEVIEWS);
                this.safeSetItem(this.SESSION_KEY, sessionData);
            }
        } catch (e) {
            console.warn('Error cleaning up old data:', e);
        }
    }

    safeSetItem(key, value) {
        if (!this._storageAvailable) return false;
        
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            // If storage is full, try to clear some space
            if (e.name === 'QuotaExceededError') {
                this.cleanupOldData();
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (e2) {
                    console.warn('Storage full, could not save data:', e2);
                }
            }
            return false;
        }
    }

    safeGetItem(key) {
        if (!this._storageAvailable) return {};
        
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : {};  
        } catch (e) {
            console.warn('Error reading from storage:', e);
            return {};  
        }
    }

    validateUtmParams(params) {
        const cleanParams = {};
        const maxLength = 150; // Maximum allowed length for UTM parameters
        
        ['source', 'medium', 'campaign', 'content', 'term'].forEach(param => {
            let value = params.get(`utm_${param}`);
            if (value) {
                // Clean and validate the parameter
                value = value.trim().toLowerCase();
                if (value.length > maxLength) {
                    value = value.substring(0, maxLength);
                }
                // Remove any potentially harmful characters
                value = value.replace(/[<>(){}[\]\\]/g, '');
                cleanParams[param] = value;
            }
        });
        
        return cleanParams;
    }
}

// Initialize global instance
window.globalAttributionTracker = new MarketingAttribution();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarketingAttribution;
}
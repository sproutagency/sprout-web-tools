/**
 * Core Marketing Attribution Script v1.0.4
 * Tracks first and last touch attribution data
 */

class MarketingAttribution {
    constructor(mockData, options = {}) {
        this.STORAGE_KEY = 'attribution_data';
        this.SESSION_KEY = 'attribution_session';
        this.VISITOR_KEY = 'visitor_data';
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
        this.MAX_PAGEVIEWS = 50;
        this.MAX_SESSION_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
        this.MAX_ATTRIBUTION_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year
        this._mockData = mockData;
        this.debug = options.debug || false;

        // Pre-compile regexes for better performance
        this._REGEX = {
            mobile: /Mobile|Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i,
            tablet: /Tablet|iPad/i,
            cleanDomain: /^(mail|email|blog|shop|store|support|help|docs|developer|dev|api|cdn|static)\./i,
            cloudDomain: /\.(cdn|amazonaws|cloudfront|herokuapp)\.[^.]+$/
        };

        // Cache frequently accessed values
        this._cache = {
            deviceType: null,
            hostname: window.location.hostname,
            supportsURLAPI: typeof URL === 'function',
            searchEnginePatterns: this._compileSearchPatterns(),
            domainMaps: this._compileDomainMaps(),
            lastCleanup: Date.now(),
            lastStorageCheck: Date.now(),
            lastStorageRead: Date.now(),
            lastSessionRead: Date.now(),
            storageData: null,
            sessionData: null,
            visitorData: null,
            currentPageview: null,
            storageModified: false,
            sessionModified: false
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

        // Add more standardized sources
        this.STANDARD_SOURCES = {
            // Search Engines
            'google': 'google',
            'bing': 'bing',
            'yahoo': 'yahoo',
            'duckduckgo': 'duckduckgo',
            'yandex': 'yandex',
            'baidu': 'baidu',

            // Social Networks
            'facebook': 'facebook',
            'instagram': 'instagram',
            'linkedin': 'linkedin',
            'twitter': 'twitter',
            'x.com': 'twitter',
            't.co': 'twitter',
            'tiktok': 'tiktok',
            'pinterest': 'pinterest',
            'youtube': 'youtube',
            'reddit': 'reddit',

            // Email Providers
            'gmail': 'email',
            'outlook': 'email',
            'yahoo.mail': 'email',
            'mail.google': 'email',
            'mail.yahoo': 'email',

            // Direct
            'direct': '(direct)',
            '(direct)': '(direct)'
        };

        // Add path-based medium detection
        this.PATH_MEDIUM_MAPPING = {
            facebook: {
                '/groups/': 'group',
                '/marketplace/': 'marketplace',
                '/events/': 'event',
                '/business/': 'business'
            },
            linkedin: {
                '/company/': 'company',
                '/jobs/': 'jobs',
                '/learning/': 'learning',
                '/groups/': 'group'
            },
            twitter: {
                '/lists/': 'list',
                '/hashtag/': 'hashtag'
            },
            youtube: {
                '/playlist': 'playlist',
                '/channel/': 'channel',
                '/shorts/': 'shorts'
            }
        };

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

        this.PERFORMANCE = {
            CLEANUP_INTERVAL: 5 * 60 * 1000, // Run cleanup every 5 minutes
            STORAGE_CHECK_INTERVAL: 60 * 1000, // Check storage availability every minute
            CACHE_TTL: 30 * 1000, // Cache TTL for storage data (30 seconds)
            MAX_BATCH_SIZE: 10, // Maximum number of touches to process at once
            MAX_CACHE_ITEMS: 1000,
            MAX_CACHE_SIZE: 1024 * 1024 // 1MB
        };

        this._storageAvailable = this.isStorageAvailable();
        if (!this._storageAvailable) {
            this.log('warn', 'localStorage is not available. Attribution tracking will be limited.');
        } else {
            this.cleanupOldData();
        }

        this.initializeTracking();
        this.initializeSession();

        // Schedule periodic cache cleanup
        if (typeof window !== 'undefined') {
            this._cleanupInterval = setInterval(() => this._cleanupCache(), this.PERFORMANCE.CLEANUP_INTERVAL);
        }
    }

    destroy() {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
        }
        this._cache = null;
    }

    _cleanupCache() {
        try {
            const cacheSize = JSON.stringify(this._cache).length;
            if (cacheSize > this.PERFORMANCE.MAX_CACHE_SIZE) {
                // Reset non-critical cache items
                this._cache.storageData = null;
                this._cache.sessionData = null;
                this._cache.currentPageview = null;
                this._cache.storageModified = true;
                this._cache.sessionModified = true;
            }
        } catch (e) {
            this.log('warn', 'Error during cache cleanup:', e);
        }
    }

    _compileSearchPatterns() {
        // Pre-compute search engine patterns
        const patterns = {};
        const searchEngines = {
            'google': ['google.', 'google.co'],
            'bing': ['bing.'],
            'yahoo': ['search.yahoo.'],
            'duckduckgo': ['duckduckgo.'],
            'yandex': ['yandex.'],
            'baidu': ['baidu.']
        };

        for (const [engine, domains] of Object.entries(searchEngines)) {
            patterns[engine] = new RegExp(domains.map(d => d.replace('.', '\\.')).join('|'));
        }
        return patterns;
    }

    _compileDomainMaps() {
        // Pre-compute domain maps for faster lookups
        return {
            social: new Map(Object.entries({
                'facebook.com': 'facebook',
                'instagram.com': 'instagram',
                'linkedin.com': 'linkedin',
                'twitter.com': 'twitter',
                'x.com': 'twitter',
                't.co': 'twitter',
                'tiktok.com': 'tiktok',
                'pinterest.com': 'pinterest',
                'youtube.com': 'youtube',
                'reddit.com': 'reddit'
            })),
            email: new Set([
                'mail.google.com',
                'outlook.com',
                'outlook.live.com',
                'outlook.office365.com',
                'mail.yahoo.com',
                'mail.proton.me'
            ]),
            news: new Map(Object.entries({
                'medium.com': 'medium',
                'news.google.com': 'google_news',
                'flipboard.com': 'flipboard',
                'feedly.com': 'feedly'
            }))
        };
    }

    log(level, ...args) {
        if (this.debug || level === 'error' || level === 'warn') {
            console[level](...args);
        }
    }

    createUrl(url) {
        if (!url) return this._createUrlFromLocation();
        
        if (this._cache.supportsURLAPI) {
            try {
                return url instanceof URL ? url : new URL(url);
            } catch (e) {
                this.log('warn', 'Invalid URL:', url);
                return this._createUrlFromLocation();
            }
        }
        
        return this._createUrlFromAnchor(url);
    }

    _createUrlFromLocation() {
        try {
            return {
                pathname: window.location.pathname || '/',
                hostname: this._cache.hostname || window.location.hostname,
                search: window.location.search || '',
                protocol: window.location.protocol
            };
        } catch (e) {
            this.log('warn', 'Error creating URL from location:', e);
            return {
                pathname: '/',
                hostname: this._cache.hostname || '',
                search: '',
                protocol: 'https:'
            };
        }
    }

    _createUrlFromAnchor(url) {
        try {
            const a = document.createElement('a');
            a.href = url || window.location.href;
            return {
                pathname: a.pathname.replace(/^([^/])/, '/$1'),
                hostname: a.hostname,
                search: a.search,
                protocol: a.protocol
            };
        } catch (e) {
            this.log('warn', 'Error creating URL from anchor:', e);
            return this._createUrlFromLocation();
        }
    }

    getDeviceType() {
        if (this._cache.deviceType) return this._cache.deviceType;

        const ua = navigator.userAgent;
        const mobile = this._REGEX.mobile.test(ua);
        const tablet = this._REGEX.tablet.test(ua);
        
        let result;
        if (tablet || (mobile && window.innerWidth >= 768)) {
            result = 'tablet';
        } else if (mobile) {
            result = 'mobile';
        } else {
            result = 'desktop';
        }

        this._cache.deviceType = result;
        return result;
    }

    sanitizeAttributionValue(value, standardValues) {
        if (!value) return null;
        const cleaned = value.toLowerCase().trim();
        return standardValues[cleaned] || cleaned;
    }

    initializeTracking() {
        const currentTouch = this.createTouch();
        const storedData = this.getStoredData() || {}; 

        // Set first touch if it doesn't exist
        if (!storedData.firstTouch) {
            storedData.firstTouch = currentTouch;
        }

        // Update last touch if needed
        const isNewSession = this.initializeSession();
        if (isNewSession && this.shouldUpdateLastTouch(currentTouch, storedData.lastTouch)) {
            storedData.lastTouch = currentTouch;
        }

        this.storeData(storedData);
    }

    initializeSession() {
        const isNew = this.isNewSession();
        let sessionData = this.safeGetItem(this.SESSION_KEY);
        let visitorData = this.safeGetItem(this.VISITOR_KEY);
        
        // Initialize visitor data first
        if (!visitorData.firstSeen) {
            visitorData = {
                firstSeen: new Date().toISOString(),
                visitCount: 1,
                touchCount: 1
            };
        } else if (isNew) {
            visitorData.visitCount++;
            visitorData.touchCount++;
        }
        this.safeSetItem(this.VISITOR_KEY, visitorData);
        
        // Then handle session data
        if (!sessionData.pageViews || isNew) {
            sessionData = {
                startTime: new Date().toISOString(),
                pageViews: [{
                    path: window.location.pathname,
                    timestamp: new Date().toISOString()
                }]
            };
        } else {
            const lastPageView = sessionData.pageViews[sessionData.pageViews.length - 1];
            const isRefresh = lastPageView && lastPageView.path === window.location.pathname;
            
            if (!isRefresh) {
                sessionData.pageViews.push({
                    path: window.location.pathname,
                    timestamp: new Date().toISOString()
                });
            }
        }
        this.safeSetItem(this.SESSION_KEY, sessionData);
        
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

    determineAttribution(referrer, utmParams, clickIds, currentUrl) {
        // Check UTM parameters first (highest priority)
        if (this.hasUtmParameters(utmParams)) {
            return this.getUtmAttribution(utmParams);
        }

        // Check for paid traffic click IDs
        if (this.hasClickIds(clickIds)) {
            return this.getClickIdAttribution(clickIds);
        }

        // Check referrer
        if (this.hasReferrer(referrer)) {
            return this.getReferrerAttribution(referrer);
        }

        // Default to direct
        return this.getDirectAttribution();
    }

    hasUtmParameters(utmParams) {
        return utmParams.source || utmParams.medium;
    }

    hasClickIds(clickIds) {
        return Object.values(clickIds).some(id => id);
    }

    hasReferrer(referrer) {
        return referrer && !referrer.includes(this._cache.hostname);
    }

    getUtmAttribution(utmParams) {
        return {
            source: this.sanitizeAttributionValue(utmParams.source, this.STANDARD_SOURCES),
            medium: this.sanitizeAttributionValue(utmParams.medium, this.STANDARD_MEDIUMS)
        };
    }

    getClickIdAttribution(clickIds) {
        if (clickIds.gclid) return { source: 'google', medium: 'cpc' };
        if (clickIds.fbclid) return { source: 'facebook', medium: 'paid_social' };
        if (clickIds.msclkid) return { source: 'bing', medium: 'cpc' };
        if (clickIds.dclid) return { source: 'google', medium: 'display' };
        return this.getDirectAttribution();
    }

    getReferrerAttribution(referrer) {
        try {
            const referrerUrl = this.createUrl(referrer);
            const referrerDomain = referrerUrl.hostname.replace('www.', '');
            const path = referrerUrl.pathname;

            // 1. Search Engines - Using pre-compiled patterns
            for (const [engine, pattern] of Object.entries(this._cache.searchEnginePatterns)) {
                if (pattern.test(referrerDomain)) {
                    // Special case for Google Maps
                    if (engine === 'google' && path.startsWith('/maps')) {
                        return { source: 'google', medium: 'maps' };
                    }
                    return { source: engine, medium: 'organic' };
                }
            }

            // 2. Social Networks - Using Map for O(1) lookup
            const socialSource = this._cache.domainMaps.social.get(referrerDomain);
            if (socialSource) {
                const pathMappings = this.PATH_MEDIUM_MAPPING[socialSource];
                if (pathMappings) {
                    // Use Object.entries once and cache
                    const entries = Object.entries(pathMappings);
                    for (const [pathPrefix, medium] of entries) {
                        if (path.includes(pathPrefix)) {
                            return { source: socialSource, medium };
                        }
                    }
                }
                return { source: socialSource, medium: 'social' };
            }

            // 3. Email Providers - Using Set for O(1) lookup
            if (this._cache.domainMaps.email.has(referrerDomain)) {
                return { source: 'email', medium: 'email' };
            }

            // 4. News Sites - Using Map for O(1) lookup
            const newsSource = this._cache.domainMaps.news.get(referrerDomain);
            if (newsSource) {
                return { source: newsSource, medium: 'news' };
            }

            // 5. Default to referral - Using pre-compiled regex
            const cleanDomain = referrerDomain
                .replace(this._REGEX.cleanDomain, '')
                .replace(this._REGEX.cloudDomain, '');

            return { 
                source: this.sanitizeAttributionValue(cleanDomain, this.STANDARD_SOURCES) || cleanDomain,
                medium: 'referral'
            };

        } catch (e) {
            this.log('warn', 'Error processing referrer:', e);
            return this.getDirectAttribution();
        }
    }

    getDirectAttribution() {
        return { source: '(direct)', medium: '(none)' };
    }

    createTouch() {
        // Get current URL and params
        const currentUrl = this._mockData?.currentUrl || new URL(window.location.href);
        const urlParams = this._mockData?.urlParams || new URLSearchParams(window.location.search);
        const referrer = this._mockData?.referrer || document.referrer;
        const landingPath = currentUrl.pathname;

        // Extract UTM parameters
        const utmParams = {
            source: urlParams.get('utm_source'),
            medium: urlParams.get('utm_medium'),
            campaign: urlParams.get('utm_campaign'),
            content: urlParams.get('utm_content'),
            term: urlParams.get('utm_term')
        };

        // Extract click IDs
        const clickIds = {
            gclid: urlParams.get('gclid'),
            fbclid: urlParams.get('fbclid'),
            msclkid: urlParams.get('msclkid'),
            dclid: urlParams.get('dclid')
        };

        // Find the first non-null click ID value
        const clickId = Object.entries(clickIds).find(([_, value]) => value)?.[1] || null;

        // Determine attribution
        const { source, medium } = this.determineAttribution(referrer, utmParams, clickIds, currentUrl);

        // Create the touch
        const touch = {
            timestamp: new Date().toISOString(),
            source: source,
            medium: medium,
            campaign: utmParams.campaign || null,
            content: utmParams.content || null,
            term: utmParams.term || null,
            landing_page: landingPath,
            referrer: referrer || '(direct)',
            click_id: clickId,
            device_type: this.getDeviceType()
        };

        // Update first and last touch points
        const data = this.getStoredData();
        
        if (!data.first_touch) {
            data.first_touch = touch;
        }
        data.last_touch = touch;

        // Store the updated data
        this.safeSetItem(this.STORAGE_KEY, data);

        // Update session data
        this.updateSession(touch);

        return touch;
    }

    getStoredData() {
        const now = Date.now();
        if (this._cache.storageData && 
            (now - this._cache.lastStorageRead < this.PERFORMANCE.CACHE_TTL) &&
            !this._cache.storageModified) {
            return this._cache.storageData;
        }
        
        const data = this.safeGetItem(this.STORAGE_KEY) || {};
        this._cache.storageData = data;
        this._cache.lastStorageRead = now;
        this._cache.storageModified = false;
        return data;
    }

    getSessionData() {
        const now = Date.now();
        if (this._cache.sessionData && 
            (now - this._cache.lastSessionRead < this.PERFORMANCE.CACHE_TTL) &&
            !this._cache.sessionModified) {
            return this._cache.sessionData;
        }

        const data = this.safeGetItem(this.SESSION_KEY) || {};
        this._cache.sessionData = data;
        this._cache.lastSessionRead = now;
        this._cache.sessionModified = false;
        return data;
    }

    getVisitorData() {
        const data = this.safeGetItem(this.VISITOR_KEY);
        if (!data.firstSeen) {
            data.firstSeen = new Date().toISOString();
        }
        if (!data.visitCount) {
            data.visitCount = 1;
        }
        if (!data.touchCount) {
            data.touchCount = 1;
        } else {
            data.touchCount++;
        }
        this.safeSetItem(this.VISITOR_KEY, data);
        return data;
    }

    safeGetItem(key) {
        if (!this._storageAvailable) return {};
        
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : {};  
        } catch (e) {
            this.log('warn', 'Error reading from storage:', e);
            return {};  
        }
    }

    safeSetItem(key, value) {
        if (!this._storageAvailable) return false;
        
        try {
            const serialized = Array.isArray(value) ? 
                JSON.stringify(value) : 
                this._fastSerialize(value);

            if (serialized.length > 5242880) {
                this.log('warn', 'Data too large for localStorage');
                return false;
            }

            localStorage.setItem(key, serialized);
            
            // Mark cache as modified
            if (key === this.STORAGE_KEY) this._cache.storageModified = true;
            if (key === this.SESSION_KEY) this._cache.sessionModified = true;
            
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                this._cleanupCache();
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (e2) {
                    this.log('warn', 'Storage full, could not save data');
                }
            }
            return false;
        }
    }

    _fastSerialize(obj) {
        try {
            if (!obj || typeof obj !== 'object') {
                return JSON.stringify(obj);
            }

            const pairs = [];
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key) && 
                    obj[key] !== undefined && 
                    obj[key] !== null) {
                    const value = typeof obj[key] === 'object' ? 
                        JSON.stringify(obj[key]) : 
                        this._serializeValue(obj[key]);
                    pairs.push(`"${key}":${value}`);
                }
            }
            return `{${pairs.join(',')}}`;
        } catch (e) {
            this.log('warn', 'Fast serialization failed, falling back to JSON.stringify:', e);
            return JSON.stringify(obj);
        }
    }

    _serializeValue(value) {
        switch (typeof value) {
            case 'string': return `"${value.replace(/"/g, '\\"')}"`;
            case 'number':
            case 'boolean': return String(value);
            default: return JSON.stringify(value);
        }
    }

    getAttributionData() {
        const data = this.getStoredData() || {};
        const sessionData = this.getSessionData() || {};
        const visitorData = this.getVisitorData() || {};
        
        return {
            first_touch: {
                source: data.first_touch?.source || '(direct)',
                medium: data.first_touch?.medium || '(none)',
                campaign: data.first_touch?.campaign || null,
                landing_page: data.first_touch?.landing_page || null,
                timestamp: data.first_touch?.timestamp || null,
                device: data.first_touch?.device_type || null,
                click_id: data.first_touch?.click_id || null
            },
            last_touch: {
                source: data.last_touch?.source || '(direct)',
                medium: data.last_touch?.medium || '(none)',
                campaign: data.last_touch?.campaign || null,
                landing_page: data.last_touch?.landing_page || null,
                timestamp: data.last_touch?.timestamp || null,
                device: data.last_touch?.device_type || null,
                click_id: data.last_touch?.click_id || null
            },
            session: {
                pages: sessionData.pageViews || [],
                start_time: sessionData.startTime || null
            },
            visitor: {
                first_seen: visitorData.firstSeen || null,
                visits: visitorData.visitCount || 1,
                touches: visitorData.touchCount || 1,
                days_since_first: this.calculateDaysSinceFirstTouch(data.first_touch?.timestamp) || 0
            }
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
        params.days_to_convert = this.calculateDaysSinceFirstTouch(data.first_touch?.timestamp);

        // Visitor metrics
        params.visitor_type = params.days_to_convert === 0 ? 'new' : 'returning';
        params.total_touches = visitorData.touchCount || 1;
        params.visit_count = visitorData.visitCount || 1;
        
        // Session metrics
        params.pages_in_session = sessionData.pageViews ? sessionData.pageViews.length : 1;

        // Device types
        params.conversion_device = this.getDeviceType(); // Device at form submission
        params.first_device = data.first_touch?.device_type || this.getDeviceType(); // Device at first visit
        params.device_switch = params.first_device !== params.conversion_device ? 'yes' : 'no'; // Did they switch devices?
        
        // First touch parameters
        if (data.first_touch) {
            params.ft_source = data.first_touch.source;
            params.ft_medium = data.first_touch.medium;
            params.ft_campaign = data.first_touch.campaign;
            params.ft_content = data.first_touch.content;
            params.ft_term = data.first_touch.term;
            params.ft_landing = data.first_touch.landing_page;
            params.ft_timestamp = data.first_touch.timestamp;
            params.ft_referrer = data.first_touch.referrer;
        }

        // Last touch parameters (at conversion)
        if (data.last_touch) {
            params.lt_source = data.last_touch.source;
            params.lt_medium = data.last_touch.medium;
            params.lt_campaign = data.last_touch.campaign;
            params.lt_content = data.last_touch.content;
            params.lt_term = data.last_touch.term;
            params.lt_landing = data.last_touch.landing_page;
            params.lt_timestamp = data.last_touch.timestamp;
            params.lt_referrer = data.last_touch.referrer;
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
            const sessionData = this.getSessionData();
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

            // Clean up very old attribution data
            const data = this.getStoredData();
            if (data?.first_touch?.timestamp) {
                const age = Date.now() - new Date(data.first_touch.timestamp).getTime();
                if (age > this.MAX_ATTRIBUTION_AGE) {
                    localStorage.removeItem(this.STORAGE_KEY);
                }
            }
        } catch (e) {
            if (!(e instanceof TypeError)) {
                this.log('warn', 'Error cleaning up old data:', e);
            }
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

    updateSession(touch) {
        const sessionData = this.getSessionData();
        if (!sessionData.pageViews) {
            sessionData.pageViews = [];
        }
        sessionData.pageViews.push({
            path: window.location.pathname,
            timestamp: touch.timestamp
        });
        this.safeSetItem(this.SESSION_KEY, sessionData);
    }
}

// Initialize global instance
window.globalAttributionTracker = new MarketingAttribution();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarketingAttribution;
}
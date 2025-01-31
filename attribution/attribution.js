/**
 * Marketing Attribution Tracker
 * Core website attribution tracking for form submissions
 */
class MarketingTracker {
    constructor() {
        this.STORAGE_KEY = 'marketing_data';
        this.SESSION_LANDING_KEY = 'session_landing_page';
        this.SESSION_REFERRER_KEY = 'session_referrer';
        this.BACKUP_REFERRER_KEY = 'original_referrer';
        this.DEBUG = true; // Set to true to enable debug logging
        this.MAX_VALUE_LENGTH = 500; // Maximum length for stored values
        this.initializeTracking();
    }

    STANDARD_MEDIUMS = {
        'cpc': 'cpc',
        'ppc': 'cpc',
        'paid': 'cpc',
        'paid_social': 'paid_social',
        'social': 'social',
        'organic': 'organic',
        'email': 'email',
        'referral': 'referral',
        'none': '(none)'
    };

    STANDARD_SOURCES = {
        'google': 'google',
        'bing': 'bing',
        'yahoo': 'yahoo',
        'duckduckgo': 'duckduckgo',
        'facebook': 'facebook',
        'instagram': 'instagram',
        'linkedin': 'linkedin',
        'x': 'x',
        'youtube': 'youtube',
        'tiktok': 'tiktok',
        'direct': '(direct)'
    };

    SEARCH_ENGINE_DOMAINS = [
        'google', 'bing', 'yahoo', 'duckduckgo', 'yandex',
        'baidu', 'yandex', 'naver', 'ask', 'duckduckgo',
        'ecosia', 'qwant', 'startpage'
    ];

    SOCIAL_DOMAINS = [
        'facebook', 'instagram', 'linkedin', 'twitter',
        'x.com', 'youtube', 'youtu.be', 'tiktok', 'pinterest',
        'reddit', 'tumblr', 'medium'
    ];

    INTERNATIONAL_TLDS = [
        'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'co',
        'me', 'uk', 'de', 'fr', 'es', 'it', 'nl', 'ru', 'cn', 'jp',
        'br', 'au', 'in', 'mx', 'ca', 'ch', 'at', 'be', 'dk', 'pl',
        'no', 'se', 'fi', 'cz', 'pt', 'nz', 'kr', 'tw', 'sg', 'ae'
    ];

    initializeTracking() {
        const storedData = this.getStoredData();
        const params = new URLSearchParams(window.location.search);
        
        // Store landing page if first page in session
        if (!sessionStorage.getItem(this.SESSION_LANDING_KEY)) {
            sessionStorage.setItem(this.SESSION_LANDING_KEY, window.location.pathname);
        }

        const currentReferrer = document.referrer;
        if (!sessionStorage.getItem(this.SESSION_REFERRER_KEY) || 
            (currentReferrer && !this.isInternalReferrer(currentReferrer))) {
            sessionStorage.setItem(this.SESSION_REFERRER_KEY, currentReferrer);
            localStorage.setItem(this.BACKUP_REFERRER_KEY, currentReferrer);
        } else if (!sessionStorage.getItem(this.SESSION_REFERRER_KEY) && localStorage.getItem(this.BACKUP_REFERRER_KEY)) {
            sessionStorage.setItem(this.SESSION_REFERRER_KEY, localStorage.getItem(this.BACKUP_REFERRER_KEY));
        }

        // Always create new tracking data for last touch attribution
        const currentData = this.createTrackingData();
        
        // Only update if we have meaningful attribution data
        const hasUtmParams = Array.from(params.keys()).some(key => key.startsWith('utm_') || key === 'gclid');
        const hasExternalReferrer = currentReferrer && !this.isInternalReferrer(currentReferrer);

        if (hasUtmParams || hasExternalReferrer) {
            this.debugLog('Updating attribution data due to:', {
                hasUtmParams,
                hasExternalReferrer,
                currentReferrer
            });

            storedData.lastInteraction = {
                ...currentData,
                landing_page: sessionStorage.getItem(this.SESSION_LANDING_KEY),
                referrer: sessionStorage.getItem(this.SESSION_REFERRER_KEY) || '(direct)'
            };
        } else if (!storedData.lastInteraction) {
            // Initialize with current data if no previous data exists
            this.debugLog('Initializing first attribution data');
            storedData.lastInteraction = {
                ...currentData,
                landing_page: sessionStorage.getItem(this.SESSION_LANDING_KEY),
                referrer: sessionStorage.getItem(this.SESSION_REFERRER_KEY) || '(direct)'
            };
        } else {
            this.debugLog('No new attribution data to update');
        }

        // Always increment visit count
        storedData.visitCount = (storedData.visitCount || 0) + 1;
        
        this.storeData(storedData);
        this.debugLog('Tracking initialized', storedData);
    }

    debugLog(message, data = null) {
        if (this.DEBUG) {
            console.log(`[Marketing Tracker] ${message}`, data || '');
        }
    }

    isInternalReferrer(referrer) {
        try {
            const referrerUrl = new URL(referrer);
            const currentUrl = new URL(window.location.href);
            return referrerUrl.hostname === currentUrl.hostname;
        } catch (e) {
            return false;
        }
    }

    parseReferrer(referrer) {
        try {
            if (!referrer) return null;
            const referrerUrl = new URL(referrer);
            return {
                url: referrerUrl,
                hostname: referrerUrl.hostname.replace('www.', ''),
                params: new URLSearchParams(referrerUrl.search)
            };
        } catch (e) {
            console.error('Error parsing referrer:', e);
            return null;
        }
    }

    createTrackingData() {
        const params = new URLSearchParams(window.location.search);
        this.debugLog('URL Parameters:', Object.fromEntries(params));
        
        const referrer = sessionStorage.getItem(this.SESSION_REFERRER_KEY) || 
                        localStorage.getItem(this.BACKUP_REFERRER_KEY) || 
                        document.referrer;
        const parsedReferrer = this.parseReferrer(referrer);
        
        // Get campaign value directly, only clean it for safety
        let campaign = params.get('utm_campaign');
        if (campaign) {
            campaign = campaign.substring(0, this.MAX_VALUE_LENGTH).replace(/[^\w\s-_.]/g, '');
        }
        
        // Check for LSA traffic
        if (parsedReferrer && !campaign && parsedReferrer.hostname.includes('localservices')) {
            campaign = 'lsa';
            this.debugLog('Campaign set to LSA from localservices hostname');
        }

        // Check for GMB traffic
        if (!campaign && 
            this.sanitizeValue(params.get('utm_source'), {}) === 'google' && 
            this.sanitizeValue(params.get('utm_medium'), {}) === 'organic') {
            campaign = 'gmb';
            this.debugLog('Campaign set to GMB from google/organic params');
        }
        
        // Get gclid and clean it
        let gclid = params.get('gclid');
        if (gclid) {
            gclid = gclid.substring(0, this.MAX_VALUE_LENGTH).replace(/[^\w-]/g, '');
            this.debugLog('Found gclid:', gclid);
        }
        
        const data = {
            timestamp: new Date().toISOString(),
            source: this.determineSource(params, referrer),
            medium: this.determineMedium(params, referrer),
            campaign: campaign || '',
            term: this.sanitizeValue(params.get('utm_term'), {}),
            landing_page: sessionStorage.getItem(this.SESSION_LANDING_KEY) || window.location.pathname,
            referrer: referrer || '(direct)',
            gclid: gclid || '',
            device: this.getDeviceType()
        };

        this.debugLog('Created tracking data:', data);
        return data;
    }

    determineSource(params, referrer) {
        this.debugLog('Determining source', { params, referrer });

        // Priority 1: UTM Source from URL
        if (params.get('utm_source')) {
            const source = this.sanitizeValue(params.get('utm_source'), this.STANDARD_SOURCES);
            this.debugLog('Source from UTM parameter', source);
            return source;
        }

        // Priority 2: Google Ads, LSA, or GMB
        if (params.get('gclid') || 
            params.get('utm_campaign')?.toLowerCase() === 'lsa' || 
            params.get('utm_campaign')?.toLowerCase() === 'gmb') {
            this.debugLog('Source from Google Ads/LSA/GMB');
            return 'google';
        }

        const parsedReferrer = this.parseReferrer(referrer);
        if (!parsedReferrer) return '(direct)';

        // Priority 3: UTM Source from referrer
        if (parsedReferrer.params.get('utm_source')) {
            return this.sanitizeValue(parsedReferrer.params.get('utm_source'), this.STANDARD_SOURCES);
        }

        // Priority 4: Special cases (LSA, GMB)
        if (parsedReferrer.hostname.includes('localservices')) {
            return 'google';
        }

        // Priority 5: Search Engines
        const matchedEngine = this.SEARCH_ENGINE_DOMAINS.find(engine => 
            parsedReferrer.hostname.includes(engine));
        if (matchedEngine) {
            return this.sanitizeValue(matchedEngine, this.STANDARD_SOURCES);
        }

        // Priority 6: Social Media
        const matchedSocial = this.SOCIAL_DOMAINS.find(platform => 
            parsedReferrer.hostname.includes(platform));
        if (matchedSocial) {
            const socialName = matchedSocial === 'youtu.be' ? 'youtube' : 
                             matchedSocial === 'x.com' ? 'x' : matchedSocial;
            return this.sanitizeValue(socialName, this.STANDARD_SOURCES);
        }

        // Priority 7: Clean domain name
        const tldPattern = new RegExp(`\\.(${this.INTERNATIONAL_TLDS.join('|')})$`, 'i');
        return parsedReferrer.hostname.replace(tldPattern, '');
    }

    determineMedium(params, referrer) {
        this.debugLog('Determining medium', { params, referrer });

        // Priority 1: UTM Medium from URL
        if (params.get('utm_medium')) {
            const medium = this.sanitizeValue(params.get('utm_medium'), this.STANDARD_MEDIUMS);
            this.debugLog('Medium from UTM parameter', medium);
            return medium;
        }

        // Priority 2: Paid Traffic Indicators
        if (params.get('gclid') || params.get('utm_campaign')?.toLowerCase() === 'lsa') {
            return 'cpc';
        }

        // Priority 3: GMB Traffic
        if (params.get('utm_campaign')?.toLowerCase() === 'gmb') {
            return 'organic';
        }

        const parsedReferrer = this.parseReferrer(referrer);
        if (!parsedReferrer) return '(none)';

        // Priority 4: UTM Medium from referrer
        if (parsedReferrer.params.get('utm_medium')) {
            return this.sanitizeValue(parsedReferrer.params.get('utm_medium'), this.STANDARD_MEDIUMS);
        }

        // Priority 5: Special cases (LSA)
        if (parsedReferrer.hostname.includes('localservices')) {
            return 'cpc';
        }

        // Priority 6: Search Engines (Organic)
        if (this.SEARCH_ENGINE_DOMAINS.some(engine => parsedReferrer.hostname.includes(engine))) {
            return 'organic';
        }

        // Priority 7: Social Media
        if (this.SOCIAL_DOMAINS.some(platform => parsedReferrer.hostname.includes(platform))) {
            return 'social';
        }

        return 'referral';
    }

    sanitizeValue(value, standardMap) {
        if (!value) return null;
        
        // Trim and limit length
        let cleaned = value.toLowerCase().trim();
        if (cleaned.length > this.MAX_VALUE_LENGTH) {
            this.debugLog(`Value exceeded maximum length: ${value}`);
            cleaned = cleaned.substring(0, this.MAX_VALUE_LENGTH);
        }

        // Remove potentially harmful characters
        cleaned = cleaned.replace(/[^\w\s-_.]/g, '');
        
        return standardMap[cleaned] || cleaned;
    }

    getDeviceType() {
        const ua = navigator.userAgent.toLowerCase();
        if (/(android|webos|iphone|ipad|ipod|blackberry|windows phone)/.test(ua)) {
            return 'mobile';
        }
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/.test(ua)) {
            return 'tablet';
        }
        return 'desktop';
    }

    getStoredData() {
        try {
            const storedData = localStorage.getItem(this.STORAGE_KEY);
            return storedData ? JSON.parse(storedData) : {};
        } catch (error) {
            this.debugLog('Error reading stored data:', error);
            return {};
        }
    }

    storeData(data) {
        this.debugLog('Storing data:', data);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }

    getFormAttributes() {
        const data = this.getStoredData();
        this.debugLog('Getting stored data for form attributes:', data);

        // Ensure we have data
        if (!data || !data.lastInteraction) {
            this.debugLog('No stored data found, creating new tracking data');
            const currentData = this.createTrackingData();
            data.lastInteraction = currentData;
            this.storeData(data);
        }

        const attributes = {
            source: data.lastInteraction?.source || '(direct)',
            medium: data.lastInteraction?.medium || '(none)',
            campaign: data.lastInteraction?.campaign || '',
            term: data.lastInteraction?.term || '',
            landing_page: data.lastInteraction?.landing_page || window.location.pathname,
            conversion_page: window.location.pathname,
            referrer: data.lastInteraction?.referrer || '(direct)',
            gclid: data.lastInteraction?.gclid || '',
            device: data.lastInteraction?.device || this.getDeviceType(),
            visit_count: data.visitCount || 1,
            timestamp: new Date().toISOString()
        };

        this.debugLog('Returning form attributes:', attributes);
        return attributes;
    }
}

// Initialize and expose the tracker
(function() {
    // Only initialize if not already done
    if (!window.marketingTracker) {
        window.marketingTracker = new MarketingTracker();
        
        // Dispatch event when ready
        window.dispatchEvent(new Event('marketingTrackerReady'));
    }
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarketingTracker;
}
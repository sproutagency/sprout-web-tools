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
        const isInternalNavigation = currentReferrer && this.isInternalReferrer(currentReferrer);
        
        // Always create new tracking data
        const currentData = this.createTrackingData();
        
        // If it's internal navigation, just update the conversion page
        if (isInternalNavigation) {
            this.debugLog('Internal navigation - preserving attribution');
            if (storedData.lastInteraction) {
                storedData.lastInteraction = {
                    ...storedData.lastInteraction,
                    conversion_page: window.location.pathname
                };
            }
            // If no existing data, will fall through to direct attribution
        }
        // Otherwise, it's a new touch - update attribution based on priority
        else {
            const hasUtmParams = Array.from(params.keys()).some(key => key.startsWith('utm_') || key === 'gclid');
            const hasExternalReferrer = currentReferrer && !this.isInternalReferrer(currentReferrer);

            if (hasUtmParams) {
                this.debugLog('New touch: UTM parameters');
                storedData.lastInteraction = {
                    ...currentData,
                    landing_page: sessionStorage.getItem(this.SESSION_LANDING_KEY),
                    referrer: sessionStorage.getItem(this.SESSION_REFERRER_KEY) || '(direct)'
                };
            } else if (hasExternalReferrer) {
                this.debugLog('New touch: External referrer', { referrer: currentReferrer });
                storedData.lastInteraction = {
                    ...currentData,
                    landing_page: sessionStorage.getItem(this.SESSION_LANDING_KEY),
                    referrer: currentReferrer
                };
            } else {
                this.debugLog('New touch: Direct visit');
                storedData.lastInteraction = {
                    ...currentData,
                    landing_page: sessionStorage.getItem(this.SESSION_LANDING_KEY),
                    referrer: '(direct)',
                    source: '(direct)',
                    medium: '(none)',
                    campaign: '',
                    term: '',
                    gclid: ''
                };
            }

            // Store the referrer for this touch
            sessionStorage.setItem(this.SESSION_REFERRER_KEY, currentReferrer || '(direct)');
            localStorage.setItem(this.BACKUP_REFERRER_KEY, currentReferrer || '(direct)');
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
        
        const referrer = document.referrer;
        const parsedReferrer = this.parseReferrer(referrer);
        
        // Get campaign value directly, only clean it for safety
        let campaign = params.get('utm_campaign');
        if (campaign) {
            campaign = campaign.substring(0, this.MAX_VALUE_LENGTH).replace(/[^\w\s-_.]/g, '');
        }
        
        // Get gclid and clean it
        let gclid = params.get('gclid');
        if (gclid) {
            gclid = gclid.substring(0, this.MAX_VALUE_LENGTH).replace(/[^\w-]/g, '');
            this.debugLog('Found gclid:', gclid);
        }

        // Determine source and medium based on current touch
        let source, medium;
        
        // Priority 1: UTM Parameters
        if (params.get('utm_source')) {
            source = this.sanitizeValue(params.get('utm_source'), this.STANDARD_SOURCES);
            medium = this.sanitizeValue(params.get('utm_medium'), this.STANDARD_MEDIUMS);
            this.debugLog('Source/Medium from UTM:', { source, medium });
        }
        // Priority 2: GCLID
        else if (gclid) {
            source = 'google';
            medium = 'cpc';
            this.debugLog('Source/Medium from GCLID');
        }
        // Priority 3: External Referrer
        else if (parsedReferrer && !this.isInternalReferrer(referrer)) {
            const referrerData = this.determineReferrer(parsedReferrer);
            source = referrerData.source;
            medium = referrerData.medium;
            this.debugLog('Source/Medium from referrer:', { source, medium });
        }
        // Priority 4: Direct
        else {
            source = '(direct)';
            medium = '(none)';
            this.debugLog('Source/Medium: Direct visit');
        }
        
        const data = {
            timestamp: new Date().toISOString(),
            source: source,
            medium: medium,
            campaign: campaign || '',
            term: params.get('utm_term') || '',
            landing_page: window.location.pathname,
            referrer: referrer || '(direct)',
            gclid: gclid || '',
            device: this.getDeviceType()
        };

        this.debugLog('Created tracking data:', data);
        return data;
    }

    determineReferrer(parsedReferrer) {
        // Search engines
        if (this.SEARCH_ENGINE_DOMAINS.some(domain => parsedReferrer.hostname.includes(domain))) {
            return { source: this.extractDomain(parsedReferrer.hostname), medium: 'organic' };
        }
        
        // Social media
        if (this.SOCIAL_DOMAINS.some(domain => parsedReferrer.hostname.includes(domain))) {
            return { source: this.extractDomain(parsedReferrer.hostname), medium: 'social' };
        }

        // Other referrers
        return { 
            source: this.extractDomain(parsedReferrer.hostname), 
            medium: 'referral' 
        };
    }

    extractDomain(hostname) {
        // Remove common prefixes and get base domain
        return hostname
            .replace(/^www\./, '')
            .split('.')[0];
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
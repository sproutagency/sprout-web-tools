/**
 * Marketing Attribution Tracker
 * Core website attribution tracking for form submissions
 */
class MarketingTracker {
    constructor() {
        this.STORAGE_KEY = 'marketing_data';
        this.SESSION_LANDING_KEY = 'session_landing_page';
        this.SESSION_REFERRER_KEY = 'session_referrer';
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
        const currentData = this.createTrackingData();
        const storedData = this.getStoredData();
        
        if (!sessionStorage.getItem(this.SESSION_LANDING_KEY)) {
            sessionStorage.setItem(this.SESSION_LANDING_KEY, window.location.pathname);
        }

        const currentReferrer = document.referrer;
        if (!sessionStorage.getItem(this.SESSION_REFERRER_KEY) || 
            (currentReferrer && !this.isInternalReferrer(currentReferrer))) {
            sessionStorage.setItem(this.SESSION_REFERRER_KEY, currentReferrer);
        }
        
        storedData.lastInteraction = {
            ...currentData,
            landing_page: sessionStorage.getItem(this.SESSION_LANDING_KEY),
            referrer: sessionStorage.getItem(this.SESSION_REFERRER_KEY) || '(direct)'
        };
        storedData.visitCount = (storedData.visitCount || 0) + 1;
        
        this.storeData(storedData);
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
        const referrer = sessionStorage.getItem(this.SESSION_REFERRER_KEY) || document.referrer;
        const parsedReferrer = this.parseReferrer(referrer);
        
        let campaign = params.get('utm_campaign') || '';
        
        // Check for LSA traffic
        if (parsedReferrer && !campaign && parsedReferrer.hostname.includes('localservices')) {
            campaign = 'lsa';
        }

        // Check for GMB traffic
        if (!campaign && params.get('utm_source')?.toLowerCase() === 'google' && 
            params.get('utm_medium')?.toLowerCase() === 'organic') {
            campaign = 'gmb';
        }
        
        return {
            timestamp: new Date().toISOString(),
            source: this.determineSource(params, referrer),
            medium: this.determineMedium(params, referrer),
            campaign: campaign,
            term: params.get('utm_term'),
            landing_page: sessionStorage.getItem(this.SESSION_LANDING_KEY) || window.location.pathname,
            referrer: referrer || '(direct)',
            gclid: params.get('gclid'),
            device: this.getDeviceType()
        };
    }

    determineSource(params, referrer) {
        // Priority 1: UTM Source from URL
        if (params.get('utm_source')) {
            return this.sanitizeValue(params.get('utm_source'), this.STANDARD_SOURCES);
        }

        // Priority 2: Google Ads, LSA, or GMB
        if (params.get('gclid') || 
            params.get('utm_campaign')?.toLowerCase() === 'lsa' || 
            params.get('utm_campaign')?.toLowerCase() === 'gmb') {
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
        // Priority 1: UTM Medium from URL
        if (params.get('utm_medium')) {
            return this.sanitizeValue(params.get('utm_medium'), this.STANDARD_MEDIUMS);
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
        const cleaned = value.toLowerCase().trim();
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
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {};
        } catch (e) {
            return {};
        }
    }

    storeData(data) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }

    getFormAttributes() {
        const data = this.getStoredData();
        return {
            source: data.lastInteraction?.source || '(direct)',
            medium: data.lastInteraction?.medium || '(none)',
            campaign: data.lastInteraction?.campaign || '',
            term: data.lastInteraction?.term || '',
            landing_page: data.lastInteraction?.landing_page || window.location.pathname,
            conversion_page: window.location.pathname,
            referrer: data.lastInteraction?.referrer || document.referrer || '(direct)',
            gclid: data.lastInteraction?.gclid || '',
            device: data.lastInteraction?.device || this.getDeviceType(),
            visit_count: data.visitCount || 1
        };
    }
}

window.marketingTracker = new MarketingTracker();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarketingTracker;
}
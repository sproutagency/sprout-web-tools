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

    createTrackingData() {
        const params = new URLSearchParams(window.location.search);
        const referrer = sessionStorage.getItem(this.SESSION_REFERRER_KEY) || document.referrer;
        
        return {
            timestamp: new Date().toISOString(),
            source: this.determineSource(params, referrer),
            medium: this.determineMedium(params, referrer),
            campaign: params.get('utm_campaign')?.toLowerCase() === 'lsa' 
                    ? 'lsa' 
                    : params.get('utm_campaign'),
            term: params.get('utm_term'),
            landing_page: sessionStorage.getItem(this.SESSION_LANDING_KEY) || window.location.pathname,
            referrer: referrer || '(direct)',
            gclid: params.get('gclid'),
            device: this.getDeviceType()
        };
    }

    determineSource(params, referrer) {
        if (params.get('utm_source')) {
            return this.sanitizeValue(params.get('utm_source'), this.STANDARD_SOURCES);
        }

        if (params.get('gclid') || 
            params.get('utm_campaign')?.toLowerCase() === 'lsa' ||
            params.get('utm_campaign')?.toLowerCase() === 'gmb') {
            return 'google';
        }

        try {
            if (referrer) {
                const referrerUrl = new URL(referrer);
                const referrerParams = new URLSearchParams(referrerUrl.search);
                
                if (referrerParams.get('utm_source')) {
                    return this.sanitizeValue(referrerParams.get('utm_source'), this.STANDARD_SOURCES);
                }

                if (referrerParams.get('utm_campaign')?.toLowerCase() === 'gmb') {
                    return 'google';
                }

                if (referrerUrl.hostname.includes('localservices')) {
                    return 'google';
                }

                const hostname = referrerUrl.hostname.replace('www.', '');
                const searchEngines = {
                    'google.com': 'google',
                    'bing.com': 'bing',
                    'yahoo.com': 'yahoo',
                    'duckduckgo.com': 'duckduckgo',
                    'yandex.com': 'yandex'
                };
                
                if (searchEngines[hostname]) {
                    return searchEngines[hostname];
                }

                const socialMap = {
                    'facebook.com': 'facebook',
                    'instagram.com': 'instagram',
                    'linkedin.com': 'linkedin',
                    'twitter.com': 'x',
                    'x.com': 'x',
                    'youtube.com': 'youtube',
                    'youtu.be': 'youtube',
                    'tiktok.com': 'tiktok'
                };

                if (socialMap[hostname]) {
                    return socialMap[hostname];
                }

                return hostname.replace(/\.(com|org|net|edu|gov|mil|int|io|co|me|uk|de|fr)$/i, '');
            }
        } catch (e) {
            console.error('Error parsing referrer:', e);
        }

        return '(direct)';
    }

    determineMedium(params, referrer) {
        if (params.get('utm_medium')) {
            return this.sanitizeValue(params.get('utm_medium'), this.STANDARD_MEDIUMS);
        }

        if (params.get('utm_campaign')?.toLowerCase() === 'gmb') {
            return 'organic';
        }

        if (params.get('utm_campaign')?.toLowerCase() === 'lsa') {
            return 'cpc';
        }

        if (params.get('gclid')) {
            return 'cpc';
        }

        try {
            if (referrer) {
                const referrerUrl = new URL(referrer);
                const referrerParams = new URLSearchParams(referrerUrl.search);
                
                if (referrerParams.get('utm_medium')) {
                    return this.sanitizeValue(referrerParams.get('utm_medium'), this.STANDARD_MEDIUMS);
                }

                if (referrerParams.get('utm_campaign')?.toLowerCase() === 'gmb') {
                    return 'organic';
                }

                const hostname = referrerUrl.hostname;
                const searchEngines = [
                    'google', 'bing', 'yahoo', 
                    'duckduckgo', 'yandex'
                ];
                
                if (searchEngines.some(engine => hostname.includes(engine))) {
                    return 'organic';
                }

                const socialPlatforms = [
                    'facebook', 'instagram', 'linkedin',
                    'twitter', 'x.com', 'youtube',
                    'tiktok'
                ];
                
                if (socialPlatforms.some(platform => hostname.includes(platform))) {
                    return 'social';
                }

                return 'referral';
            }
        } catch (e) {
            console.error('Error parsing referrer:', e);
        }

        return '(none)';
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
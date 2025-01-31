/**
 * Marketing Attribution Tracker
 * Core website attribution tracking for form submissions
 */
class MarketingTracker {
    constructor() {
        this.STORAGE_KEY = 'marketing_data';
        this.initializeTracking();
    }

    // Standardized values mapping
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
        'facebook': 'facebook',
        'instagram': 'instagram',
        'linkedin': 'linkedin',
        'twitter': 'twitter',
        'tiktok': 'tiktok',
        'bing': 'bing',
        'direct': '(direct)'
    };

    initializeTracking() {
        const currentData = this.createTrackingData();
        const storedData = this.getStoredData();
        
        storedData.lastInteraction = currentData;
        storedData.visitCount = (storedData.visitCount || 0) + 1;
        
        this.storeData(storedData);
    }

    createTrackingData() {
        const params = new URLSearchParams(window.location.search);
        const referrer = document.referrer;
        
        return {
            timestamp: new Date().toISOString(),
            source: this.determineSource(params, referrer),
            medium: this.determineMedium(params, referrer),
            campaign: params.get('utm_campaign'),
            term: params.get('utm_term'),
            landing_page: window.location.pathname,
            referrer: referrer || '(direct)',
            gclid: params.get('gclid'),
            device: this.getDeviceType()
        };
    }

    determineSource(params, referrer) {
        // Priority 1: UTM Source
        if (params.get('utm_source')) {
            return this.sanitizeValue(params.get('utm_source'), this.STANDARD_SOURCES);
        }

        // Priority 2: Referrer analysis
        try {
            if (referrer) {
                const referrerUrl = new URL(referrer);
                const domain = referrerUrl.hostname.replace('www.', '');

                // Detect social/special sources
                const socialMap = {
                    'facebook.com': 'facebook',
                    'instagram.com': 'instagram',
                    'linkedin.com': 'linkedin',
                    'twitter.com': 'twitter',
                    'x.com': 'twitter',
                    'tiktok.com': 'tiktok'
                };

                return socialMap[domain] || domain;
            }
        } catch (e) {
            console.error('Error parsing referrer:', e);
        }

        return '(direct)';
    }

    determineMedium(params, referrer) {
        // Priority 1: UTM Medium
        if (params.get('utm_medium')) {
            return this.sanitizeValue(params.get('utm_medium'), this.STANDARD_MEDIUMS);
        }

        // Priority 2: gclid detection
        if (params.get('gclid')) return 'cpc';

        // Priority 3: Referrer analysis
        if (referrer) {
            try {
                const referrerUrl = new URL(referrer);
                if (referrerUrl.hostname.includes('google')) return 'organic';
                if (referrerUrl.hostname.includes('facebook')) return 'social';
                return 'referral';
            } catch (e) {
                console.error('Error parsing referrer:', e);
            }
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

// Initialize global instance
window.marketingTracker = new MarketingTracker();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarketingTracker;
}
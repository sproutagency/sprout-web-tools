/**
 * Core Marketing Attribution Script
 * Tracks first and last touch attribution data
 */

class MarketingAttribution {
    constructor(mockData) {
        this.STORAGE_KEY = 'attribution_data';
        this.SESSION_KEY = 'attribution_session';
        this.VISITOR_KEY = 'visitor_data';
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
        this.initializeTracking();
        this.initializeSession();
    }

    initializeTracking() {
        const currentTouch = this.createTouch();
        const storedData = this.getStoredData();

        // Set first touch if it doesn't exist
        if (!storedData.firstTouch) {
            storedData.firstTouch = currentTouch;
        }

        // Update last touch based on priority and timing rules
        if (this.shouldUpdateLastTouch(currentTouch, storedData.lastTouch)) {
            storedData.lastTouch = currentTouch;
        }

        this.storeData(storedData);
    }

    initializeSession() {
        let sessionData = this.getSessionData();
        if (!sessionData.pageViews) {
            sessionData = {
                startTime: '2025-01-03T17:53:14+02:00',
                pageViews: [{
                    path: window.location.pathname,
                    timestamp: '2025-01-03T17:53:14+02:00'
                }]
            };
        } else {
            sessionData.pageViews.push({
                path: window.location.pathname,
                timestamp: '2025-01-03T17:53:14+02:00'
            });
        }
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));

        // Update visitor data
        let visitorData = this.getVisitorData();
        if (!visitorData.firstSeen) {
            visitorData = {
                firstSeen: '2025-01-03T17:53:14+02:00',
                visitCount: 1,
                touchCount: 1
            };
        } else {
            visitorData.visitCount++;
            visitorData.touchCount++;
        }
        localStorage.setItem(this.VISITOR_KEY, JSON.stringify(visitorData));
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
        const userAgent = navigator.userAgent.toLowerCase();
        
        // Tablet must be detected first because some tablets
        // can also match mobile patterns
        if (/(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(userAgent)) {
            return 'tablet';
        }
        
        // Check for mobile devices
        if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/.test(userAgent) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/.test(userAgent.substr(0,4))) {
            return 'mobile';
        }
        
        // Default to desktop
        return 'desktop';
    }

    createTouch() {
        // Use mock data for testing if available
        const urlParams = this._mockData?.urlParams || new URLSearchParams(window.location.search);
        const referrer = this._mockData?.referrer || document.referrer;
        const currentUrl = this._mockData?.currentUrl ? new URL(this._mockData.currentUrl) : new URL(window.location.href);
        const currentParams = new URLSearchParams(currentUrl.search);

        // Get UTM parameters
        const utmParams = {
            source: currentParams.get('utm_source'),
            medium: currentParams.get('utm_medium'),
            campaign: currentParams.get('utm_campaign'),
            content: currentParams.get('utm_content'),
            term: currentParams.get('utm_term')
        };

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
        const hasNoReferrer = !referrer;
        const hasNoCampaign = !utmParams.source && !Object.values(clickIds).some(id => id);
        const hasNoBusinessProfile = !currentParams.get('pbid');

        if (hasNoReferrer && hasNoCampaign && hasNoBusinessProfile) {
            attribution = {
                source: '(direct)',
                medium: '(none)'
            };
        }

        // Create the touch
        const touch = {
            timestamp: '2025-01-03T18:34:36+02:00',
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
        // First check campaign parameters (UTM, click IDs)
        if (utmParams.source && utmParams.medium) {
            return {
                source: utmParams.source,
                medium: utmParams.medium
            };
        }

        // Check for Google Business Profile
        const currentParams = new URLSearchParams(currentUrl.search);
        if (currentParams.get('pbid')) {
            return { source: 'google', medium: 'business_profile' };
        }

        // Check for paid click IDs
        if (clickIds.gclid) {
            return { source: 'google', medium: 'cpc' };
        }
        if (clickIds.fbclid) {
            return { source: 'facebook', medium: 'paid_social' };
        }
        if (clickIds.msclkid) {
            return { source: 'bing', medium: 'cpc' };
        }
        if (clickIds.dclid) {
            return { source: 'google', medium: 'display' };
        }

        // If there's no referrer, it's direct
        if (!referrer) {
            return { source: '(direct)', medium: '(none)' };
        }

        // Process referrer for organic and other sources
        try {
            const referrerUrl = new URL(referrer);
            const referrerDomain = referrerUrl.hostname.replace('www.', '');
            const searchParams = new URLSearchParams(referrerUrl.search);

            // Special case for Google properties
            if (referrerDomain === 'google.com' || referrerDomain === 'business.google.com') {
                if (referrerDomain === 'business.google.com') {
                    return { source: 'google', medium: 'business_profile' };
                }
                if (searchParams.has('ludocid')) {
                    return { source: 'google', medium: 'local' };
                }
                if (referrerUrl.pathname.startsWith('/maps')) {
                    return { source: 'google', medium: 'maps' };
                }
                if (searchParams.has('kgmid')) {
                    return { source: 'google', medium: 'knowledge_graph' };
                }
                return { source: 'google', medium: 'organic' };
            }

            // Check for social media
            if (referrerDomain === 'facebook.com') {
                if (referrerUrl.pathname.includes('/groups/')) {
                    return { source: 'facebook', medium: 'group' };
                }
                if (referrerUrl.pathname.includes('/marketplace/')) {
                    return { source: 'facebook', medium: 'marketplace' };
                }
                return { source: 'facebook', medium: 'social' };
            }

            if (referrerDomain === 'linkedin.com') {
                if (referrerUrl.pathname.includes('/jobs/')) {
                    return { source: 'linkedin', medium: 'jobs' };
                }
                if (referrerUrl.pathname.includes('/company/')) {
                    return { source: 'linkedin', medium: 'company' };
                }
                return { source: 'linkedin', medium: 'social' };
            }

            // For other referrers, use the domain as source and 'referral' as medium
            return {
                source: referrerDomain,
                medium: 'referral'
            };

        } catch (e) {
            // If URL parsing fails, return as direct
            return { source: '(direct)', medium: '(none)' };
        }
    }

    getStoredData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Error reading attribution data:', e);
            return {};
        }
    }

    storeData(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Error storing attribution data:', e);
        }
    }

    getSessionData() {
        try {
            const data = localStorage.getItem(this.SESSION_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Error reading session data:', e);
            return {};
        }
    }

    getVisitorData() {
        try {
            const data = localStorage.getItem(this.VISITOR_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Error reading visitor data:', e);
            return {};
        }
    }

    getAttributionData() {
        const data = this.getStoredData();
        return {
            firstTouch: data.firstTouch || null,
            lastTouch: data.lastTouch || null
        };
    }

    calculateDaysSinceFirstTouch(firstTouchTime) {
        const currentTime = new Date('2025-01-03T18:34:36+02:00').getTime();
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
}

// Initialize global instance
window.marketingAttribution = new MarketingAttribution();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarketingAttribution;
}

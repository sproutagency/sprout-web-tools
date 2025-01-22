/**
 * Core Marketing Attribution Script v1
 * Tracks first and last touch attribution data
 */

class MarketingAttribution {
    constructor(mockData) {
        this.STORAGE_KEY = 'attribution_data';
        this.SESSION_KEY = 'attribution_session';
        this.VISITOR_KEY = 'visitor_data';
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
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
        const storedData = this.getStoredData();
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
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));

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
        localStorage.setItem(this.VISITOR_KEY, JSON.stringify(visitorData));
        
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
            
            // If we have one but not the other, make intelligent assumptions
            if (source && !medium) {
                if (source === 'google' || source === 'bing' || source === 'yahoo') {
                    medium = 'organic';
                } else if (source === 'facebook' || source === 'instagram' || source === 'linkedin' || source === 'twitter' || source === 'tiktok') {
                    medium = 'social';
                } else {
                    medium = 'referral';
                }
            }
            if (!source && medium) {
                source = '(other)';
            }
        }

        // 2. Click IDs - Paid Traffic
        if (!source && !medium) {
            const clickIdMapping = {
                gclid: { source: 'google', medium: 'cpc' },
                fbclid: { source: 'facebook', medium: 'paid_social' },
                msclkid: { source: 'bing', medium: 'cpc' },
                ttclid: { source: 'tiktok', medium: 'paid_social' },
                dclid: { source: 'google', medium: 'display' },
                li_fat_id: { source: 'linkedin', medium: 'paid_social' },
                twclid: { source: 'twitter', medium: 'paid_social' },
                igshid: { source: 'instagram', medium: 'paid_social' }
            };

            for (const [clickId, attribution] of Object.entries(clickIdMapping)) {
                if (clickIds[clickId]) {
                    source = attribution.source;
                    medium = attribution.medium;
                    break;
                }
            }
        }

        // 3. Google Business Profile
        if (!source && !medium) {
            const currentParams = new URLSearchParams(currentUrl.search);
            if (currentParams.get('pbid') || currentParams.get('ludocid')) {
                source = 'google';
                medium = 'business_profile';
            }
        }

        // 4. Process Referrer
        if (!source && !medium) {
            try {
                if (!referrer) {
                    source = '(direct)';
                    medium = '(none)';
                } else {
                    const referrerUrl = new URL(referrer);
                    const referrerDomain = referrerUrl.hostname.replace('www.', '');

                    // 5. Search Engines
                    const searchEngines = {
                        'google': ['google.com'],
                        'bing': ['bing.com'],
                        'yahoo': ['search.yahoo.com', 'yahoo.com']
                    };

                    let found = false;
                    for (const [engine, domains] of Object.entries(searchEngines)) {
                        if (domains.some(domain => referrerDomain.includes(domain))) {
                            source = engine;
                            // Special case for Google Maps
                            if (engine === 'google' && referrerUrl.pathname.startsWith('/maps')) {
                                medium = 'maps';
                            } else {
                                medium = 'organic';
                            }
                            found = true;
                            break;
                        }
                    }

                    if (!found) {
                        // 6. Social Networks
                        const socialNetworks = {
                            'facebook': {
                                domains: ['facebook.com', 'fb.com'],
                                paths: {
                                    '/groups/': 'group',
                                    '/marketplace/': 'marketplace'
                                }
                            },
                            'instagram': {
                                domains: ['instagram.com']
                            },
                            'linkedin': {
                                domains: ['linkedin.com'],
                                paths: {
                                    '/company/': 'company',
                                    '/jobs/': 'jobs'
                                }
                            },
                            'twitter': {
                                domains: ['twitter.com', 'x.com', 't.co']
                            },
                            'tiktok': {
                                domains: ['tiktok.com']
                            },
                            'youtube': {
                                domains: ['youtube.com', 'youtu.be']
                            }
                        };

                        for (const [network, config] of Object.entries(socialNetworks)) {
                            if (config.domains.some(domain => referrerDomain.includes(domain))) {
                                source = network;
                                if (config.paths) {
                                    for (const [path, pathMedium] of Object.entries(config.paths)) {
                                        if (referrerUrl.pathname.includes(path)) {
                                            medium = pathMedium;
                                            break;
                                        }
                                    }
                                }
                                if (!medium) medium = 'social';
                                found = true;
                                break;
                            }
                        }

                        if (!found) {
                            // 7. Email Providers
                            const emailDomains = [
                                'mail.google.com',
                                'outlook.com',
                                'outlook.live.com',
                                'outlook.office365.com',
                                'mail.yahoo.com'
                            ];

                            if (emailDomains.some(domain => referrerDomain.includes(domain))) {
                                source = 'email';
                                medium = 'email';
                            } else if (referrerDomain === window.location.hostname) {
                                // 8. Internal Traffic
                                source = '(direct)';
                                medium = '(none)';
                            } else {
                                // 9. Everything else is a referral
                                source = referrerDomain;
                                medium = 'referral';
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Error processing referrer:', e);
                source = '(direct)';
                medium = '(none)';
            }
        }

        // Final sanitization and validation
        source = this.sanitizeAttributionValue(source, this.STANDARD_SOURCES) || '(direct)';
        medium = this.sanitizeAttributionValue(medium, this.STANDARD_MEDIUMS) || '(none)';

        return { source, medium };
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
        const sessionData = this.getSessionData();
        const visitorData = this.getVisitorData();
        
        return {
            firstTouch: data.firstTouch || null,
            lastTouch: data.lastTouch || null,
            sessionData: sessionData,
            touchCount: visitorData.touchCount || 0,
            visitCount: visitorData.visitCount || 0,
            firstSeen: visitorData.firstSeen
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
}

// Initialize global instance
window.globalAttributionTracker = new MarketingAttribution();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarketingAttribution;
}
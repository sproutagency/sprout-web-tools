console.log('%c Attribution Script via Slater', 'background: #222; color: #bada55; padding: 5px; font-size: 16px;');

// Check if script is loaded via Slater
if (typeof window !== 'undefined') {
    console.log('🚀 Attribution script loading via Slater...');

    class AttributionTracker {
        constructor(options = {}) {
            console.log('📊 AttributionTracker initializing...');
            
            // Configuration with defaults
            this.config = {
                storageKey: 'attribution_touches',
                sessionDuration: 30 * 60 * 1000,
                attributionWindow: 30 * 24 * 60 * 60 * 1000,
                ...options
            };

            // Initialize storage and tracking immediately
            this.initializeStorage();
            this.currentSessionPages = [];
            this.addPageToSession(window.location.pathname);

            console.log('✅ AttributionTracker initialized with config:', this.config);
        }

        initializeStorage() {
            try {
                if (typeof localStorage !== 'undefined') {
                    this.storage = localStorage;
                } else {
                    console.warn('localStorage not available, falling back to memory storage');
                    this.storage = new Map();
                }
            } catch (e) {
                console.warn('Error initializing storage:', e);
                this.storage = new Map();
            }
        }

        addPageToSession(pathname) {
            this.currentSessionPages.push(pathname);
            
            // Monitor URL changes without using event listeners
            let lastUrl = location.href; 
            new MutationObserver(() => {
                const url = location.href;
                if (url !== lastUrl) {
                    lastUrl = url;
                    this.currentSessionPages.push(window.location.pathname);
                }
            }).observe(document, {subtree: true, childList: true});
        }

        getAttributionData() {
            try {
                const currentTouch = this.createCurrentTouch();
                const storedTouches = this.getStoredTouches();
                const updatedTouches = this.updateTouchPoints(storedTouches, currentTouch);
                
                this.storeTouches(updatedTouches);

                return {
                    firstTouch: updatedTouches[0],
                    lastTouch: updatedTouches[updatedTouches.length - 1],
                    allTouches: updatedTouches,
                    touchCount: updatedTouches.length,
                    deviceInfo: this.getDeviceInfo(),
                    sessionData: this.getSessionData(),
                    journeyStory: this.getJourneyStory()
                };
            } catch (error) {
                console.error('Error getting attribution data:', error);
                return this.createEmptyAttribution();
            }
        }

        createCurrentTouch() {
            const urlParams = new URLSearchParams(window.location.search);
            const utmParameters = {
                source: urlParams.get('utm_source'),
                medium: urlParams.get('utm_medium'),
                campaign: urlParams.get('utm_campaign'),
                content: urlParams.get('utm_content'),
                term: urlParams.get('utm_term')
            };

            return {
                source: this.determineSource(utmParameters.source, document.referrer),
                medium: this.determineMedium(utmParameters.medium, document.referrer),
                timestamp: new Date().toISOString(),
                referrer: document.referrer,
                landingPage: window.location.pathname,
                utmParameters: Object.fromEntries(
                    Object.entries(utmParameters).filter(([_, v]) => v != null)
                )
            };
        }

        determineSource(utmSource, referrer) {
            if (utmSource) return utmSource;
            if (!referrer) return 'direct';

            try {
                const referrerUrl = new URL(referrer);
                const referrerDomain = referrerUrl.hostname.toLowerCase();
                
                // Check for search engines
                if (referrerDomain.includes('google.')) return 'google';
                if (referrerDomain.includes('bing.')) return 'bing';
                if (referrerDomain.includes('yahoo.')) return 'yahoo';
                
                // Check for social platforms
                if (referrerDomain.includes('facebook.') || referrerDomain.includes('fb.com')) return 'facebook';
                if (referrerDomain.includes('instagram.')) return 'instagram';
                if (referrerDomain.includes('linkedin.')) return 'linkedin';
                if (referrerDomain.includes('twitter.') || referrerDomain.includes('x.com')) return 'twitter';
                
                // Default to domain name without TLD
                return referrerDomain.split('.').slice(-2, -1)[0];
            } catch (e) {
                console.warn('Error parsing referrer:', e);
                return 'unknown';
            }
        }

        determineMedium(utmMedium, referrer) {
            if (utmMedium) return utmMedium;
            if (!referrer) return 'direct';

            try {
                const referrerUrl = new URL(referrer);
                const referrerDomain = referrerUrl.hostname.toLowerCase();
                
                // Check for search engines
                if (referrerDomain.includes('google.') || 
                    referrerDomain.includes('bing.') || 
                    referrerDomain.includes('yahoo.')) {
                    return 'organic_search';
                }
                
                // Check for social platforms
                if (referrerDomain.includes('facebook.') || 
                    referrerDomain.includes('instagram.') || 
                    referrerDomain.includes('linkedin.') || 
                    referrerDomain.includes('twitter.') ||
                    referrerDomain.includes('x.com')) {
                    return 'social';
                }
                
                return 'referral';
            } catch (e) {
                console.warn('Error determining medium:', e);
                return 'unknown';
            }
        }

        getStoredTouches() {
            try {
                const data = this.storage instanceof Map 
                    ? this.storage.get(this.config.storageKey)
                    : this.storage.getItem(this.config.storageKey);
                
                return data ? JSON.parse(data) : [];
            } catch (e) {
                console.error('Error getting stored touches:', e);
                return [];
            }
        }

        updateTouchPoints(storedTouches, currentTouch) {
            const now = new Date();
            const validTouches = storedTouches.filter(touch => {
                const touchDate = new Date(touch.timestamp);
                return (now - touchDate) <= this.config.attributionWindow;
            });

            if (validTouches.length === 0) {
                return [currentTouch];
            }

            const lastTouch = validTouches[validTouches.length - 1];
            if (this.isSignificantNewTouch(lastTouch, currentTouch)) {
                validTouches.push(currentTouch);
            }

            return validTouches;
        }

        isSignificantNewTouch(lastTouch, currentTouch) {
            const channelChanged = 
                lastTouch.source !== currentTouch.source || 
                lastTouch.medium !== currentTouch.medium;

            const timeDiff = new Date(currentTouch.timestamp) - new Date(lastTouch.timestamp);
            const significantTimePassed = timeDiff > this.config.sessionDuration;

            return channelChanged || significantTimePassed;
        }

        storeTouches(touches) {
            try {
                const data = JSON.stringify(touches);
                this.storage instanceof Map 
                    ? this.storage.set(this.config.storageKey, data)
                    : this.storage.setItem(this.config.storageKey, data);
            } catch (e) {
                console.error('Error storing touches:', e);
            }
        }

        getDeviceInfo() {
            return {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                screenResolution: `${window.screen.width}x${window.screen.height}`,
                viewportSize: `${window.innerWidth}x${window.innerHeight}`,
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
    }

    // Initialize tracker immediately
    console.log('🏗️ Creating global attribution tracker...');
    window.globalAttributionTracker = new AttributionTracker({
        storageKey: 'site_attribution',
        sessionDuration: 30 * 60 * 1000,
        attributionWindow: 30 * 24 * 60 * 60 * 1000
    });

    // Get attribution data immediately
    try {
        const attributionData = window.globalAttributionTracker.getAttributionData();
        console.log('✨ Attribution Data Successfully Loaded:', attributionData);
    } catch (error) {
        console.error('❌ Attribution Error:', error);
    }

    console.log('🎉 Attribution script fully loaded and running!');
}
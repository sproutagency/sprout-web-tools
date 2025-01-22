// attribution-engine.js
(function() {
    'use strict';

    const VERSION = '2.5.0';
    const SAFE_CHARS = /[^a-zA-Z0-9-_@:/. ]/g;
    const MAX_LENGTH = 100;

    class AttributionEngine {
        constructor() {
            this.config = {
                storageKey: 'ae_v2_data',
                sessionKey: 'ae_v2_session',
                visitorKey: 'ae_v2_visitor',
                sessionTimeout: 1800000, // 30 minutes
                dataTTL: 2592000000, // 30 days
                conversionPage: null
            };

            this.standardMediums = this.createStandardMap({
                'cpc': 'paid_search',
                'ppc': 'paid_search',
                'paid': 'paid_search',
                'social': 'organic_social',
                'organic': 'organic_search',
                'email': 'email',
                'referral': 'referral',
                'none': '(none)'
            });

            this.standardSources = this.createStandardMap({
                'google': 'google',
                'bing': 'bing',
                'facebook': 'facebook',
                'instagram': 'instagram',
                'linkedin': 'linkedin',
                'twitter': 'twitter',
                'direct': '(direct)'
            });

            this.init();
        }

        init() {
            this.cleanURL();
            this.validateData();
            this.trackSession();
            this.recordTouchPoint();
            this.emitReadyEvent();
        }

        createStandardMap(mappings) {
            return new Proxy(mappings, {
                get: (target, prop) => {
                    const key = String(prop).toLowerCase().replace(/[^a-z0-9]/g, '');
                    return target[key] || this.sanitize(prop);
                }
            });
        }

        cleanURL() {
            const params = new URLSearchParams(location.search);
            ['fbclid', 'gclid', 'msclkid', 'utm_id'].forEach(p => params.delete(p));
            history.replaceState({}, '', `${location.pathname}?${params}`);
        }

        validateData() {
            const data = this.getStorageData();
            if (data.expiry && Date.now() > data.expiry) {
                localStorage.removeItem(this.config.storageKey);
                localStorage.removeItem(this.config.visitorKey);
            }
        }

        trackSession() {
            const session = this.getSessionData();
            const isNewSession = !session.startTime || 
                (Date.now() - new Date(session.startTime).getTime()) > this.config.sessionTimeout;

            if (isNewSession) {
                this.config.conversionPage = location.pathname;
                this.updateSession({
                    startTime: new Date().toISOString(),
                    pageViews: [this.createPageView()]
                });
                this.incrementVisitorCount();
            } else if (session.pageViews) {
                const lastPath = session.pageViews[session.pageViews.length - 1].path;
                if (lastPath !== location.pathname) {
                    session.pageViews.push(this.createPageView());
                    this.updateSession(session);
                }
            }
        }

        createPageView() {
            return {
                path: this.sanitizePath(location.pathname),
                timestamp: new Date().toISOString()
            };
        }

        recordTouchPoint() {
            const data = this.getStorageData();
            const touch = this.createTouchPoint();

            if (!data.firstTouch) {
                data.firstTouch = touch;
                data.expiry = Date.now() + this.config.dataTTL;
            }

            if (this.isHigherPriority(touch, data.lastTouch)) {
                data.lastTouch = touch;
            }

            this.updateStorage(data);
        }

        createTouchPoint() {
            return {
                timestamp: new Date().toISOString(),
                source: this.standardSources[this.getSource()],
                medium: this.standardMediums[this.getMedium()],
                campaign: this.sanitize(new URLSearchParams(location.search).get('utm_campaign')),
                content: this.sanitize(new URLSearchParams(location.search).get('utm_content')),
                term: this.sanitize(new URLSearchParams(location.search).get('utm_term')),
                device: this.getDeviceType(),
                referrer: this.getReferrerSource(),
                landingPage: this.sanitizePath(location.pathname),
                formattedDate: new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                })
            };
        }

        getSource() {
            const params = new URLSearchParams(location.search);
            return params.get('utm_source') || this.analyzeReferrer().source;
        }

        getMedium() {
            const params = new URLSearchParams(location.search);
            return params.get('utm_medium') || this.analyzeReferrer().medium;
        }

        analyzeReferrer() {
            try {
                const referrer = document.referrer;
                if (!referrer) return { source: '(direct)', medium: '(direct)' };

                const refUrl = new URL(referrer);
                if (refUrl.hostname === location.hostname) return { source: '(direct)', medium: '(direct)' };

                return {
                    source: this.standardSources[refUrl.hostname.replace('www.', '')],
                    medium: refUrl.hostname.includes('google') ? 'organic_search' :
                           refUrl.hostname.includes('bing') ? 'organic_search' :
                           refUrl.hostname.includes('facebook') ? 'social' :
                           refUrl.hostname.includes('linkedin') ? 'social' : 'referral'
                };
            } catch {
                return { source: '(direct)', medium: '(direct)' };
            }
        }

        getReferrerSource() {
            try {
                return document.referrer ? 
                    this.sanitize(new URL(document.referrer).hostname) : 
                    '(direct)';
            } catch {
                return '(direct)';
            }
        }

        getDeviceType() {
            return /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
        }

        isHigherPriority(current, previous) {
            if (!previous) return true;
            const priority = { 'paid_search':1, 'paid_social':2, 'organic_social':3, 'referral':4 };
            return (priority[current.medium] || 5) <= (priority[previous.medium] || 5);
        }

        incrementVisitorCount() {
            const visitor = this.getVisitorData();
            visitor.visitCount = (visitor.visitCount || 0) + 1;
            visitor.totalTouches = (visitor.totalTouches || 0) + 1;
            visitor.firstSeen = visitor.firstSeen || new Date().toISOString();
            localStorage.setItem(this.config.visitorKey, JSON.stringify(visitor));
        }

        sanitize(value) {
            return String(value || '').replace(SAFE_CHARS, '').substring(0, MAX_LENGTH);
        }

        sanitizePath(path) {
            return this.sanitize(path).replace(/\/+/g, '-');
        }

        // Storage handlers
        getStorageData() {
            try {
                return JSON.parse(localStorage.getItem(this.config.storageKey)) || {};
            } catch {
                return {};
            }
        }

        updateStorage(data) {
            try {
                localStorage.setItem(this.config.storageKey, JSON.stringify(data));
            } catch (e) {
                console.error('Storage error:', e);
            }
        }

        getSessionData() {
            try {
                return JSON.parse(localStorage.getItem(this.config.sessionKey)) || {};
            } catch {
                return {};
            }
        }

        updateSession(session) {
            localStorage.setItem(this.config.sessionKey, JSON.stringify(session));
        }

        getVisitorData() {
            try {
                return JSON.parse(localStorage.getItem(this.config.visitorKey)) || {};
            } catch {
                return {};
            }
        }

        emitReadyEvent() {
            const data = {
                ...this.getStorageData(),
                sessionData: this.getSessionData(),
                visitorData: this.getVisitorData(),
                conversionPage: this.config.conversionPage,
                daysToConvert: this.calculateDaysSinceFirstTouch()
            };

            document.dispatchEvent(new CustomEvent('attributionReady', {
                detail: data
            }));
        }

        calculateDaysSinceFirstTouch() {
            const data = this.getStorageData();
            if (!data.firstTouch) return 0;
            const diff = Date.now() - new Date(data.firstTouch.timestamp).getTime();
            return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
        }
    }

    // Initialize with error protection
    try {
        window.globalAttributionTracker = new AttributionEngine();
    } catch (error) {
        console.error('Attribution initialization failed:', error);
    }
})();

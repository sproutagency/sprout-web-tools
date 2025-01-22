// attribution-engine-prod.js v2.6.5
(function() {
    'use strict';

    const VERSION = '2.6.5';

    class AttributionEngine {
        constructor() {
            this.config = {
                storageKey: 'ae_v2_data',
                sessionKey: 'ae_v2_session',
                visitorKey: 'ae_v2_visitor',
                sessionTimeout: 1800000,
                dataTTL: 2592000000,
                conversionPage: null
            };

            this.standardMediums = new Proxy({
                'cpc': 'paid_search',
                'ppc': 'paid_search',
                'paid': 'paid_search',
                'social': 'organic_social',
                'organic': 'organic_search',
                'email': 'email',
                'referral': 'referral',
                'none': '(none)'
            }, {
                get: (target, prop) => {
                    const key = String(prop).toLowerCase();
                    return target[key] || prop;
                }
            });

            this.standardSources = new Proxy({
                'google': 'google',
                'bing': 'bing',
                'facebook': 'facebook',
                'instagram': 'instagram',
                'linkedin': 'linkedin',
                'twitter': 'twitter',
                'direct': '(direct)'
            }, {
                get: (target, prop) => {
                    const key = String(prop).toLowerCase();
                    return target[key] || prop;
                }
            });

            this.init();
        }

        // KEEP ALL ORIGINAL METHODS BELOW THIS LINE
        init() {
            this.cleanURL();
            this.validateData();
            this.trackSession();
            this.recordTouchPoint();
            this.emitReadyEvent();
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
                this.config.conversionPage = location.pathname;
            }
        }

        createPageView() {
            return {
                path: location.pathname,
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
                campaign: new URLSearchParams(location.search).get('utm_campaign') || '',
                content: new URLSearchParams(location.search).get('utm_content') || '',
                term: new URLSearchParams(location.search).get('utm_term') || '',
                device: this.getDeviceType(),
                referrer: this.getReferrerSource(),
                landingPage: location.pathname,
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
                    new URL(document.referrer).hostname : 
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

        // REMOVED: sanitize() and sanitizePath()

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
                conversionPage: this.config.conversionPage || location.pathname,
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

    try {
        window.globalAttributionTracker = new AttributionEngine();
    } catch (error) {
        console.error('Attribution initialization failed:', error);
    }
})();

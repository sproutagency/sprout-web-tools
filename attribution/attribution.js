class AttributionTracker {
    constructor(options = {}) {
      // Configuration with defaults
      this.config = {
        storageKey: 'attribution_touches',
        sessionDuration: 30 * 60 * 1000, // 30 minutes
        attributionWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
        ...options
      };
  
      this.paidMediums = [
        'cpc', 'ppc', 'paid', 
        'paid_social', 'paid_search',
        'display', 'cpm', 'banner',
        'retargeting', 'remarketing',
        'paid_local'
      ];
      this.organicMediums = ['organic', 'social', 'organic_social', 'social_network', 'social_media', 'sm'];
      
      this.searchEngines = {
        'google': {
          domains: ['google.', 'google.com'],
          searchParams: ['q', 'query'],
          patterns: [/^www\.google\./]
        },
        'bing': {
          domains: ['bing.', 'bing.com'],
          searchParams: ['q', 'query'],
          patterns: [/^www\.bing\./]
        },
        'duckduckgo': {
          domains: ['duckduckgo.', 'duckduckgo.com'],
          searchParams: ['q'],
          patterns: [/^duckduckgo\./]
        }
      };
      
      this.socialNetworks = {
        'facebook': {
          domains: ['facebook.', 'fb.com', 'm.facebook.com'],
          appIds: ['fb_app_id']
        },
        'instagram': {
          domains: ['instagram.', 'ig.com'],
          appIds: ['ig_app_id']
        },
        'youtube': {
          domains: ['youtube.', 'youtu.be'],
          patterns: [/^www\.youtube\./]
        },
        'yelp': {
          domains: ['yelp.'],
          businessId: ['biz_id']
        },
        'nextdoor': {
          domains: ['nextdoor.'],
          patterns: [/^nextdoor\./]
        },
        'twitter': {
          domains: ['twitter.', 'x.com', 't.co'],
          patterns: [/^twitter\./, /^x\.com/]
        },
        'linkedin': {
          domains: ['linkedin.'],
          trackingCodes: ['li_fat_id']
        },
        'spotify': {
          domains: ['spotify.'],
          patterns: [/^open\.spotify\./]
        },
        'pinterest': {
          domains: ['pinterest.'],
          patterns: [/^pin\./]
        },
        'tiktok': {
          domains: ['tiktok.', 'tiktok.com'],
          patterns: [/^vm\.tiktok\./, /^www\.tiktok\./]
        }
      };
  
      this.aiPlatforms = {
        'searchgpt': {
          domains: ['search.openai.com', 'chatgpt.com'],
          patterns: [/openai\./, /chatgpt\./]
        },
        'perplexity': {
          domains: ['perplexity'],
          patterns: [/perplexity\./]
        },
        'gemini': {
          domains: ['gemini.google.com'],
          patterns: [/gemini\.google\./]
        }
      };
  
      this.channelMediums = {
        search: ['organic_search', 'search', 'search_engine'],
        social: ['social', 'social_organic', 'social_network'],
        email: ['email', 'mail', 'newsletter'],
        referral: ['referral', 'link', 'message'],
        direct: ['direct', 'none', '(none)'],
        local: ['organic_local', 'local_listing'],
        paid: this.paidMediums,
        other: ['other', 'unknown', 'ai_referral']
      };
  
      // Initialize storage
      this.initializeStorage();
  
      // Initialize page tracking
      this.currentSessionPages = [];
      this.initializePageTracking();
  
      // Add local business sources
      this.localBusinessSources = {
        'google_business': {
          domains: ['business.google.com'],
          patterns: [/^maps\.google\./],
          utmSources: ['gmb', 'gbp', 'google_business']
        }
      };
  
      // Add messaging platforms
      this.messagingPlatforms = {
        'message': {
          domains: [
            'messages.google.com',
            'm.me',
            'messenger.com',
            'wa.me',
            'whatsapp.com'
          ],
          patterns: [/\.messenger\./, /\.whatsapp\./, /messages\./]
        }
      };
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
  
    initializePageTracking() {
      // Track initial page
      this.addPageToSession(window.location.pathname);
  
      // Track SPA navigation
      window.addEventListener('popstate', () => {
        this.addPageToSession(window.location.pathname);
      });
  
      // Monitor pushState
      const originalPushState = history.pushState;
      history.pushState = function() {
        originalPushState.apply(this, arguments);
        this.addPageToSession(window.location.pathname);
      }.bind(this);
    }
  
    addPageToSession(pathname) {
      this.currentSessionPages.push(pathname);
      // Update session data
      const sessionData = this.getSessionData();
      sessionData.pagesViewed = this.currentSessionPages;
    }
  
    getJourneyStory() {
      const currentTouch = this.createCurrentTouch();
      const paths = this.currentSessionPages
        .filter(Boolean)
        .filter((path, index, array) => array.indexOf(path) === index);
  
      return `Pages viewed in converting session (${currentTouch.source}/${currentTouch.medium}): ${paths.join(' > ')}`;
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
      const referrer = document.referrer;
      const utmParams = this.extractUtmParameters(urlParams);
  
      // First check UTM parameters
      let source = utmParams.source;
      let medium = utmParams.medium;
  
      // If no UTM parameters, determine from referrer
      if (!source || !medium) {
        source = this.determineSource(utmParams.source, referrer);
        medium = this.determineMedium(utmParams.medium, referrer, source);
      }
  
      return {
        source,
        medium,
        timestamp: new Date().toISOString(),
        referrer,
        landingPage: window.location.pathname,
        utmParameters: utmParams,
        campaignData: this.analyzeCampaignData(utmParams),
        customParameters: this.extractCustomParameters(urlParams),
        channel: this.determineChannel(source, medium),
        sessionId: this.getSessionData().id,
        isNewSession: !this.getStoredTouches().length || this.isNewSession()
      };
    }
  
    getStoredTouches() {
      try {
        const stored = this.storage instanceof Map 
          ? this.storage.get(this.config.storageKey)
          : this.storage.getItem(this.config.storageKey);
        return stored ? JSON.parse(stored) : [];
      } catch (e) {
        console.error('Error retrieving stored touches:', e);
        return [];
      }
    }
  
    updateTouchPoints(storedTouches, currentTouch) {
      // If no stored touches, this is the first touch
      if (storedTouches.length === 0) {
        // Don't set direct as first touch if there's a referrer or UTM params
        if (currentTouch.source === 'direct' && 
            (currentTouch.referrer || currentTouch.utmParameters.source)) {
          const referrerSource = this.determineSource(
            currentTouch.utmParameters.source, 
            currentTouch.referrer
          );
          const referrerMedium = this.determineMedium(
            currentTouch.utmParameters.medium,
            currentTouch.referrer,
            referrerSource
          );
          currentTouch.source = referrerSource;
          currentTouch.medium = referrerMedium;
        }
        return [currentTouch];
      }
  
      const lastTouch = storedTouches[storedTouches.length - 1];
      
      // Check if this is a significant new touch
      if (this.isSignificantNewTouch(lastTouch, currentTouch)) {
        // Don't add direct traffic unless it's truly direct
        if (currentTouch.source === 'direct' && 
            (currentTouch.referrer || currentTouch.utmParameters.source)) {
          return storedTouches;
        }
        return [...storedTouches, currentTouch];
      }
  
      return storedTouches;
    }
  
    storeTouches(touches) {
      try {
        if (this.storage instanceof Map) {
          this.storage.set(this.config.storageKey, JSON.stringify(touches));
        } else {
          this.storage.setItem(this.config.storageKey, JSON.stringify(touches));
        }
      } catch (e) {
        console.error('Error storing touches:', e);
      }
    }
  
    isSignificantNewTouch(lastTouch, currentTouch) {
      // Different source or medium indicates a new channel
      const channelChanged = 
        lastTouch.source !== currentTouch.source || 
        lastTouch.medium !== currentTouch.medium;
  
      // Check if it's a paid channel (should always be captured)
      const isPaidChannel = 
        this.paidMediums.includes(currentTouch.medium);
  
      // Check if enough time has passed (e.g., 30 minutes)
      const timeThreshold = this.config.sessionDuration; // Use configured session duration
      const timeDiff = new Date(currentTouch.timestamp) - new Date(lastTouch.timestamp);
      const significantTimePassed = timeDiff > timeThreshold;
  
      // Don't consider direct traffic as significant unless it's a new session
      if (currentTouch.source === 'direct' && !currentTouch.referrer) {
        return significantTimePassed;
      }
  
      return channelChanged || isPaidChannel || significantTimePassed;
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
        pagesViewed: this.currentSessionPages,  // Now using tracked pages
        lastActivity: new Date().toISOString()
      };
    }
  
    generateSessionId() {
      return 'sess_' + Math.random().toString(36).substr(2, 9);
    }
  
    extractUtmParameters(urlParams) {
      const utmFields = ['source', 'medium', 'campaign', 'term', 'content'];
      const params = {};
      
      utmFields.forEach(field => {
        const value = urlParams.get(`utm_${field}`)?.toLowerCase();
        params[field] = value || null;
      });
      
      return params;
    }
  
    extractCustomParameters(urlParams) {
      const customParams = {};
      for (const [key, value] of urlParams.entries()) {
        if (!key.startsWith('utm_')) {
          customParams[key] = value;
        }
      }
      return customParams;
    }
  
    analyzeCampaignData(utmParams) {
      return {
        campaign: {
          value: utmParams.campaign || null,
          isSet: !!utmParams.campaign,
          type: this.determineCampaignType(utmParams.campaign)
        },
        searchTerms: {
          value: utmParams.term || null,
          isSet: !!utmParams.term,
          keywords: utmParams.term ? utmParams.term.split(/[\s+_]/) : []
        },
        contentVariation: {
          value: utmParams.content || null,
          isSet: !!utmParams.content,
          testingInfo: this.parseContentTesting(utmParams.content)
        }
      };
    }
  
    determineSource(utmSource, referrer) {
      // First check UTM source
      if (utmSource) {
        // Check if it's a known local business UTM source
        for (const [platform, config] of Object.entries(this.localBusinessSources)) {
          if (config.utmSources.includes(utmSource.toLowerCase())) {
            return platform;
          }
        }
        return utmSource;
      }
      
      if (referrer) {
        try {
          const referrerUrl = new URL(referrer);
          const referrerDomain = referrerUrl.hostname.toLowerCase();
          
          // Check local business platforms
          for (const [platform, config] of Object.entries(this.localBusinessPlatforms)) {
            if (config.domains.some(domain => referrerDomain.includes(domain)) ||
                config.patterns.some(pattern => pattern.test(referrerDomain))) {
              return platform;
            }
          }
          
          // Check messaging platforms
          for (const [platform, config] of Object.entries(this.messagingPlatforms)) {
            if (config.domains.some(domain => referrerDomain.includes(domain)) ||
                config.patterns.some(pattern => pattern.test(referrerDomain))) {
              return platform;
            }
          }
          
          // Check other platforms (AI, search, social)
          // ... existing platform checks ...
          
          return referrerDomain;
        } catch (e) {
          console.error('Error parsing referrer:', e);
          return 'invalid_referrer';
        }
      }
      
      return 'direct';
    }
  
    determineMedium(utmMedium, referrer, source) {
      // UTM medium takes precedence
      if (utmMedium) {
        // Check if it's a known paid medium
        if (this.paidMediums.includes(utmMedium)) {
          return utmMedium;
        }
        return utmMedium;
      }
  
      // No UTM medium, determine from source and referrer
      if (source === 'google_business' || source === 'google_maps') {
        return 'organic_local';
      }
      
      if (source === 'google_local_services') {
        return 'paid_local';
      }
  
      if (Object.keys(this.messagingPlatforms).includes(source)) {
        return 'message';
      }
  
      // Check for search engines
      if (Object.keys(this.searchEngines).includes(source)) {
        return 'organic_search';
      }
  
      // Check for social networks
      if (Object.keys(this.socialNetworks).includes(source)) {
        return 'social';
      }
  
      // Check for AI platforms
      if (Object.keys(this.aiPlatforms).includes(source)) {
        return 'ai_referral';
      }
  
      // No referrer means direct
      if (!referrer) {
        return 'direct';
      }
  
      return 'referral';
    }
  
    determineCampaignType(campaign) {
      if (!campaign) return 'unknown';
      
      if (campaign.includes('email')) return 'email_campaign';
      if (campaign.includes('social')) return 'social_campaign';
      if (campaign.includes('search')) return 'search_campaign';
      if (campaign.includes('display')) return 'display_campaign';
      if (campaign.includes('retarget')) return 'retargeting_campaign';
      
      return 'other_campaign';
    }
  
    parseContentTesting(content) {
      if (!content) return null;
      
      return {
        isABTest: content.includes('test') || content.includes('variant'),
        variant: content,
        category: this.determineContentCategory(content)
      };
    }
    determineContentCategory(content) {
      if (!content) return 'unknown';
      
      if (content.includes('button')) return 'cta_button';
      if (content.includes('image')) return 'image';
      if (content.includes('video')) return 'video';
      if (content.includes('copy')) return 'text';
      
      return 'other';
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
  
    determineChannel(source, medium) {
      // Paid traffic takes precedence
      if (this.paidMediums.some(paidMedium => medium.includes(paidMedium))) {
        return 'paid';
      }
  
      // Check each channel category
      for (const [channel, mediums] of Object.entries(this.channelMediums)) {
        if (mediums.some(m => medium.includes(m))) {
          return channel;
        }
      }
  
      // Special case for social networks
      if (Object.keys(this.socialNetworks).includes(source)) {
        return 'social';
      }
  
      // Special case for search engines
      if (Object.keys(this.searchEngines).includes(source)) {
        return 'search';
      }
  
      return 'other';
    }
  
    isNewSession() {
      const lastTouch = this.getStoredTouches().slice(-1)[0];
      if (!lastTouch) return true;
  
      const timeSinceLastTouch = new Date() - new Date(lastTouch.timestamp);
      return timeSinceLastTouch > this.config.sessionDuration;
    }
  }
  
  // Initialize global tracker instance
  window.globalAttributionTracker = new AttributionTracker({
      storageKey: 'site_attribution',
      sessionDuration: 30 * 60 * 1000,
      attributionWindow: 30 * 24 * 60 * 60 * 1000
  });
  
  // Track attribution on every page
  document.addEventListener('DOMContentLoaded', function() {
      try {
          // Update attribution data
          const attributionData = window.globalAttributionTracker.getAttributionData();
          console.log('Attribution Data Updated:', attributionData);
      } catch (error) {
          console.error('Error updating attribution:', error);
      }
  });
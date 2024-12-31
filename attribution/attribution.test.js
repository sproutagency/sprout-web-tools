class AttributionTester {
    constructor() {
        this.originalReferrer = document.referrer;
        this.originalURL = window.location.href;
        this.originalPathname = window.location.pathname;
    }

    // Simulate different traffic sources
    async testScenarios() {
        console.group('Attribution Testing Suite');
        
        await this.testDirectTraffic();
        await this.testGoogleOrganic();
        await this.testGooglePaid();
        await this.testFacebookOrganic();
        await this.testFacebookPaid();
        await this.testComplexUTM();
        
        this.resetEnvironment();
        console.groupEnd();
    }

    async testDirectTraffic() {
        console.group('Testing Direct Traffic');
        this.mockTrafficSource('', '');
        await this.runTest();
        console.groupEnd();
    }

    async testGoogleOrganic() {
        console.group('Testing Google Organic');
        this.mockTrafficSource('https://www.google.com/search?q=your+website', '');
        await this.runTest();
        console.groupEnd();
    }

    async testGooglePaid() {
        console.group('Testing Google Ads');
        this.mockTrafficSource(
            'https://www.google.com', 
            '?utm_source=google&utm_medium=cpc&utm_campaign=brand&utm_content=responsive&utm_term=brand'
        );
        await this.runTest();
        console.groupEnd();
    }

    async testFacebookOrganic() {
        console.group('Testing Facebook Organic');
        this.mockTrafficSource('https://www.facebook.com/', '');
        await this.runTest();
        console.groupEnd();
    }

    async testFacebookPaid() {
        console.group('Testing Facebook Ads');
        this.mockTrafficSource(
            'https://www.facebook.com', 
            '?utm_source=facebook&utm_medium=paid-social&utm_campaign=awareness&utm_content=video'
        );
        await this.runTest();
        console.groupEnd();
    }

    async testComplexUTM() {
        console.group('Testing Complex UTM Parameters');
        this.mockTrafficSource(
            'https://example.com', 
            '?utm_source=newsletter&utm_medium=email&utm_campaign=winter_sale&utm_content=banner_1&utm_term=shoes'
        );
        await this.runTest();
        console.groupEnd();
    }

    mockTrafficSource(referrer, queryString = '') {
        // Mock referrer
        Object.defineProperty(document, 'referrer', {
            get: () => referrer,
            configurable: true
        });

        // Mock URL and pathname
        const newURL = window.location.origin + this.originalPathname + queryString;
        const mockLocation = {
            ...window.location,
            href: newURL,
            search: queryString,
            pathname: this.originalPathname
        };

        // Create a proxy to handle any location access
        const locationProxy = new Proxy(mockLocation, {
            get: (target, prop) => {
                return target[prop];
            }
        });

        Object.defineProperty(window, 'location', {
            value: locationProxy,
            writable: true,
            configurable: true
        });
    }

    async runTest() {
        // Clear existing attribution data
        localStorage.removeItem('site_attribution');
        
        // Reinitialize tracker with test configuration
        window.globalAttributionTracker = new AttributionTracker({
            storageKey: 'site_attribution',
            sessionDuration: 30 * 60 * 1000,
            attributionWindow: 30 * 24 * 60 * 60 * 1000,
            isTestMode: true // Add this flag to prevent certain initializations
        });
        
        // Get attribution data
        const attributionData = window.globalAttributionTracker.getAttributionData();
        
        // Log results in a table format
        console.log('Test Results:');
        console.table({
            'First Touch Source': attributionData.firstTouch?.source,
            'First Touch Medium': attributionData.firstTouch?.medium,
            'Last Touch Source': attributionData.lastTouch?.source,
            'Last Touch Medium': attributionData.lastTouch?.medium,
            'Campaign': attributionData.lastTouch?.utmParameters?.campaign,
            'Content': attributionData.lastTouch?.utmParameters?.content,
            'Term': attributionData.lastTouch?.utmParameters?.term
        });
        
        // Add small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    resetEnvironment() {
        // Reset referrer
        Object.defineProperty(document, 'referrer', {
            get: () => this.originalReferrer,
            configurable: true
        });

        // Reset URL
        const originalLocation = {
            ...window.location,
            href: this.originalURL,
            search: new URL(this.originalURL).search,
            pathname: this.originalPathname
        };

        Object.defineProperty(window, 'location', {
            value: originalLocation,
            writable: true,
            configurable: true
        });

        // Clear storage
        localStorage.removeItem('site_attribution');
    }

    // Utility to test a custom scenario
    async testCustomScenario(referrer, utmParams) {
        console.group('Testing Custom Scenario');
        this.mockTrafficSource(referrer, this.buildQueryString(utmParams));
        await this.runTest();
        console.groupEnd();
    }

    buildQueryString(utmParams = {}) {
        const params = new URLSearchParams();
        Object.entries(utmParams).forEach(([key, value]) => {
            params.append(`utm_${key}`, value);
        });
        return `?${params.toString()}`;
    }
}

// Initialize tests after a small delay to ensure everything is loaded
setTimeout(() => {
    const tester = new AttributionTester();
    
    // Run all predefined test scenarios
    tester.testScenarios();

    // Test custom scenario
    tester.testCustomScenario(
        'https://twitter.com', 
        {
            source: 'twitter',
            medium: 'social',
            campaign: 'summer_launch'
        }
    );
}, 100); 
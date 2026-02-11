import { defineConfig, devices } from '@playwright/test';

/**
 * Cross-browser testing configuration for SolarEPC Pro
 * Tests design canvas, Leaflet maps, drawing tools, file downloads, and responsive design
 * across Chrome, Firefox, Safari/WebKit, and Edge browsers
 */
export default defineConfig({
    testDir: './src/e2e',

    // Maximum time one test can run
    timeout: 30 * 1000,

    // Test execution settings
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 4 : undefined,

    // Reporter configuration
    reporter: [
        ['html', { outputFolder: 'playwright-report' }],
        ['json', { outputFile: 'playwright-report/results.json' }],
        ['list'],
    ],

    // Shared settings for all tests
    use: {
        // Base URL for the application
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

        // Collect trace on first retry
        trace: 'on-first-retry',

        // Screenshot on failure
        screenshot: 'only-on-failure',

        // Video on first retry
        video: 'retain-on-failure',

        // Action timeout
        actionTimeout: 10 * 1000,

        // Navigation timeout
        navigationTimeout: 15 * 1000,
    },

    // Configure projects for major browsers
    projects: [
        // Desktop Chrome - Latest
        {
            name: 'chromium-latest',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1920, height: 1080 },
                channel: 'chrome',
            },
        },

        // Desktop Chrome - Previous version (simulated via chromium)
        {
            name: 'chromium-previous',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1920, height: 1080 },
            },
        },

        // Desktop Firefox - Latest
        {
            name: 'firefox-latest',
            use: {
                ...devices['Desktop Firefox'],
                viewport: { width: 1920, height: 1080 },
            },
        },

        // Desktop Firefox - Previous version (simulated)
        {
            name: 'firefox-previous',
            use: {
                ...devices['Desktop Firefox'],
                viewport: { width: 1920, height: 1080 },
            },
        },

        // Desktop Safari/WebKit - Latest
        {
            name: 'webkit-latest',
            use: {
                ...devices['Desktop Safari'],
                viewport: { width: 1920, height: 1080 },
            },
        },

        // Desktop Safari/WebKit - Previous version (simulated)
        {
            name: 'webkit-previous',
            use: {
                ...devices['Desktop Safari'],
                viewport: { width: 1920, height: 1080 },
            },
        },

        // Desktop Edge - Latest
        {
            name: 'edge-latest',
            use: {
                ...devices['Desktop Edge'],
                viewport: { width: 1920, height: 1080 },
                channel: 'msedge',
            },
        },

        // Desktop Edge - Previous version (simulated via chromium)
        {
            name: 'edge-previous',
            use: {
                ...devices['Desktop Edge'],
                viewport: { width: 1920, height: 1080 },
            },
        },

        // Tablet viewports
        {
            name: 'tablet-chrome',
            use: {
                ...devices['iPad Pro'],
                viewport: { width: 1024, height: 768 },
            },
        },

        {
            name: 'tablet-safari',
            use: {
                ...devices['iPad Pro'],
                viewport: { width: 1024, height: 768 },
            },
        },

        // Mobile viewports
        {
            name: 'mobile-chrome',
            use: {
                ...devices['Pixel 5'],
                viewport: { width: 393, height: 851 },
            },
        },

        {
            name: 'mobile-safari',
            use: {
                ...devices['iPhone 13'],
                viewport: { width: 390, height: 844 },
            },
        },
    ],

    // Web server configuration for local development
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
        stdout: 'ignore',
        stderr: 'pipe',
    },
});

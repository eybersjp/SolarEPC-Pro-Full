import { Page, expect } from '@playwright/test';

/**
 * Helper utilities for Playwright E2E tests
 */

/**
 * Wait for the Leaflet map to be fully initialized and ready
 */
export async function waitForMapReady(page: Page): Promise<void> {
    // Wait for Leaflet container
    await page.waitForSelector('.leaflet-container', { state: 'visible', timeout: 10000 });

    // Wait for map tiles to load
    await page.waitForSelector('.leaflet-tile-loaded', { timeout: 15000 });

    // Wait for zoom controls
    await page.waitForSelector('.leaflet-control-zoom', { state: 'visible' });

    // Give map a moment to settle
    await page.waitForTimeout(500);
}

/**
 * Draw a polygon on the map by clicking coordinates
 */
export async function drawPolygon(
    page: Page,
    coordinates: Array<{ x: number; y: number }>
): Promise<void> {
    const mapContainer = page.locator('.leaflet-container');

    // Click each coordinate
    for (const coord of coordinates) {
        await mapContainer.click({
            position: { x: coord.x, y: coord.y },
        });
        await page.waitForTimeout(200);
    }

    // Double-click the last point to complete polygon
    await mapContainer.dblclick({
        position: coordinates[coordinates.length - 1],
    });

    await page.waitForTimeout(500);
}

/**
 * Wait for a file download and return the download object
 */
export async function waitForDownload(page: Page, triggerAction: () => Promise<void>) {
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await triggerAction();
    const download = await downloadPromise;
    return download;
}

/**
 * Verify responsive layout at a specific viewport
 */
export async function checkResponsiveLayout(
    page: Page,
    viewport: { width: number; height: number }
): Promise<void> {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(500);

    // Check that content is visible and not overflowing
    const body = page.locator('body');
    const boundingBox = await body.boundingBox();

    expect(boundingBox).toBeTruthy();
    expect(boundingBox!.width).toBeLessThanOrEqual(viewport.width);
}

/**
 * Create a test design with sample data
 */
export async function createTestDesign(page: Page): Promise<string> {
    // Navigate to designs page
    await page.goto('/designs');

    // Click create new design button
    await page.click('button:has-text("New Design")');

    // Fill in design details
    await page.fill('input[name="name"]', `Test Design ${Date.now()}`);
    await page.fill('input[name="address"]', '123 Test Street, Test City');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation to design canvas
    await page.waitForURL(/\/designs\/[a-f0-9-]+/);

    // Extract design ID from URL
    const url = page.url();
    const match = url.match(/\/designs\/([a-f0-9-]+)/);
    return match ? match[1] : '';
}

/**
 * Login as a test user
 */
export async function loginAsTestUser(page: Page): Promise<void> {
    await page.goto('/login');

    // Fill in credentials
    await page.fill('input[type="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD || 'testpassword123');

    // Submit login form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });
}

/**
 * Wait for API request to complete
 */
export async function waitForApiRequest(
    page: Page,
    urlPattern: string | RegExp,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET'
): Promise<void> {
    await page.waitForResponse(
        (response) => {
            const url = response.url();
            const matchesUrl = typeof urlPattern === 'string'
                ? url.includes(urlPattern)
                : urlPattern.test(url);
            return matchesUrl && response.request().method() === method;
        },
        { timeout: 15000 }
    );
}

/**
 * Check if element is in viewport
 */
export async function isInViewport(page: Page, selector: string): Promise<boolean> {
    return await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (!element) return false;

        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }, selector);
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(page: Page, selector: string): Promise<void> {
    await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, selector);
    await page.waitForTimeout(300);
}

/**
 * Get computed style of an element
 */
export async function getComputedStyle(
    page: Page,
    selector: string,
    property: string
): Promise<string> {
    return await page.evaluate(
        ({ sel, prop }) => {
            const element = document.querySelector(sel);
            if (!element) return '';
            return window.getComputedStyle(element).getPropertyValue(prop);
        },
        { sel: selector, prop: property }
    );
}

/**
 * Wait for element to be stable (not animating)
 */
export async function waitForStable(page: Page, selector: string): Promise<void> {
    await page.waitForSelector(selector, { state: 'visible' });

    let previousBox = await page.locator(selector).boundingBox();
    await page.waitForTimeout(100);
    let currentBox = await page.locator(selector).boundingBox();

    let attempts = 0;
    while (
        attempts < 10 &&
        previousBox &&
        currentBox &&
        (previousBox.x !== currentBox.x ||
            previousBox.y !== currentBox.y ||
            previousBox.width !== currentBox.width ||
            previousBox.height !== currentBox.height)
    ) {
        previousBox = currentBox;
        await page.waitForTimeout(100);
        currentBox = await page.locator(selector).boundingBox();
        attempts++;
    }
}

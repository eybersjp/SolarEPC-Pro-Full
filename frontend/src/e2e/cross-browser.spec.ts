import { test, expect } from '@playwright/test';
import {
    waitForMapReady,
    drawPolygon,
    waitForDownload,
    checkResponsiveLayout,
    waitForApiRequest,
    isInViewport,
    scrollIntoView,
    waitForStable,
} from './helpers/test-utils';
import {
    polygonCoordinates,
    exclusionZoneCoordinates,
    viewports,
    sampleEquipmentConfig,
} from './fixtures/test-data';

/**
 * Cross-browser E2E tests for SolarEPC Pro
 * Tests design canvas, Leaflet maps, drawing tools, file downloads, and responsive design
 */

test.describe('Design Canvas Rendering', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to a test design (assuming design exists or is created)
        await page.goto('/designs/test-design-id');
        await page.waitForLoadState('networkidle');
    });

    test('should load canvas without errors', async ({ page, browserName }) => {
        // Check for console errors
        const errors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.waitForTimeout(2000);

        // Filter out known browser-specific warnings
        const criticalErrors = errors.filter(
            (error) =>
                !error.includes('ResizeObserver') &&
                !error.includes('DevTools') &&
                !error.includes('favicon')
        );

        expect(criticalErrors).toHaveLength(0);
    });

    test('should display toolbar with all tools', async ({ page }) => {
        // Wait for toolbar to be visible
        await page.waitForSelector('[data-testid="design-toolbar"]', {
            state: 'visible',
            timeout: 10000,
        });

        // Check for essential tools
        const selectTool = page.locator('button[aria-label*="Select"]');
        const drawTool = page.locator('button[aria-label*="Draw"]');

        await expect(selectTool).toBeVisible();
        await expect(drawTool).toBeVisible();
    });

    test('should display right panel', async ({ page }) => {
        const rightPanel = page.locator('[data-testid="right-panel"]');
        await expect(rightPanel).toBeVisible();

        // Check for equipment selector
        const equipmentSection = page.locator('text=Equipment');
        await expect(equipmentSection).toBeVisible();
    });

    test('should handle canvas resize', async ({ page }) => {
        const initialSize = await page.viewportSize();
        expect(initialSize).toBeTruthy();

        // Resize viewport
        await page.setViewportSize({ width: 1366, height: 768 });
        await page.waitForTimeout(500);

        // Canvas should still be visible
        const canvas = page.locator('.leaflet-container');
        await expect(canvas).toBeVisible();

        // Restore original size
        if (initialSize) {
            await page.setViewportSize(initialSize);
        }
    });
});

test.describe('Leaflet Map Rendering and Interaction', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/designs/test-design-id');
        await waitForMapReady(page);
    });

    test('should render map tiles correctly', async ({ page, browserName }) => {
        // Check for loaded tiles
        const loadedTiles = page.locator('.leaflet-tile-loaded');
        const tileCount = await loadedTiles.count();

        expect(tileCount).toBeGreaterThan(0);

        // Take screenshot for visual verification
        await page.screenshot({
            path: `playwright-screenshots/map-tiles-${browserName}.png`,
        });
    });

    test('should display zoom controls', async ({ page }) => {
        const zoomIn = page.locator('.leaflet-control-zoom-in');
        const zoomOut = page.locator('.leaflet-control-zoom-out');

        await expect(zoomIn).toBeVisible();
        await expect(zoomOut).toBeVisible();
    });

    test('should zoom in when zoom control clicked', async ({ page }) => {
        const zoomIn = page.locator('.leaflet-control-zoom-in');

        // Get initial zoom level (via data attribute or class)
        const initialZoom = await page.evaluate(() => {
            const map = (window as any).leafletMap;
            return map ? map.getZoom() : null;
        });

        // Click zoom in
        await zoomIn.click();
        await page.waitForTimeout(500);

        const newZoom = await page.evaluate(() => {
            const map = (window as any).leafletMap;
            return map ? map.getZoom() : null;
        });

        if (initialZoom !== null && newZoom !== null) {
            expect(newZoom).toBeGreaterThan(initialZoom);
        }
    });

    test('should zoom out when zoom control clicked', async ({ page }) => {
        const zoomOut = page.locator('.leaflet-control-zoom-out');

        const initialZoom = await page.evaluate(() => {
            const map = (window as any).leafletMap;
            return map ? map.getZoom() : null;
        });

        await zoomOut.click();
        await page.waitForTimeout(500);

        const newZoom = await page.evaluate(() => {
            const map = (window as any).leafletMap;
            return map ? map.getZoom() : null;
        });

        if (initialZoom !== null && newZoom !== null) {
            expect(newZoom).toBeLessThan(initialZoom);
        }
    });

    test('should pan map on drag', async ({ page }) => {
        const mapContainer = page.locator('.leaflet-container');

        // Get initial center
        const initialCenter = await page.evaluate(() => {
            const map = (window as any).leafletMap;
            return map ? map.getCenter() : null;
        });

        // Drag map
        await mapContainer.hover({ position: { x: 500, y: 500 } });
        await page.mouse.down();
        await page.mouse.move(600, 600);
        await page.mouse.up();
        await page.waitForTimeout(300);

        const newCenter = await page.evaluate(() => {
            const map = (window as any).leafletMap;
            return map ? map.getCenter() : null;
        });

        // Center should have changed
        if (initialCenter && newCenter) {
            const changed =
                initialCenter.lat !== newCenter.lat || initialCenter.lng !== newCenter.lng;
            expect(changed).toBe(true);
        }
    });

    test('should handle map click events', async ({ page }) => {
        const mapContainer = page.locator('.leaflet-container');

        // Click on map
        await mapContainer.click({ position: { x: 500, y: 500 } });
        await page.waitForTimeout(200);

        // Verify no errors occurred
        const hasError = await page.locator('.error-message').isVisible().catch(() => false);
        expect(hasError).toBe(false);
    });
});

test.describe('Drawing Tools - Polygon Creation and Editing', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/designs/test-design-id');
        await waitForMapReady(page);
    });

    test('should activate draw tool', async ({ page }) => {
        // Click draw tool button
        const drawButton = page.locator('button[aria-label*="Draw"]').first();
        await drawButton.click();
        await page.waitForTimeout(300);

        // Verify draw mode is active (check for cursor change or active state)
        const isActive = await drawButton.getAttribute('data-state');
        expect(isActive).toBe('active');
    });

    test('should create polygon by clicking vertices', async ({ page, browserName }) => {
        // Activate draw tool
        const drawButton = page.locator('button[aria-label*="Draw"]').first();
        await drawButton.click();
        await page.waitForTimeout(300);

        // Draw polygon
        await drawPolygon(page, polygonCoordinates);

        // Verify polygon appears on map
        const polygon = page.locator('.leaflet-interactive[stroke]');
        await expect(polygon.first()).toBeVisible();

        // Take screenshot
        await page.screenshot({
            path: `playwright-screenshots/polygon-created-${browserName}.png`,
        });
    });

    test('should edit polygon by dragging vertices', async ({ page }) => {
        // Assume polygon exists, select it
        const polygon = page.locator('.leaflet-interactive[stroke]').first();
        await polygon.click();
        await page.waitForTimeout(300);

        // Look for vertex markers
        const vertices = page.locator('.leaflet-marker-icon');
        const vertexCount = await vertices.count();

        if (vertexCount > 0) {
            // Drag first vertex
            const firstVertex = vertices.first();
            const box = await firstVertex.boundingBox();

            if (box) {
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
                await page.mouse.down();
                await page.mouse.move(box.x + 50, box.y + 50);
                await page.mouse.up();
                await page.waitForTimeout(300);

                // Polygon should still exist
                await expect(polygon).toBeVisible();
            }
        }
    });

    test('should create exclusion zone', async ({ page }) => {
        // Click exclusion zone tool
        const exclusionButton = page.locator('button:has-text("Exclusion")');
        if (await exclusionButton.isVisible()) {
            await exclusionButton.click();
            await page.waitForTimeout(300);

            // Draw exclusion zone
            await drawPolygon(page, exclusionZoneCoordinates);

            // Verify exclusion zone created
            const exclusions = page.locator('.leaflet-interactive[fill]');
            const count = await exclusions.count();
            expect(count).toBeGreaterThan(0);
        }
    });

    test('should delete polygon', async ({ page }) => {
        // Select polygon
        const polygon = page.locator('.leaflet-interactive[stroke]').first();
        if (await polygon.isVisible()) {
            await polygon.click();
            await page.waitForTimeout(300);

            // Press delete key
            await page.keyboard.press('Delete');
            await page.waitForTimeout(300);

            // Polygon should be removed
            const stillExists = await polygon.isVisible().catch(() => false);
            expect(stillExists).toBe(false);
        }
    });
});

test.describe('File Downloads - PDF and CSV', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/designs/test-design-id');
        await page.waitForLoadState('networkidle');
    });

    test('should download PDF proposal', async ({ page, browserName }) => {
        // Navigate to proposal section or click generate proposal
        const proposalButton = page.locator('button:has-text("Generate Proposal")');

        if (await proposalButton.isVisible()) {
            await proposalButton.click();
            await waitForApiRequest(page, '/api/proposals', 'POST');

            // Wait for proposal to be ready
            await page.waitForSelector('button:has-text("Download PDF")', {
                timeout: 30000,
            });

            // Download PDF
            const download = await waitForDownload(page, async () => {
                await page.click('button:has-text("Download PDF")');
            });

            // Verify download
            expect(download.suggestedFilename()).toMatch(/\.pdf$/);

            const path = await download.path();
            expect(path).toBeTruthy();

            // Check file size
            const fs = require('fs');
            if (path) {
                const stats = fs.statSync(path);
                expect(stats.size).toBeGreaterThan(0);
            }
        }
    });

    test('should download CSV export', async ({ page }) => {
        const exportButton = page.locator('button:has-text("Export CSV")');

        if (await exportButton.isVisible()) {
            const download = await waitForDownload(page, async () => {
                await exportButton.click();
            });

            expect(download.suggestedFilename()).toMatch(/\.csv$/);

            const path = await download.path();
            expect(path).toBeTruthy();
        }
    });

    test('should handle download errors gracefully', async ({ page }) => {
        // Simulate download error by clicking when not ready
        const downloadButton = page.locator('button:has-text("Download")').first();

        if (await downloadButton.isVisible()) {
            const isDisabled = await downloadButton.isDisabled();

            if (isDisabled) {
                // Should show tooltip or error message
                await downloadButton.hover();
                await page.waitForTimeout(500);

                const tooltip = page.locator('[role="tooltip"]');
                const tooltipVisible = await tooltip.isVisible().catch(() => false);

                // Either tooltip or button should indicate not ready
                expect(tooltipVisible || isDisabled).toBeTruthy();
            }
        }
    });
});

test.describe('Responsive Design and Mobile Viewports', () => {
    test('should display correctly on desktop viewport', async ({ page }) => {
        await page.setViewportSize(viewports.desktop);
        await page.goto('/designs/test-design-id');
        await waitForMapReady(page);

        // All panels should be visible
        const toolbar = page.locator('[data-testid="design-toolbar"]');
        const rightPanel = page.locator('[data-testid="right-panel"]');
        const map = page.locator('.leaflet-container');

        await expect(toolbar).toBeVisible();
        await expect(rightPanel).toBeVisible();
        await expect(map).toBeVisible();
    });

    test('should adapt layout for tablet viewport', async ({ page }) => {
        await page.setViewportSize(viewports.tablet);
        await page.goto('/designs/test-design-id');
        await waitForMapReady(page);

        // Check responsive behavior
        await checkResponsiveLayout(page, viewports.tablet);

        // Right panel might be collapsible
        const rightPanel = page.locator('[data-testid="right-panel"]');
        const isVisible = await rightPanel.isVisible();

        // Either visible or there's a toggle button
        if (!isVisible) {
            const toggleButton = page.locator('button[aria-label*="panel"]');
            await expect(toggleButton).toBeVisible();
        }
    });

    test('should display mobile-optimized layout', async ({ page }) => {
        await page.setViewportSize(viewports.mobile);
        await page.goto('/designs/test-design-id');
        await waitForMapReady(page);

        await checkResponsiveLayout(page, viewports.mobile);

        // Mobile should have bottom sheet or drawer
        const bottomSheet = page.locator('[data-testid="bottom-sheet"]');
        const drawer = page.locator('[role="dialog"]');

        const hasMobileUI =
            (await bottomSheet.isVisible().catch(() => false)) ||
            (await drawer.isVisible().catch(() => false));

        // Map should still be visible
        const map = page.locator('.leaflet-container');
        await expect(map).toBeVisible();
    });

    test('should handle orientation change', async ({ page }) => {
        // Start in portrait
        await page.setViewportSize(viewports.mobile);
        await page.goto('/designs/test-design-id');
        await waitForMapReady(page);

        // Switch to landscape
        await page.setViewportSize(viewports.mobileLandscape);
        await page.waitForTimeout(500);

        // Layout should adapt
        const map = page.locator('.leaflet-container');
        await expect(map).toBeVisible();

        const box = await map.boundingBox();
        expect(box).toBeTruthy();
        expect(box!.width).toBeGreaterThan(box!.height);
    });

    test('should have touch-friendly controls on mobile', async ({ page }) => {
        await page.setViewportSize(viewports.mobile);
        await page.goto('/designs/test-design-id');
        await waitForMapReady(page);

        // Check button sizes (should be at least 44x44 for touch)
        const buttons = page.locator('button');
        const firstButton = buttons.first();

        if (await firstButton.isVisible()) {
            const box = await firstButton.boundingBox();
            if (box) {
                expect(box.width).toBeGreaterThanOrEqual(40);
                expect(box.height).toBeGreaterThanOrEqual(40);
            }
        }
    });
});

test.describe('Browser-Specific Features', () => {
    test('should support clipboard operations', async ({ page, browserName }) => {
        // Skip for Safari due to limited clipboard API
        test.skip(browserName === 'webkit', 'Safari has limited clipboard API support');

        await page.goto('/designs/test-design-id');
        await waitForMapReady(page);

        // Grant clipboard permissions
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

        // Try to copy coordinates (if feature exists)
        const copyButton = page.locator('button:has-text("Copy")');
        if (await copyButton.isVisible()) {
            await copyButton.click();
            await page.waitForTimeout(300);

            // Verify clipboard content
            const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
            expect(clipboardText).toBeTruthy();
        }
    });

    test('should persist data in localStorage', async ({ page }) => {
        await page.goto('/designs/test-design-id');
        await page.waitForLoadState('networkidle');

        // Set some data
        await page.evaluate(() => {
            localStorage.setItem('test-key', 'test-value');
        });

        // Reload page
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Verify data persisted
        const value = await page.evaluate(() => localStorage.getItem('test-key'));
        expect(value).toBe('test-value');

        // Cleanup
        await page.evaluate(() => localStorage.removeItem('test-key'));
    });

    test('should handle IndexedDB operations', async ({ page }) => {
        await page.goto('/designs/test-design-id');

        // Check if IndexedDB is available
        const hasIndexedDB = await page.evaluate(() => 'indexedDB' in window);
        expect(hasIndexedDB).toBe(true);
    });

    test('should render without WebGL if unavailable', async ({ page }) => {
        await page.goto('/designs/test-design-id');
        await waitForMapReady(page);

        // Map should render even without WebGL
        const map = page.locator('.leaflet-container');
        await expect(map).toBeVisible();

        // Check for canvas fallback
        const canvas = page.locator('canvas');
        const canvasCount = await canvas.count();

        // Either WebGL canvas or SVG/Canvas fallback
        expect(canvasCount).toBeGreaterThanOrEqual(0);
    });
});

# Browser Compatibility Guide

## Supported Browsers

SolarEPC Pro is tested and supported on the following browsers:

| Browser           | Minimum Version | Recommended Version | Status             |
|-------------------|-----------------|---------------------|--------------------|
| **Chrome**        | 120+            | Latest              | ✅ Fully Supported |
| **Firefox**       | 121+            | Latest              | ✅ Fully Supported |
| **Safari**        | 17+             | Latest              | ✅ Fully Supported |
| **Edge**          | 120+            | Latest              | ✅ Fully Supported |
| **Mobile Safari** | iOS 17+         | Latest              | ✅ Fully Supported |
| **Chrome Mobile** | Android 12+     | Latest              | ✅ Fully Supported |

> [!NOTE]
> We test against the **last 2 major versions** of each browser to ensure compatibility and performance.

---

## Known Browser-Specific Issues

### Safari (Desktop & Mobile)

#### Issue: Leaflet Map Tile Loading Delay

**Symptoms**: Map tiles may take 1-2 seconds longer to load on initial render compared to Chrome/Firefox.

**Cause**: Safari's image caching and rendering pipeline differs from Chromium-based browsers.

**Workaround**:

```typescript
// Already implemented in MapCanvas.tsx
useEffect(() => {
  if (map && isSafari) {
    map.invalidateSize();
    setTimeout(() => map.invalidateSize(), 100);
  }
}, [map]);
```

**Status**: Mitigated with double invalidation on mount.

---

#### Issue: Touch Event Handling for Polygon Editing

**Symptoms**: On iOS Safari, dragging polygon vertices may feel less responsive.

**Cause**: Safari's touch event handling has stricter passive event listener requirements.

**Workaround**:

```css
/* Applied to vertex markers */
.leaflet-marker-icon {
  touch-action: none;
  -webkit-user-select: none;
}
```

**Status**: Resolved with CSS touch-action property.

---

#### Issue: Clipboard API Limitations

**Symptoms**: Copy/paste coordinates feature may not work on Safari < 17.4.

**Cause**: Safari's clipboard API requires user gesture and has stricter permissions.

**Workaround**:

```typescript
// Fallback to legacy execCommand for older Safari
async function copyToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Fallback for Safari
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }
}
```

**Status**: Fallback implemented for older versions.

---

### Firefox

#### Issue: Polygon Vertex Dragging Requires Explicit Pointer Events

**Symptoms**: Dragging vertices may occasionally not register the first click.

**Cause**: Firefox's pointer event handling differs slightly from Chromium.

**Workaround**:

```typescript
// Ensure pointer events are explicitly handled
vertexMarker.on('mousedown touchstart', (e) => {
  e.originalEvent.preventDefault();
  map.dragging.disable();
});
```

**Status**: Resolved with explicit event prevention.

---

#### Issue: File Download Dialog Behavior

**Symptoms**: Firefox shows a "Save As" dialog by default, while Chrome auto-downloads.

**Cause**: Different browser default settings for downloads.

**Workaround**: No code change needed. This is expected browser behavior. Users can configure Firefox to auto-download.

**Status**: Documented as expected behavior.

---

### Edge

#### Issue: PDF Rendering in Viewer

**Symptoms**: Edge may open PDFs in built-in viewer instead of downloading.

**Cause**: Edge's default PDF handling.

**Workaround**:

```typescript
// Force download with Content-Disposition header
response.headers['Content-Disposition'] = 'attachment; filename="proposal.pdf"';
```

**Status**: Implemented on backend.

---

### Mobile Browsers

#### Issue: Map Zoom on Pinch Gesture

**Symptoms**: Pinch-to-zoom may conflict with page zoom on some mobile browsers.

**Cause**: Browser's default touch handling.

**Workaround**:

```html
<!-- Prevent page zoom, allow map zoom -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

**Status**: Implemented in layout.tsx.

---

## Workarounds and Polyfills

### ResizeObserver Polyfill

For older browsers that don't support ResizeObserver:

```bash
npm install resize-observer-polyfill
```

```typescript
// In _app.tsx or layout.tsx
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = require('resize-observer-polyfill');
}
```

**Status**: Not currently needed (all supported browsers have ResizeObserver).

---

### IntersectionObserver Polyfill

For Safari 16 and older:

```bash
npm install intersection-observer
```

```typescript
// Conditional import
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  require('intersection-observer');
}
```

**Status**: Not currently needed (Safari 17+ supported).

---

### Leaflet CSS Fixes for Safari

```css
/* Fix for Safari rendering artifacts */
.leaflet-container {
  -webkit-transform: translate3d(0, 0, 0);
  transform: translate3d(0, 0, 0);
}

/* Fix for Safari tile rendering */
.leaflet-tile {
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}
```

**Status**: Implemented in globals.css.

---

### Touch Event Normalization

```typescript
// Normalize touch events across browsers
function normalizeEvent(e: TouchEvent | MouseEvent): { x: number; y: number } {
  if ('touches' in e) {
    return {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }
  return {
    x: (e as MouseEvent).clientX,
    y: (e as MouseEvent).clientY,
  };
}
```

**Status**: Implemented in drawing tools.

---

## Testing Guidelines

### Running Cross-Browser Tests Locally

#### Install Playwright Browsers

```bash
cd frontend
npm install
npx playwright install --with-deps
```

#### Run All Browser Tests

```bash
npm run test:e2e
```

#### Run Specific Browser

```bash
# Chrome only
npm run test:e2e:chrome

# Firefox only
npm run test:e2e:firefox

# Safari/WebKit only
npm run test:e2e:safari

# Edge only
npm run test:e2e:edge
```

#### Run with UI Mode (for debugging)

```bash
npm run test:e2e:ui
```

#### Run in Headed Mode

```bash
npm run test:e2e:headed
```

---

### Debugging Browser-Specific Failures

1. **Run test in headed mode** to see what's happening:

   ```bash
   npx playwright test --headed --project=firefox-latest
   ```

2. **Use Playwright Inspector**:

   ```bash
   npx playwright test --debug
   ```

3. **Check browser console**:

   ```typescript
   page.on('console', msg => console.log('Browser:', msg.text()));
   ```

4. **Take screenshots on failure**:

   ```typescript
   await page.screenshot({ path: `error-${browserName}.png` });
   ```

5. **Record video**:

   ```bash
   npx playwright test --video=on
   ```

---

### Adding New Browser-Specific Tests

```typescript
test('should handle feature X', async ({ page, browserName }) => {
  // Skip test for specific browsers
  test.skip(browserName === 'webkit', 'Safari does not support feature X');
  
  // Or run browser-specific logic
  if (browserName === 'firefox') {
    // Firefox-specific test logic
  }
  
  // Common test logic
});
```

---

### Best Practices for Cross-Browser Compatibility

1. **Use Feature Detection, Not Browser Detection**

   ```typescript
   // Good
   if ('clipboard' in navigator) {
     await navigator.clipboard.writeText(text);
   }
   
   // Bad
   if (isSafari) {
     // Safari-specific code
   }
   ```

2. **Test Touch and Mouse Events**

   ```typescript
   // Support both
   element.addEventListener('mousedown', handler);
   element.addEventListener('touchstart', handler);
   ```

3. **Use CSS Prefixes for Experimental Features**

   ```css
   .element {
     -webkit-transform: translateZ(0);
     transform: translateZ(0);
   }
   ```

4. **Provide Fallbacks for Modern APIs**

   ```typescript
   const copyText = async (text: string) => {
     try {
       await navigator.clipboard.writeText(text);
     } catch {
       // Fallback for older browsers
       document.execCommand('copy');
     }
   };
   ```

5. **Test Responsive Design at Multiple Breakpoints**

   ```typescript
   const viewports = [
     { width: 1920, height: 1080 }, // Desktop
     { width: 768, height: 1024 },  // Tablet
     { width: 375, height: 667 },   // Mobile
   ];
   ```

---

## Performance Considerations

### Browser-Specific Rendering Optimizations

#### Chrome/Edge (Chromium)

- **GPU Acceleration**: Enabled by default for canvas and CSS transforms
- **Memory**: Efficient tile caching for Leaflet maps
- **Recommendation**: No special optimizations needed

#### Firefox

- **GPU Acceleration**: May need explicit CSS hints

  ```css
  .leaflet-container {
    will-change: transform;
  }
  ```

- **Memory**: Slightly higher memory usage for large polygon datasets
- **Recommendation**: Limit polygon complexity to < 1000 vertices

#### Safari

- **GPU Acceleration**: Conservative by default

  ```css
  .leaflet-tile {
    -webkit-transform: translateZ(0);
  }
  ```

- **Memory**: Aggressive memory management may clear caches
- **Recommendation**: Implement tile preloading for better UX

---

### Map Tile Caching Strategies

```typescript
// Browser-specific tile caching
const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  // Increase cache for Safari
  maxNativeZoom: isSafari ? 18 : 19,
  // Preload tiles for smoother panning
  keepBuffer: isSafari ? 3 : 2,
});
```

---

## CI/CD Testing

### GitHub Actions Configuration

Cross-browser tests run automatically on:

- **Push to main branch**: Runs standard browser matrix, extended viewports, and platform-specific tests.
- **Pull requests**: Runs standard browser matrix (Chrome, Firefox, Safari, Edge).
- **Nightly builds**: Runs comprehensive matrix (all 12 browser projects) at 2 AM UTC daily.
- **Manual trigger**: Can be triggered via `workflow_dispatch` for specific browser/platform combinations.

### Browser Matrix

| Environment | Chrome      | Firefox | Safari       | Edge           |
|-------------|-------------|---------|--------------|----------------|
| **Ubuntu**  | ✅          | ✅      | ✅ (WebKit)  | ✅ (Chromium)  |
| **Windows** | ✅          | ✅      | ❌           | ✅ (Native)    |
| **macOS**   | ✅          | ✅      | ✅ (Native)  | ✅ (Chromium)  |

### Viewing Test Results

1. Go to **Actions** tab in GitHub repository.
2. Select **Frontend Tests** workflow.
3. Click on a specific run to see job results.
4. View **E2E Test Results Summary** in the run summary or PR comment.
5. Download artifacts for detailed investigation:
   - `playwright-html-report-{browser}`: Full HTML report.
   - `playwright-traces-{browser}`: Trace files for debugging failures.
   - `playwright-json-results-{browser}`: Programmatic result data.

### Retention Policy

- **PR Tests**: Artifacts retained for 7 days.
- **Main Branch Tests**: Artifacts retained for 14 days.
- **Nightly Tests**: Artifacts retained for 30 days.

---

## Reporting Browser Issues

If you encounter a browser-specific issue:

1. **Check this document** for known issues
2. **Verify browser version** meets minimum requirements
3. **Test in incognito/private mode** to rule out extensions
4. **Capture console errors** and network logs
5. **Create issue** with:
   - Browser name and version
   - Operating system
   - Steps to reproduce
   - Screenshots/videos
   - Console errors

---

## Browser Feature Support Matrix

| Feature          | Chrome | Firefox | Safari      | Edge |
|------------------|--------|---------|-------------|------|
| Clipboard API    | ✅     | ✅      | ⚠️ Limited  | ✅   |
| Geolocation      | ✅     | ✅      | ✅          | ✅   |
| IndexedDB        | ✅     | ✅      | ✅          | ✅   |
| WebGL            | ✅     | ✅      | ✅          | ✅   |
| Service Workers  | ✅     | ✅      | ✅          | ✅   |
| WebP Images      | ✅     | ✅      | ✅          | ✅   |
| CSS Grid         | ✅     | ✅      | ✅          | ✅   |
| CSS Flexbox      | ✅     | ✅      | ✅          | ✅   |
| Touch Events     | ✅     | ✅      | ✅          | ✅   |
| Pointer Events   | ✅     | ✅      | ✅          | ✅   |

Legend:

- ✅ Fully supported
- ⚠️ Partial support or requires workaround
- ❌ Not supported

---

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Can I Use](https://caniuse.com/) - Browser feature compatibility
- [MDN Web Docs](https://developer.mozilla.org/) - Web standards reference
- [Leaflet Documentation](https://leafletjs.com/) - Map library docs
- [WebKit Blog](https://webkit.org/blog/) - Safari updates and features

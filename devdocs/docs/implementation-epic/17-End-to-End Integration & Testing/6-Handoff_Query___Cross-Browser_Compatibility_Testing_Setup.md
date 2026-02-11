I have the following user query that I want you to help me with. Implement the requested functionality following best practices.

Set up cross-browser testing infrastructure and validate compatibility:

- Configure Playwright for cross-browser testing in frontend/playwright.config.ts
- Create browser compatibility tests in frontend/src/e2e/cross-browser.spec.ts:
  - Test design canvas in Chrome, Firefox, Safari, Edge (last 2 versions)
  - Validate Leaflet map rendering and interaction across browsers
  - Test drawing tools (polygon creation, editing) in all browsers
  - Verify file downloads (PDF, CSV) work correctly
  - Test responsive design and mobile viewport behavior
- Document browser-specific issues and workarounds in frontend/BROWSER_COMPATIBILITY.md
- Add cross-browser test job to `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend.github\workflows\test.yml`
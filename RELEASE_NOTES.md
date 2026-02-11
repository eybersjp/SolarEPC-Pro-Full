# Release Notes - Map-Based Design Canvas

## New Features

- **Interactive Map-Based Design Canvas**: Utilize Leaflet for a responsive design experience.
- **Auto-Placement Algorithm**: Smart module placement based on boundary and exclusion zones.
- **Energy Estimation**: Integration with PVWatts for accurate energy production estimates.
- **Financial Analysis**: ROI calculation, system cost, and payback period analysis.
- **Proposal Generation**: Automated PDF and CSV proposal generation.
- **Design Version Management**: Save, restore, and compare design versions.
- **Auto-Save & Sync**: Robust state management with auto-save and sync status tracking.
- **Cross-Browser Support**: Validated on Chrome, Firefox, Safari, and Edge.

## Performance

- **Placement**: Small sites (<1,000 modules) calculated in <2 seconds.
- **Async Processing**: Large sites processed via background tasks to ensure UI responsiveness.
- **Rendering**: Optimized frontend rendering for 2,000+ modules in <500ms.

## Testing & Quality

- **Backend**: Comprehensive integration test suite (17 tests) covering the full workflow.
- **Frontend**: Component and E2E tests ensuring UI stability.
- **Coverage**: >80% code coverage across critical paths.

## Deployment Notes

- Requires **PVWatts API Key**.
- Requires **Redis** for Celery task queue.
- Requires **WeasyPrint** dependencies (GTK3) for PDF generation.
- See `DEPLOYMENT.md` for full setup instructions.

## Known Issues

- None at time of release.

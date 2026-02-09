I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Create comprehensive unit tests for auto-save functionality:

- Add tests for exponential backoff retry logic in <traycer-file absPath="c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\hooks_*tests*_\useSiteDesigns.test.tsx">frontend/src/hooks/**tests**/useSiteDesigns.test.tsx</traycer-file>
- Test sync state transitions (pending → syncing → synced/failed) in <traycer-file absPath="c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\stores_*tests*_\useDesignCanvasStore.test.ts">frontend/src/stores/**tests**/useDesignCanvasStore.test.ts</traycer-file>
- Test debounced save behavior in <traycer-file absPath="c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas_*tests*_\PlacementSettings.test.tsx">frontend/src/components/DesignCanvas/**tests**/PlacementSettings.test.tsx</traycer-file>
- Test beforeunload handler and unsaved changes warning
- Mock React Query mutations and verify retry attempts with exponential backoff delays
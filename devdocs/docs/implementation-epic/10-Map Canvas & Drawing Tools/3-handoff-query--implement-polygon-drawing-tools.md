I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Add interactive polygon drawing functionality:

- Create `PolygonDrawingLayer` component in frontend/src/components/DesignCanvas/PolygonDrawingLayer.tsx
- Implement click-to-add-vertex interaction (double-click or Enter to complete)
- Add frontend GeoJSON validation using `@turf/turf` before saving
- Show error toasts for invalid polygons (< 3 points, self-intersections)
- Update `FloatingPalette` (`c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\FloatingPalette.tsx`) to trigger drawing modes
- Integrate with `useUpdateSiteDesignMutation` from `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\hooks\useSiteDesigns.ts` for immediate save
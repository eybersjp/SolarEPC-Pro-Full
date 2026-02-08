I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Build the Placement Settings UI with auto-save functionality:

- Create frontend/src/components/DesignCanvas/PlacementSettings.tsx with:
  - Edge setback slider (0.5-5m) using the new Slider component
  - Row spacing slider (1-10m)
  - Orientation toggle (Portrait/Landscape) using Switch component
  - Azimuth dial (0-360°) using Input with number type
  - Live preview values displayed as user adjusts
- Implement debounced auto-save (30 seconds) for settings changes using `useUpdateSiteDesignMutation`
- Add "Recalculate Layout" button that triggers POST /api/site-designs/{id}/recalculate
- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\stores\useDesignCanvasStore.ts` to track placement settings state
- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\RightPanel.tsx` to include PlacementSettings component
- Show full-screen loading overlay during recalculation using existing PlacementLoadingOverlay component
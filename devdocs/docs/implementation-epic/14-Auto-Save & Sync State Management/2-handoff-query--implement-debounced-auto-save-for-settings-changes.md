I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Update placement settings to use 30-second debounced auto-save:

- Modify `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\PlacementSettings.tsx` to change debounce delay from 3 seconds to 30 seconds
- Add immediate save for critical operations (boundary/exclusion drawing) in `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\PolygonDrawingLayer.tsx`
- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\EquipmentSelector.tsx` to use debounced save for equipment changes
- Ensure sync state is set to 'pending' immediately when settings change, before debounce completes
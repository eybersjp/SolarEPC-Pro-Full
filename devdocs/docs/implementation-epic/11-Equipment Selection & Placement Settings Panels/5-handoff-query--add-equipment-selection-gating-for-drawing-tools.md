I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Implement equipment selection requirement for drawing tools:

- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\FloatingPalette.tsx` to disable drawing tools when equipment is not selected
- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\stores\useDesignCanvasStore.ts` to track equipment selection state
- Show tooltip or message on disabled tools: "Select equipment to enable drawing tools"
- Enable tools automatically when both module and inverter are selected
- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\MapCanvas.tsx` to prevent drawing when equipment is not selected
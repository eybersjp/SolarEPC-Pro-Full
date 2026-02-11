I have the following user query that I want you to help me with. Implement the requested functionality following best practices.

Create end-to-end frontend integration tests for the design canvas user journey:

- Add integration test in frontend/src/components/DesignCanvas/**tests**/e2eDesignWorkflow.test.tsx covering the complete flow from `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\app\tenders[id]\page.tsx` → Designs tab → Create design → Equipment selection → Drawing → Placement → Results → Proposal
- Test component integration: `DesignsList` → `CanvasLayout` → `EquipmentSelector` → `PolygonDrawingLayer` → `PlacementSettings` → `ResultsBottomSheet` → `ProposalWizard`
- Verify state management with `useDesignCanvasStore` and React Query hooks (`useSiteDesigns`, `useEquipment`, `useProposal`)
- Test auto-save functionality, sync state transitions, and error recovery
- Use MSW handlers from `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\test\mocks\handlers.ts` and fixtures from `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\test\fixtures`
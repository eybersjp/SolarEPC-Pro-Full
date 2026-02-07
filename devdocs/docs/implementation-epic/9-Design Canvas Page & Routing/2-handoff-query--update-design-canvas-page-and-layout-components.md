I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Update the design canvas page to use site designs:

- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\app\tenders[id]\design[designId]\page.tsx` to use `useSiteDesignQuery` instead of `useDesignQuery`
- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\Toolbar.tsx` to show design name and add "Generate Proposal" button
- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\RightPanel.tsx` to show equipment selection and placement settings panels (placeholder UI for now, actual implementation is out of scope)
- Update `c:\Users\SSTECH\developments\apps\solarepc-pro\frontend\src\components\DesignCanvas\FloatingPalette.tsx` to match the wireframe tools (Draw Roof, Draw Ground, Draw Carport, Draw Exclusion)
- Ensure beforeunload handler warns about unsaved changes when syncState is not 'synced'
I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Add basic editing capabilities for drawn polygons:

- Create `PolygonEditLayer` component in frontend/src/components/DesignCanvas/PolygonEditLayer.tsx
- Enable edit mode when "Edit" tool is selected from FloatingPalette
- Allow vertex selection and basic manipulation (click to select, drag to move)
- Validate edited polygons before saving
- Implement optimistic updates with rollback on validation failure
- Add visual feedback for selected vertices and edges
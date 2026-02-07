I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

Display existing geometries on the map:

- Create `GeometryLayer` component in frontend/src/components/DesignCanvas/GeometryLayer.tsx
- Render site boundary polygons with semi-transparent fill (distinct styling for roof/ground/carport)
- Render exclusion zones with darker shading
- Render module placements as small rectangles from GeoJSON
- Add layer toggle controls for showing/hiding different geometry types
- Update MapCanvas to include GeometryLayer with data from `useSiteDesignQuery`
# Map Canvas & Drawing Tools

## Objective

Implement interactive map canvas with React-Leaflet and polygon drawing tools for site boundaries and exclusions.

## Scope

**In Scope:**
- React-Leaflet map component with OpenStreetMap tiles
- Floating tool palette: Draw Roof, Draw Ground, Draw Carport, Draw Exclusion, Edit
- Polygon drawing interaction (click to place vertices, double-click to complete)
- Frontend GeoJSON validation using @turf/turf
- Display site boundary, exclusions, and module placements on map
- Map controls: zoom, pan, layer toggle
- Immediate save for boundary/exclusion changes

**Out of Scope:**
- Module placement rendering (handled by auto-placement ticket)
- Advanced editing (vertex dragging - can be basic for Phase 1)
- 3D visualization (Phase 2)

## Acceptance Criteria

- [ ] React-Leaflet map displays OpenStreetMap satellite tiles
- [ ] Map centers on tender lat/long coordinates
- [ ] Floating tool palette with 5 tools (roof, ground, carport, exclusion, edit)
- [ ] Tool selection updates Zustand store and changes cursor
- [ ] Polygon drawing: click to add vertices, double-click or Enter to complete
- [ ] Frontend validation: @turf/turf checks polygon validity before saving
- [ ] Invalid polygons show error toast: "Boundary must have at least 3 points" or "Polygon cannot intersect itself"
- [ ] Site boundary and exclusions render on map with distinct styling
- [ ] Module placements render as small rectangles (from GeoJSON)
- [ ] Immediate save to backend when boundary/exclusion completed
- [ ] Optimistic update: polygon appears immediately, syncs in background
- [ ] Edit tool allows basic vertex manipulation
- [ ] Unit tests for drawing logic and validation

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: MapCanvas Component, GeoJSON Validation
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Flow 2 (Site Type & Drawing), Flow 3 (Adjust Layout)

## Dependencies

- Ticket: Design Canvas Page & Routing
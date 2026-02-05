# Equipment Selection & Placement Settings Panels

## Objective

Implement right panel UI for equipment selection and placement settings configuration.

## Scope

**In Scope:**
- Equipment Configuration section: searchable dropdowns for modules and inverters
- Display selected equipment specifications
- Placement Settings section: sliders for setback/spacing, toggle for orientation, dial for azimuth
- "Recalculate Layout" button
- Settings changes update Zustand store (debounced save for settings, immediate for equipment)
- Panel collapse/expand functionality

**Out of Scope:**
- Equipment library management UI (admin feature, separate ticket if needed)
- Advanced settings (tilt is fixed based on site_type)

## Acceptance Criteria

- [ ] Right panel with two sections: Equipment Configuration, Placement Settings
- [ ] Equipment dropdowns fetch from `GET /api/equipment/modules` and `/api/equipment/inverters`
- [ ] Searchable dropdowns (filter by manufacturer, model, wattage)
- [ ] Selected equipment specs displayed (wattage, dimensions, efficiency, capacity)
- [ ] Equipment selection enables drawing tools (gates drawing until equipment selected)
- [ ] Equipment change triggers immediate save and recalculation
- [ ] Placement settings: edge setback slider (0.5-5m), row spacing slider (1-10m), orientation toggle, azimuth dial (0-360°)
- [ ] Settings show live preview values as user adjusts
- [ ] Settings changes debounced to 30 seconds for auto-save
- [ ] "Recalculate Layout" button triggers `POST /api/site-designs/{id}/recalculate`
- [ ] Full-screen loading overlay during recalculation
- [ ] Panel collapse/expand toggle works
- [ ] Unit tests for component logic

## Technical References

- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/45ed4022-b415-4778-8bb8-febc85f19df9` - Tech Plan: Equipment Selection Panel, Placement Settings Panel
- `spec:56e1ef8e-0c2e-42d1-a477-ed6c411cf46a/f040b177-a20b-4165-a77a-cb6602a7313b` - Core Flows: Flow 2 (Equipment Selection), Flow 3 (Adjust Layout)

## Dependencies

- Ticket: Design Canvas Page & Routing
- Ticket: Equipment Library Service & API (provides equipment data)
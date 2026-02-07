I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

## Observations

The project is a Next.js 14 application using TypeScript, React Query, Zustand, and Tailwind CSS. Currently, no map libraries are installed. The design canvas infrastructure is already in place with `CanvasLayout`, `FloatingPalette`, `Toolbar`, and `RightPanel` components. The `useSiteDesignQuery` hook fetches design data including GeoJSON polygons for site boundaries. The project follows a clean architecture with separation of concerns: API clients in `lib/api.ts`, hooks in `hooks/`, and state management via Zustand stores.

## Approach

This phase focuses solely on installing and configuring the foundational map dependencies without implementing any UI components. The approach involves: (1) adding the required npm packages for React-Leaflet and GeoJSON utilities, (2) configuring Leaflet CSS imports in the root layout to ensure map tiles render correctly, and (3) creating a centralized map configuration utility file that defines default tile layers, zoom levels, and map settings. This establishes the foundation for subsequent phases where the MapCanvas component will be implemented.

## Implementation Steps

### 1. Install Map and GeoJSON Dependencies

Add the following packages to `file:frontend/package.json` in the `dependencies` section:

```json
"react-leaflet": "^4.2.1",
"leaflet": "^1.9.4",
"@turf/turf": "^7.1.0"
```

Add TypeScript type definitions to the `devDependencies` section:

```json
"@types/leaflet": "^1.9.12"
```

Run `npm install` to install the new dependencies.

**Rationale**: React-Leaflet provides React bindings for Leaflet maps, Leaflet is the core mapping library, @turf/turf provides GeoJSON manipulation and validation utilities, and @types/leaflet ensures TypeScript support.

---

### 2. Configure Leaflet CSS in Root Layout

In `file:frontend/src/app/layout.tsx`, add the Leaflet CSS import at the top of the file, after the existing imports but before the metadata export:

Add this import statement:
```typescript
import "leaflet/dist/leaflet.css";
```

The import order should be:
1. Next.js type imports
2. `"./globals.css"`
3. **`"leaflet/dist/leaflet.css"`** (new)
4. Component imports (`QueryProvider`, `AuthProvider`, etc.)

**Rationale**: Leaflet requires its CSS to be loaded globally for proper rendering of map controls, markers, and tiles. Importing it in the root layout ensures it's available throughout the application. The CSS must be imported before component usage to prevent styling issues.

---

### 3. Create Map Configuration Utility File

Create a new file `file:frontend/src/lib/mapConfig.ts` with the following configuration:

**File Structure**:
- Export a `MAP_CONFIG` constant object containing:
  - `defaultCenter`: Default latitude/longitude coordinates (use `[0, 0]` as fallback)
  - `defaultZoom`: Default zoom level (use `13` for site-level view)
  - `minZoom`: Minimum allowed zoom (use `3`)
  - `maxZoom`: Maximum allowed zoom (use `20`)
  - `tileLayer`: Object with tile layer configuration
    - `url`: OpenStreetMap tile URL template (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`)
    - `attribution`: Attribution string for OpenStreetMap
    - `maxZoom`: Maximum zoom for tiles (`19`)

- Export a `SATELLITE_TILE_LAYER` constant object for satellite imagery:
  - `url`: Esri World Imagery tile URL (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`)
  - `attribution`: Attribution string for Esri
  - `maxZoom`: Maximum zoom for satellite tiles (`19`)

- Export a `getTileLayerConfig` function that accepts a `type` parameter (`'standard' | 'satellite'`) and returns the appropriate tile layer configuration

- Export a `getMapBounds` utility function that accepts a GeoJSON polygon and returns Leaflet LatLngBounds for fitting the map view to the polygon

**TypeScript Types**:
- Define a `TileLayerConfig` interface with `url`, `attribution`, and `maxZoom` properties
- Define a `MapConfig` interface for the main configuration object

**Rationale**: Centralizing map configuration ensures consistency across the application and makes it easy to switch between tile providers or adjust default settings. The utility functions will be used by the MapCanvas component in subsequent phases.

---

### 4. Verification Checklist

After completing the above steps, verify:

- [ ] All four packages are listed in `package.json` with correct version numbers
- [ ] `node_modules` contains the installed packages
- [ ] No TypeScript errors in the project
- [ ] Leaflet CSS import is present in `layout.tsx` before component imports
- [ ] `mapConfig.ts` file exists in `file:frontend/src/lib/` directory
- [ ] `mapConfig.ts` exports all required constants and functions with proper TypeScript types
- [ ] No runtime errors when running `npm run dev`

**Note**: This phase does not include any UI implementation. The MapCanvas component will be created in the next phase using these configurations.
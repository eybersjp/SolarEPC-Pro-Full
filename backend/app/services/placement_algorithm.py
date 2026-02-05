import math
from typing import List, Dict, Any, Tuple, Optional
from shapely.geometry import Polygon, Point, box, shape, mapping
from shapely.affinity import rotate, translate
from shapely.ops import transform
import pyproj
from functools import partial
import geojson

class PlacementAlgorithmService:
    """
    Core algorithm for solar module placement.
    Uses grid-fill approach with Shapely for geometry operations.
    """
    
    @staticmethod
    def _get_projection(centroid_lat: float, centroid_lon: float):
        """Get local AEA projection transformer."""
        # WGS84 to Local AEA
        proj_str = f"+proj=aea +lat_1={centroid_lat} +lat_2={centroid_lat} +lat_0={centroid_lat} +lon_0={centroid_lon}"
        wgs84 = pyproj.Proj('epsg:4326')
        local = pyproj.Proj(proj_str)
        
        project_to_meters = partial(pyproj.transform, wgs84, local)
        project_to_wgs84 = partial(pyproj.transform, local, wgs84)
        
        return project_to_meters, project_to_wgs84

    @staticmethod
    def calculate_placement(
        site_boundary: Dict[str, Any],
        exclusion_zones: List[Dict[str, Any]],
        module_dims: Dict[str, float],
        settings: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculate module placement. 
        Projects WGS84 GeoJSON to local meters, fills grid, projects back.
        """
        # 1. Parse Geometry & Project
        boundary_shape = shape(site_boundary)
        centroid = boundary_shape.centroid
        
        to_meters, to_wgs84 = PlacementAlgorithmService._get_projection(centroid.y, centroid.x)
        
        boundary_poly = transform(to_meters, boundary_shape)
        exclusions = [transform(to_meters, shape(zone)) for zone in exclusion_zones]
        
        # 2. Apply Setbacks (in meters)
        setback = settings.get('edge_setback_m', 1.0)
        # buffer with negative distance
        safe_area = boundary_poly.buffer(-setback)
        
        if safe_area.is_empty:
            return {
                "module_placements": [],
                "total_modules": 0,
                "stats": {"error": "Setback too large, no placement area remaining"}
            }

        # 3. Determine Module Footprint
        l_m = module_dims['length_m']
        w_m = module_dims['width_m']
        orientation = settings.get('module_orientation', 'portrait')
        
        if orientation == 'portrait':
            mod_x = w_m
            mod_y = l_m
        else:
            mod_x = l_m
            mod_y = w_m
            
        row_spacing = settings.get('row_spacing_m', 0.5)
        azimuth = settings.get('azimuth_deg', 180.0)
        
        # 4. Grid Generation
        # Azimuth 180 = South. Rows E-W.
        # Rotate safe_area by (180 - azimuth) to align rows with X-axis.
        rotation_angle = 180.0 - azimuth
        
        # Use centroid of the PROJECTED boundary as origin for rotation
        origin = boundary_poly.centroid
        
        rotated_area = rotate(safe_area, rotation_angle, origin=origin)
        rotated_exclusions = [rotate(ex, rotation_angle, origin=origin) for ex in exclusions]
        
        min_x, min_y, max_x, max_y = rotated_area.bounds
        
        valid_placements = []
        
        # Grid loop
        y = min_y
        while y + mod_y <= max_y:
            x = min_x
            row_placements = []
            
            while x + mod_x <= max_x:
                mod_poly = box(x, y, x + mod_x, y + mod_y)
                
                # Check containment & exclusions
                if rotated_area.contains(mod_poly):
                    intersects_exclusion = False
                    for ex in rotated_exclusions:
                        if ex.intersects(mod_poly):
                            intersects_exclusion = True
                            break
                    
                    if not intersects_exclusion:
                        row_placements.append(mod_poly)
                
                x += mod_x + 0.02 # 2cm gap
            
            valid_placements.extend(row_placements)
            y += mod_y + row_spacing
            
        # 5. Transform back
        final_features = []
        
        for poly in valid_placements:
            # Rotate back
            unrotated_poly = rotate(poly, -rotation_angle, origin=origin)
            
            # Project back to WGS84
            wgs84_poly = transform(to_wgs84, unrotated_poly)
            
            # GeoJSON Feature
            # shapely.geometry.mapping returns dict with 'type' and 'coordinates'
            geometry = mapping(wgs84_poly)
            
            feature = {
                "type": "Feature",
                "geometry": geometry,
                "properties": {"type": "module"}
            }
            final_features.append(feature)
            
        return {
            "module_placements": final_features,
            "total_modules": len(final_features),
            "stats": {
                "safe_area_sqm": safe_area.area,
                "boundary_area_sqm": boundary_poly.area
            }
        }

from typing import Tuple, Optional, Dict, Any
import json
from shapely.geometry import shape, Polygon
from shapely.validation import explain_validity
from shapely.ops import transform
import pyproj
from functools import partial

def validate_geojson_polygon(geojson_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate a GeoJSON Polygon.
    
    Checks:
    - Structure (type="Polygon", coordinates list)
    - Closure (first point == last point)
    - Minimum vertices (4 points for a closed triangle)
    - Geometric validity (self-intersection etc via Shapely)
    
    Returns:
        (True, None) if valid
        (False, error_message) if invalid
    """
    try:
        # 1. Structure Check
        if geojson_data.get("type") != "Polygon":
            return False, "GeoJSON type must be 'Polygon'"
        
        coordinates = geojson_data.get("coordinates")
        if not coordinates or not isinstance(coordinates, list):
            return False, "Invalid coordinates structure"
        
        # Check exterior ring
        exterior_ring = coordinates[0]
        if len(exterior_ring) < 4:
            return False, "Polygon must have at least 3 vertices (4 coordinates including closure)"
            
        if exterior_ring[0] != exterior_ring[-1]:
            return False, "Polygon must be closed (first and last coordinates must match)"
            
        # 2. Coordinate Range Check (Basic) - assumes WGS84
        for ring in coordinates:
            for pt in ring:
                if not (-180 <= pt[0] <= 180) or not (-90 <= pt[1] <= 90):
                    return False, f"Invalid coordinate values: {pt}"

        # 3. Geometric Validity via Shapely
        shapely_poly = shape(geojson_data)
        
        if not shapely_poly.is_valid:
            return False, f"Invalid geometry: {explain_validity(shapely_poly)}"
            
        if shapely_poly.is_empty:
             return False, "Geometry is empty"

        return True, None

    except Exception as e:
        return False, f"Validation error: {str(e)}"


def calculate_polygon_area_sqm(geojson_data: Dict[str, Any]) -> float:
    """
    Calculate area in square meters for a GeoJSON Polygon.
    Uses an equal-area projection for accurate results on a sphere.
    """
    try:
        geom = shape(geojson_data)
        
        # Define a projection function which projects from WGS84 to an appropriate local efficient projection
        # For global usage, an equal area projection like Albers Equal Area is often used,
        # but simpler for small areas is using a UTM zone or Web Mercator (less accurate for area).
        # A robust dynamic method is to project to a local AEA based on the polygon's centroid.
        
        # Using pyproj Transformer (modern API)
        from pyproj import Transformer
        
        lon, lat = geom.centroid.x, geom.centroid.y
        
        # Define the projection: Albers Equal Area customized for the polygon's location
        proj_str = f"+proj=aea +lat_1={lat} +lat_2={lat} +lat_0={lat} +lon_0={lon}"
        
        transformer = Transformer.from_proj(
            "epsg:4326", # Source
            proj_str,    # Target
            always_xy=True
        )
        
        project = transformer.transform
        
        geom_transformed = transform(project, geom)
        return geom_transformed.area
        
    except Exception as e:
        # Fallback or re-raise depending on strictness. For now, we assume valid input via validation first.
        # Minimal fallback could be 0.0 or raising.
        print(f"Area calc error: {e}")
        return 0.0

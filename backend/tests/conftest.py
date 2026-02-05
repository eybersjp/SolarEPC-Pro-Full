import sys
from unittest.mock import MagicMock

# Function to create a mock module
def mock_module(name):
    m = MagicMock()
    m.__spec__ = MagicMock()
    m.__spec__.name = name
    return m

# Mock shapely if it fails to import (or always to be safe/fast)
try:
    import shapely
except ImportError:
    sys.modules["shapely"] = mock_module("shapely")
    sys.modules["shapely.geometry"] = mock_module("shapely.geometry")
    
    # Mock specific classes used
    sys.modules["shapely.geometry"].Polygon = MagicMock()
    sys.modules["shapely.geometry"].Point = MagicMock()
    sys.modules["shapely.geometry"].box = MagicMock()
    sys.modules["shapely.geometry"].shape = MagicMock()
    sys.modules["shapely.geometry"].mapping = MagicMock()

try:
    import pyproj
except ImportError:
    sys.modules["pyproj"] = mock_module("pyproj")

try:
    import geojson
except ImportError:
    sys.modules["geojson"] = mock_module("geojson")

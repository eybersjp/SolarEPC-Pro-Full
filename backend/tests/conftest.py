import os
# Force eager execution for all tests to avoid Redis dependency
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "True"
os.environ["CELERY_ALWAYS_EAGER"] = "True"

import sys
import matplotlib
matplotlib.use('Agg')
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
try:
    import boto3
except ImportError:
    sys.modules["boto3"] = mock_module("boto3")
    sys.modules["botocore"] = mock_module("botocore")
    sys.modules["botocore.exceptions"] = mock_module("botocore.exceptions")

try:
    import jinja2
except ImportError:
    m = mock_module("jinja2")
    m.Environment = MagicMock
    m.FileSystemLoader = MagicMock
    sys.modules["jinja2"] = m

try:
    import weasyprint
    import weasyprint.text.ffi # Trigger OSError if DLLs missing
except (ImportError, OSError):
    m = mock_module("weasyprint")
    m.HTML = MagicMock
    sys.modules["weasyprint"] = m

try:
    import firebase_admin
except ImportError:
    m = mock_module("firebase_admin")
    m.credentials = MagicMock()
    m.initialize_app = MagicMock()
    m.auth = MagicMock()
    sys.modules["firebase_admin"] = m
    sys.modules["firebase_admin.credentials"] = m.credentials
    sys.modules["firebase_admin.auth"] = m.auth

try:
    import matplotlib
    import matplotlib.pyplot # Trigger OSError
except (ImportError, OSError):
    m = mock_module("matplotlib")
    m.pyplot = MagicMock()
    sys.modules["matplotlib"] = m
    sys.modules["matplotlib.pyplot"] = m.pyplot

import pytest

@pytest.fixture(autouse=True)
def mock_celery_for_tests(monkeypatch):
    """Configure Celery for synchronous execution in tests"""
    monkeypatch.setenv("CELERY_TASK_ALWAYS_EAGER", "True")
    monkeypatch.setenv("CELERY_ALWAYS_EAGER", "True") # Keep for backward compatibility if needed
    monkeypatch.setenv("CELERY_EAGER_PROPAGATES", "True")


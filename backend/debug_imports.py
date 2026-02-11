import sys
import os

print(f"Current directory: {os.getcwd()}")
print(f"Python path: {sys.path}")

try:
    from app.main import app
    print("Successfully imported app.main")
except ImportError as e:
    print(f"Failed to import app.main: {e}")
    import traceback
    traceback.print_exc()

try:
    import weasyprint
    print("Successfully imported weasyprint")
except ImportError as e:
    print(f"Failed to import weasyprint: {e}")

try:
    import shapely
    print("Successfully imported shapely")
except ImportError as e:
    print(f"Failed to import shapely: {e}")

try:
    from app.core.config import settings
    print("Successfully imported app.core.config")
except ImportError as e:
    print(f"Failed to import app.core.config: {e}")

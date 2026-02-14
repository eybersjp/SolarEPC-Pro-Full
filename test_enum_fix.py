
from app.models.models import SiteDesign, ModuleOrientation, SiteType
import json

def test_enum_serialization():
    try:
        # Create a SiteDesign instance
        sd = SiteDesign(
            name="Test Design",
            site_type=SiteType.ROOFTOP,
            module_orientation=ModuleOrientation.LANDSCAPE
        )
        
        print(f"Raw module_orientation: {sd.module_orientation}")
        print(f"Type of raw module_orientation: {type(sd.module_orientation)}")
        
        settings = sd.placement_settings
        print(f"placement_settings: {settings}")
        
        mo = settings.get("module_orientation")
        print(f"module_orientation in settings: {mo}")
        print(f"Type of module_orientation in settings: {type(mo)}")
        
        # Test JSON serialization
        json_output = json.dumps(settings)
        print(f"JSON Output: {json_output}")
        
        if isinstance(mo, str) and not isinstance(mo, ModuleOrientation):
             print("SUCCESS: module_orientation is a primitive string.")
        elif isinstance(mo, ModuleOrientation):
             print("WARNING: module_orientation is an Enum instance (inherits from str).")
             # Since ModuleOrientation inherits from str, isinstance(mo, str) is True.
             # We want to ensure it's effectively treated as a value, but if it is an Enum member, it is STILL a string.
             # However, some serializers might treat Enum members differently.
             # The fix uses .value, which returns the pure string value.
             print(f"Is it exactly 'landscape'? {mo == 'landscape'}")
        else:
             print("FAILURE: Unknown type.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_enum_serialization()

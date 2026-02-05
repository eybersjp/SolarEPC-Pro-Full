from typing import List, Tuple
from app.schemas.helio_prep import InputDataset, ValidationResult, ValidationFlag, NormalizedDataset, LoadProfileEntry, UnitType
import statistics

class HelioPrepService:
    @staticmethod
    def validate_input_data(data: InputDataset) -> ValidationResult:
        flags = []
        
        # Check for site data
        if not data.site_data.utility_name:
            flags.append(ValidationFlag(field="site_data.utility_name", message="Utility name is missing", severity="error"))
        
        if not data.site_data.tariff_name:
            flags.append(ValidationFlag(field="site_data.tariff_name", message="Tariff name is missing", severity="error"))

        # Check for utility bills consistency
        if data.utility_bills:
            total_kwh = sum(bill.consumption_kwh for bill in data.utility_bills)
            if total_kwh <= 0:
                flags.append(ValidationFlag(field="utility_bills", message="Total consumption must be greater than zero", severity="error"))
            
            # Check for gaps in dates (simplified)
            # In a real app, we'd sort and check for continuity
        
        # Check for load profile consistency
        if data.load_profile:
            # Basic sanity check: no negative values
            if any(entry.value < 0 for entry in data.load_profile):
                flags.append(ValidationFlag(field="load_profile", message="Load profile contains negative values", severity="error"))

        is_valid = not any(flag.severity == "error" for flag in flags)
        return ValidationResult(is_valid=is_valid, flags=flags)

    @staticmethod
    def normalize_data(data: InputDataset) -> NormalizedDataset:
        # Normalize unit logic
        normalized_profile = []
        for entry in data.load_profile:
            val = entry.value
            if entry.unit == UnitType.MW:
                val *= 1000
                unit = UnitType.KW
            elif entry.unit == UnitType.MWH:
                val *= 1000
                unit = UnitType.KWH
            else:
                unit = entry.unit
            
            normalized_profile.append(LoadProfileEntry(timestamp=entry.timestamp, value=val, unit=unit))

        # Calculate summaries
        annual_cons = sum(entry.value for entry in normalized_profile if entry.unit in [UnitType.KWH, UnitType.MWH])
        peak_demand = max((entry.value for entry in normalized_profile if entry.unit in [UnitType.KW, UnitType.MW]), default=0.0)
        
        # If no load profile, use bills
        if not annual_cons and data.utility_bills:
            annual_cons = sum(bill.consumption_kwh for bill in data.utility_bills)
            peak_demand = max((bill.demand_kw for bill in data.utility_bills if bill.demand_kw), default=0.0)

        return NormalizedDataset(
            site_id=data.site_data.meter_number or "unknown",
            normalized_load_profile=normalized_profile,
            annual_consumption_kwh=annual_cons,
            peak_demand_kw=peak_demand,
            standardized_tariff_name=data.site_data.tariff_name.strip().upper()
        )

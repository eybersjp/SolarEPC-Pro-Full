"""
Seed script for global equipment library.
"""
import uuid
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.models import EquipmentModule, EquipmentInverter


def seed_equipment():
    db = SessionLocal()
    try:
        # Seed Modules
        modules = [
            {
                "manufacturer": "Jinko Solar",
                "model": "Tiger Neo N-type 54HL4-V 430W",
                "wattage": 430,
                "efficiency": 22.02,
                "length_m": 1.722,
                "width_m": 1.134,
                "thickness_m": 0.030,
                "voc": 39.16,
                "isc": 13.73,
                "vmp": 32.39,
                "imp": 13.28,
                "is_global": True,
            },
            {
                "manufacturer": "Canadian Solar",
                "model": "HiKu6 CS6W-550MS 550W",
                "wattage": 550,
                "efficiency": 21.5,
                "length_m": 2.278,
                "width_m": 1.134,
                "thickness_m": 0.035,
                "voc": 49.6,
                "isc": 14.0,
                "vmp": 41.7,
                "imp": 13.2,
                "is_global": True,
            },
            {
                "manufacturer": "Longi Solar",
                "model": "Hi-MO 5m LR5-54HPH 415W",
                "wattage": 415,
                "efficiency": 21.3,
                "length_m": 1.722,
                "width_m": 1.134,
                "thickness_m": 0.030,
                "voc": 37.45,
                "isc": 13.85,
                "vmp": 31.25,
                "imp": 13.28,
                "is_global": True,
            },
            {
                "manufacturer": "Trina Solar",
                "model": "Vertex S+ TSM-430NEG9R.28 430W",
                "wattage": 430,
                "efficiency": 21.5,
                "length_m": 1.762,
                "width_m": 1.134,
                "thickness_m": 0.030,
                "voc": 51.4,
                "isc": 10.59,
                "vmp": 43.2,
                "imp": 9.96,
                "is_global": True,
            },
            {
                "manufacturer": "JA Solar",
                "model": "JAM72S30-545/MR 545W",
                "wattage": 545,
                "efficiency": 21.1,
                "length_m": 2.279,
                "width_m": 1.134,
                "thickness_m": 0.035,
                "voc": 49.75,
                "isc": 13.93,
                "vmp": 41.80,
                "imp": 13.04,
                "is_global": True,
            }
        ]

        for m_data in modules:
            module = db.query(EquipmentModule).filter_by(model=m_data["model"]).first()
            if not module:
                module = EquipmentModule(**m_data)
                db.add(module)
        
        # Seed Inverters
        inverters = [
            {
                "manufacturer": "Huawei",
                "model": "SUN2000-10KTL-M1",
                "capacity_kw": 10.0,
                "max_dc_voltage": 1100.0,
                "mppt_voltage_range_min": 140.0,
                "mppt_voltage_range_max": 980.0,
                "max_input_current": 11.0,
                "num_mppt_channels": 2,
                "is_global": True,
            },
            {
                "manufacturer": "Solis",
                "model": "S6-GR1P5K",
                "capacity_kw": 5.0,
                "max_dc_voltage": 600.0,
                "mppt_voltage_range_min": 90.0,
                "mppt_voltage_range_max": 520.0,
                "max_input_current": 14.0,
                "num_mppt_channels": 2,
                "is_global": True,
            },
            {
                "manufacturer": "Suntech",
                "model": "STP-5000TL",
                "capacity_kw": 5.0,
                "max_dc_voltage": 600.0,
                "mppt_voltage_range_min": 100.0,
                "mppt_voltage_range_max": 580.0,
                "max_input_current": 12.0,
                "num_mppt_channels": 2,
                "is_global": True,
            },
            {
                "manufacturer": "Sungrow",
                "model": "SG10RT",
                "capacity_kw": 10.0,
                "max_dc_voltage": 1100.0,
                "mppt_voltage_range_min": 160.0,
                "mppt_voltage_range_max": 1000.0,
                "max_input_current": 12.5,
                "num_mppt_channels": 2,
                "is_global": True,
            },
            {
                "manufacturer": "Fronius",
                "model": "Symo 10.0-3-M",
                "capacity_kw": 10.0,
                "max_dc_voltage": 1000.0,
                "mppt_voltage_range_min": 200.0,
                "mppt_voltage_range_max": 800.0,
                "max_input_current": 27.0,
                "num_mppt_channels": 2,
                "is_global": True,
            }
        ]

        for i_data in inverters:
            inverter = db.query(EquipmentInverter).filter_by(model=i_data["model"]).first()
            if not inverter:
                inverter = EquipmentInverter(**i_data)
                db.add(inverter)
        
        db.commit()
        print("Equipment library seeded successfully.")
    except Exception as e:
        print(f"Error seeding equipment: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    import os
    # Add parent directory to sys.path to allow importing app
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    seed_equipment()

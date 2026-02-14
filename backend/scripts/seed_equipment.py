"""
Seed script for global equipment library.

This script populates the global equipment library with commonly used PV modules
and inverters. It is idempotent and can be run multiple times safely.

Usage:
    python backend/scripts/seed_equipment.py

The script will:
- Add 11 global PV modules from major manufacturers
- Add 5 global inverters with various capacities
- Skip equipment that already exists (duplicate checking by model name)
- Log detailed statistics about items added vs skipped

Requirements:
- Database must be initialized (alembic upgrade head)
- DATABASE_URL environment variable must be set
"""
import logging
import os
import sys
import uuid
from datetime import datetime

# Ensure the backend directory is on sys.path before importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.models import EquipmentModule, EquipmentInverter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


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
            },
            {
                "manufacturer": "REC Solar",
                "model": "REC Alpha Pure-R 405W",
                "wattage": 405,
                "efficiency": 22.6,
                "length_m": 1.821,
                "width_m": 1.016,
                "thickness_m": 0.030,
                "voc": 41.60,
                "isc": 12.53,
                "vmp": 34.60,
                "imp": 11.71,
                "is_global": True,
            },
            {
                "manufacturer": "First Solar",
                "model": "Series 6 Plus 460W",
                "wattage": 460,
                "efficiency": 18.4,
                "length_m": 2.009,
                "width_m": 1.232,
                "thickness_m": 0.007,
                "voc": 108.8,
                "isc": 5.65,
                "vmp": 89.0,
                "imp": 5.17,
                "is_global": True,
            },
            {
                "manufacturer": "SunPower",
                "model": "Maxeon 3 400W",
                "wattage": 400,
                "efficiency": 22.6,
                "length_m": 1.690,
                "width_m": 1.046,
                "thickness_m": 0.040,
                "voc": 67.5,
                "isc": 6.39,
                "vmp": 57.3,
                "imp": 6.98,
                "is_global": True,
            },
            {
                "manufacturer": "Q CELLS",
                "model": "Q.PEAK DUO BLK ML-G10+ 405W",
                "wattage": 405,
                "efficiency": 20.6,
                "length_m": 1.740,
                "width_m": 1.134,
                "thickness_m": 0.032,
                "voc": 41.85,
                "isc": 12.77,
                "vmp": 34.95,
                "imp": 11.59,
                "is_global": True,
            },
            {
                "manufacturer": "Risen Energy",
                "model": "RSM144-6-440BMDG 440W",
                "wattage": 440,
                "efficiency": 21.0,
                "length_m": 1.903,
                "width_m": 1.096,
                "thickness_m": 0.035,
                "voc": 49.50,
                "isc": 11.35,
                "vmp": 41.40,
                "imp": 10.63,
                "is_global": True,
            },
            {
                "manufacturer": "Hanwha Q CELLS",
                "model": "Q.PEAK DUO-G9 355W",
                "wattage": 355,
                "efficiency": 19.5,
                "length_m": 1.670,
                "width_m": 1.000,
                "thickness_m": 0.032,
                "voc": 40.8,
                "isc": 11.15,
                "vmp": 34.1,
                "imp": 10.41,
                "is_global": True,
            },
        ]

        modules_added = 0
        modules_skipped = 0

        for m_data in modules:
            module = db.query(EquipmentModule).filter_by(model=m_data["model"]).first()
            if not module:
                module = EquipmentModule(**m_data)
                db.add(module)
                modules_added += 1
                logger.info(f"Added module: {m_data['manufacturer']} {m_data['model']}")
            else:
                modules_skipped += 1
                logger.info(f"Skipped existing module: {m_data['model']}")

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
                "manufacturer": "SMA",
                "model": "Sunny Tripower 10.0",
                "capacity_kw": 10.0,
                "max_dc_voltage": 1000.0,
                "mppt_voltage_range_min": 150.0,
                "mppt_voltage_range_max": 800.0,
                "max_input_current": 33.0,
                "num_mppt_channels": 2,
                "is_global": True,
            },
            {
                "manufacturer": "SolarEdge",
                "model": "SE10K-US",
                "capacity_kw": 10.0,
                "max_dc_voltage": 480.0,
                "mppt_voltage_range_min": 380.0,
                "mppt_voltage_range_max": 480.0,
                "max_input_current": 31.5,
                "num_mppt_channels": 1,
                "is_global": True,
            },
            {
                "manufacturer": "ABB",
                "model": "TRIO-TM-50.0-400",
                "capacity_kw": 50.0,
                "max_dc_voltage": 1100.0,
                "mppt_voltage_range_min": 200.0,
                "mppt_voltage_range_max": 1000.0,
                "max_input_current": 32.0,
                "num_mppt_channels": 3,
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
            },
        ]

        inverters_added = 0
        inverters_skipped = 0

        for i_data in inverters:
            inverter = db.query(EquipmentInverter).filter_by(model=i_data["model"]).first()
            if not inverter:
                inverter = EquipmentInverter(**i_data)
                db.add(inverter)
                inverters_added += 1
                logger.info(f"Added inverter: {i_data['manufacturer']} {i_data['model']}")
            else:
                inverters_skipped += 1
                logger.info(f"Skipped existing inverter: {i_data['model']}")

        db.commit()
        logger.info(
            f"Seeded {len(modules)} modules ({modules_added} new, {modules_skipped} existing) "
            f"and {len(inverters)} inverters ({inverters_added} new, {inverters_skipped} existing)"
        )
    except Exception as e:
        logger.error(f"Error seeding equipment: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_equipment()

"""
Setup script to initialize the database and seed initial data.
"""
import sys
import os

# Add the current directory to sys.path to allow importing app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import engine, Base
from app.models.models import *  # Ensure all models are imported
from scripts.seed_equipment import seed_equipment

def setup_db():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")
    
    print("Seeding equipment...")
    seed_equipment()
    print("Setup complete.")

if __name__ == "__main__":
    setup_db()

"""
Script to seed tenants and admin users from a JSON configuration.
Usage: python backend/scripts/seed_tenants.py [config_file]
Default config file: backend/scripts/tenants.json
"""
import sys
import os
import json
import argparse
from typing import List, Dict

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import firebase_admin
from firebase_admin import auth, credentials
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.models import User, Tenant, UserRole
from app.core.config import settings

def init_firebase():
    """Initialize Firebase Admin SDK."""
    try:
        # Check if already initialized
        try:
            firebase_admin.get_app()
            return True
        except ValueError:
            pass

        if settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK initialized.")
            return True
        else:
            print("No valid Firebase credentials found. Skipping Firebase sync.")
            return False
            
    except Exception as e:
        print(f"Warning: Could not initialize Firebase: {e}")
        return False

def seed_tenants(config_path: str):
    if not os.path.exists(config_path):
        print(f"Config file not found: {config_path}")
        return

    with open(config_path, 'r') as f:
        tenants_data = json.load(f)

    db = SessionLocal()
    firebase_initialized = init_firebase()

    try:
        for tenant_data in tenants_data:
            tenant_name = tenant_data["name"]
            admins = tenant_data.get("admins", [])

            # 1. Create/Get Tenant
            tenant = db.query(Tenant).filter(Tenant.name == tenant_name).first()
            if not tenant:
                tenant = Tenant(name=tenant_name)
                db.add(tenant)
                db.flush()
                print(f"Created tenant: {tenant.name}")
            else:
                print(f"Using existing tenant: {tenant.name}")

            # 2. Create Admins
            for admin_data in admins:
                email = admin_data["email"]
                password = admin_data.get("password", "password123") # Default password
                name = admin_data["name"]
                
                uid = None
                
                # Firebase Sync
                if firebase_initialized:
                    try:
                        try:
                            user_record = auth.get_user_by_email(email)
                            uid = user_record.uid
                            print(f"  - Firebase user exists: {email}")
                        except auth.UserNotFoundError:
                            user_record = auth.create_user(
                                email=email,
                                password=password,
                                display_name=name
                            )
                            uid = user_record.uid
                            print(f"  - Created Firebase user: {email}")
                    except Exception as e:
                        print(f"  - Error interacting with Firebase for {email}: {e}")

                if not uid:
                    # Deterministic placeholder for dev
                    import hashlib
                    uid = f"local-seed-{hashlib.md5(email.encode()).hexdigest()}"
                    print(f"  - Using placeholder UID for {email}: {uid}")

                # Database User
                user = db.query(User).filter(User.email == email).first()
                if user:
                    print(f"  - Database user exists: {email}")
                    if user.role != UserRole.ADMIN:
                        user.role = UserRole.ADMIN
                        db.add(user)
                        print(f"    - Updated role to ADMIN")
                    if user.tenant_id != tenant.id:
                        print(f"    - WARNING: User {email} belongs to different tenant {user.tenant_id}")
                else:
                    new_user = User(
                        tenant_id=tenant.id,
                        firebase_uid=uid,
                        email=email,
                        name=name,
                        role=UserRole.ADMIN,
                        is_active=True
                    )
                    db.add(new_user)
                    print(f"  - Created database user: {email}")
            
            db.commit()

    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed tenants and admins")
    parser.add_argument("config", nargs="?", default=os.path.join(os.path.dirname(__file__), "tenants.json"), help="Path to JSON config")
    args = parser.parse_args()
    
    seed_tenants(args.config)

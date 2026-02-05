"""
Script to create a demo admin user.
"""
import sys
import os
import secrets

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
import firebase_admin
from firebase_admin import auth, credentials

from app.core.database import SessionLocal, engine, Base
from app.models.models import User, Tenant, UserRole
from app.core.config import settings

def init_firebase():
    """Initialize Firebase Admin SDK."""
    try:
        if settings.FIREBASE_CREDENTIALS_PATH:
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK initialized.")
            return True
        else:
            print("No Firebase credentials found in settings.FIREBASE_CREDENTIALS_PATH.")
            print("Skipping Firebase initialization to avoid GCE metadata lookup hang.")
            return False
            
    except Exception as e:
        print(f"Warning: Could not initialize Firebase: {e}")
        return False

def create_demo_user():
    db = SessionLocal()
    try:
        email = "admin@demo.com"
        password = "demo123"
        display_name = "Demo Admin"
        
        firebase_initialized = init_firebase()
        uid = None
        
        # 1. Try to create/get Firebase User
        if firebase_initialized:
            try:
                # Check if exists
                try:
                    user_record = auth.get_user_by_email(email)
                    print(f"Firebase user already exists: {user_record.uid}")
                    uid = user_record.uid
                    # Update password just in case? (Optional)
                except auth.UserNotFoundError:
                    print("Creating new Firebase user...")
                    user_record = auth.create_user(
                        email=email,
                        password=password,
                        display_name=display_name
                    )
                    print(f"Created Firebase user: {user_record.uid}")
                    uid = user_record.uid
            except Exception as e:
                print(f"Error interacting with Firebase Auth: {e}")
        
        if not uid:
            print("Using placeholder UID for local database only.")
            uid = "demo-admin-uid-placeholder"

        # 2. Setup Database User
        # Check if user exists in DB
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"Database user already exists: {user.id}")
            # Ensure admin role
            if user.role != UserRole.ADMIN:
                user.role = UserRole.ADMIN
                db.commit()
                print("Updated role to ADMIN.")
            return

        # Check if Demo Tenant exists
        tenant_name = "Demo Tenant"
        tenant = db.query(Tenant).filter(Tenant.name == tenant_name).first()
        if not tenant:
            tenant = Tenant(name=tenant_name)
            db.add(tenant)
            db.flush()
            print(f"Created tenant: {tenant.name}")
        else:
            print(f"Using existing tenant: {tenant.name}")

        # Create User
        new_user = User(
            tenant_id=tenant.id,
            firebase_uid=uid,
            email=email,
            name=display_name,
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        print(f"Created local database user: {new_user.email} (ID: {new_user.id})")
        
        if not firebase_initialized:
             print("\nIMPORTANT: Firebase credentials were not available.")
             print("You will not be able to login via the frontend unless the frontend authentication is bypassed or mocked.")

    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_demo_user()

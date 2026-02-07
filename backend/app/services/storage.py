import os
import shutil
from abc import ABC, abstractmethod
from typing import Optional
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from app.core.config import settings

class StorageBackend(ABC):
    @abstractmethod
    def save(self, file_path: str, filename: str) -> str:
        """Save a file and return its identifier."""
        pass

    @abstractmethod
    def get_url(self, identifier: str) -> str:
        """Get a public or presigned URL for the identifier."""
        pass

    @abstractmethod
    def delete(self, identifier: str) -> bool:
        """Delete a file by its identifier."""
        pass

    @abstractmethod
    def exists(self, identifier: str) -> bool:
        """Check if a file exists."""
        pass

class LocalFileStorage(StorageBackend):
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = Path(base_dir or settings.PROPOSAL_LOCAL_DIR)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, file_path: str, filename: str) -> str:
        dest_path = self.base_dir / filename
        shutil.copy2(file_path, dest_path)
        return filename

    def get_url(self, identifier: str) -> str:
        # For local, we return the absolute path as the "URL" for now
        # In a real app, this might be a static route URL
        return str((self.base_dir / identifier).absolute())

    def delete(self, identifier: str) -> bool:
        file_path = self.base_dir / identifier
        if file_path.exists():
            file_path.unlink()
            return True
        return False

    def exists(self, identifier: str) -> bool:
        return (self.base_dir / identifier).exists()

class S3Storage(StorageBackend):
    def __init__(self):
        self.bucket_name = settings.S3_BUCKET_NAME
        self.region = settings.S3_REGION
        
        # Initialize client
        session_kwargs = {
            "region_name": self.region
        }
        if settings.S3_ACCESS_KEY_ID:
            session_kwargs["aws_access_key_id"] = settings.S3_ACCESS_KEY_ID
        if settings.S3_SECRET_ACCESS_KEY:
            session_kwargs["aws_secret_access_key"] = settings.S3_SECRET_ACCESS_KEY
            
        self.s3_client = boto3.client("s3", **session_kwargs)

    def save(self, file_path: str, filename: str) -> str:
        try:
            self.s3_client.upload_file(file_path, self.bucket_name, filename)
            return filename
        except ClientError as e:
            print(f"S3 upload error: {e}")
            raise

    def get_url(self, identifier: str) -> str:
        try:
            return self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": identifier},
                ExpiresIn=settings.S3_PRESIGNED_URL_EXPIRATION
            )
        except ClientError as e:
            print(f"S3 presigned URL error: {e}")
            return ""

    def delete(self, identifier: str) -> bool:
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=identifier)
            return True
        except ClientError:
            return False

    def exists(self, identifier: str) -> bool:
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=identifier)
            return True
        except ClientError:
            return False

def get_storage_backend() -> StorageBackend:
    backend_type = settings.PROPOSAL_STORAGE_BACKEND.lower()
    if backend_type == "s3":
        return S3Storage()
    return LocalFileStorage()

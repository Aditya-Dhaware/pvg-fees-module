from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class AdminUserBase(BaseModel):
    email: EmailStr
    name: str


class AdminUserCreate(AdminUserBase):
    password: str


class AdminUserUpdate(AdminUserBase):
    password: Optional[str] = None


class AdminUser(AdminUserBase):
    id: UUID
    role: str = "admin"
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    role: str


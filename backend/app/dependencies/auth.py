import uuid

from app.core.config import settings
from app.db.session import get_db
from app.models.admin import AdminUser
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def get_current_admin(
    db: AsyncSession = Depends(get_db), request: Request = None
) -> AdminUser:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        subject: str = payload.get("sub")
        email: str = payload.get("email")
        role: str = str(payload.get("role", "")).lower()

        if subject is None and email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )

        if role != "admin":
            # If they aren't an admin, we don't let them call Admin APIs
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Admin role required",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    # Try to find user by ID first (subject)
    user = None
    try:
        # Check if subject is a valid UUID
        id_val = uuid.UUID(subject)
        result = await db.execute(select(AdminUser).where(AdminUser.id == id_val))
        user = result.scalar_one_or_none()
    except (ValueError, TypeError, AttributeError):
        pass  # Not a UUID

    # If not found by ID, try finding by email
    if not user:
        lookup_email = email or subject
        if lookup_email:
            result = await db.execute(
                select(AdminUser).where(AdminUser.email == lookup_email)
            )
            user = result.scalar_one_or_none()

    # AUTO-PROVISION: If verified as admin but not in our DB, create them!
    if not user and role == "admin":
        try:
            lookup_email = email or subject
            new_admin = AdminUser(
                email=lookup_email,
                name=payload.get("full_name") or payload.get("username") or "Admin",
                password_hash="EXTERNAL_AUTH",  # Not used for JWT login
            )
            db.add(new_admin)
            await db.commit()
            await db.refresh(new_admin)
            user = new_admin
            print(f"DEBUG: Auto-provisioned admin {lookup_email}")
        except Exception as e:
            print(f"DEBUG: Failed to auto-provision: {e}")
            raise HTTPException(
                status_code=404, detail="User not found and could not be provisioned"
            )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

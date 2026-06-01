import uuid
import httpx

from app.core.config import settings
from app.db.session import get_db
from app.models.admin import AdminUser
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

security_scheme = HTTPBearer(auto_error=True)


async def get_current_user_payload(
    token_auth: HTTPAuthorizationCredentials = Depends(security_scheme),
) -> dict:
    token = token_auth.credentials
    payload = None

    # 1. Local signature verification
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
    except JWTError as local_err:
        print(f"DEBUG: Local JWT validation failed: {local_err}. Trying fallback Central Auth verification...")
        
        # 2. Fallback verification via Central Auth module
        if settings.AUTH_BACKEND_URL:
            # Construct endpoint URL
            url = f"{settings.AUTH_BACKEND_URL.rstrip('/')}/api/v1/auth/me"
            headers = {"Authorization": f"Bearer {token}"}
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(url, headers=headers, timeout=5.0)
                    if response.status_code == 200:
                        payload = response.json()
                        print("DEBUG: Fallback Central Auth validation succeeded.")
                    else:
                        print(f"DEBUG: Fallback Central Auth responded with status {response.status_code}")
            except Exception as fallback_err:
                print(f"DEBUG: Fallback request to Central Auth failed: {fallback_err}")
        else:
            print("DEBUG: Fallback Central Auth URL (AUTH_BACKEND_URL) not configured.")

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    return payload


def check_user_permission(user_id_param: str, payload: dict) -> bool:
    role = str(payload.get("role", "")).lower()
    if role == "admin":
        return True

    # Extract all possible identifiers from the token payload
    allowed_ids = set()
    for key in ("sub", "id", "user_id", "email"):
        val = payload.get(key)
        if val is not None:
            allowed_ids.add(str(val).strip().lower())

    target_id = str(user_id_param or "").strip().lower()

    if target_id in allowed_ids:
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: You can only access your own data",
    )



async def get_current_admin(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db),
) -> AdminUser:
    subject = payload.get("sub") or payload.get("id") or payload.get("user_id")
    email = payload.get("email")
    role = str(payload.get("role", "")).lower()

    if subject is None and email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Admin role required",
        )

    # Try to find user by ID first (subject)
    user = None
    try:
        # Check if subject is a valid UUID
        id_val = uuid.UUID(str(subject))
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

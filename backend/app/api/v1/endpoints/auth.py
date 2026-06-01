import logging

from app.dependencies import auth as deps
from app.core import security
from app.db.session import get_db
from app.models.admin import AdminUser
from app.schemas.admin import AdminUser as AdminUserSchema
from app.schemas.admin import LoginRequest, UserProfile
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    email = req.email.lower().strip()
    print(f"DEBUG: Login request received for {email}")
    logger.info(f"Login attempt: email='{email}'")

    result = await db.execute(select(AdminUser).where(AdminUser.email == email))
    admin = result.scalar_one_or_none()

    if not admin:
        logger.warning(f"Login FAILED: User '{email}' NOT FOUND.")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not security.verify_password(req.password, admin.password_hash):
        logger.warning(f"Login FAILED: Password MISMATCH for user '{email}'")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    logger.info(f"Login SUCCESS: User '{email}' authenticated.")
    token = security.create_access_token(admin.id, admin.email)

    return {
        "token": token,
        "user": {
            "id": str(admin.id),
            "email": admin.email,
            "name": admin.name,
            "role": "admin",
        },
    }


@router.post("/logout")
async def logout(response: Response):
    # For token based auth, logout is usually handled on frontend by clearing token.
    # But we can provide an endpoint for completeness.
    return {"message": "Logged out"}


@router.get("/me", response_model=UserProfile)
async def get_me(
    payload: dict = Depends(deps.get_current_user_payload),
    db: AsyncSession = Depends(get_db),
):
    role = str(payload.get("role", "student")).lower()
    subject = payload.get("sub") or payload.get("id") or payload.get("user_id")
    email = payload.get("email")
    name = payload.get("full_name") or payload.get("username") or payload.get("name") or "User"

    if role == "admin":
        try:
            admin_user = await deps.get_current_admin(payload, db)
            if admin_user:
                return {
                    "id": str(admin_user.id),
                    "email": admin_user.email,
                    "name": admin_user.name,
                    "role": "admin"
                }
        except Exception:
            pass

    return {
        "id": str(subject),
        "email": email or "",
        "name": name,
        "role": role
    }

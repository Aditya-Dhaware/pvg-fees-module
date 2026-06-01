import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(ROOT_DIR / ".env", override=True)


class Settings:
    PROJECT_NAME: str = "ERP Fees & Billing"
    API_V1_STR: str = "/api/v1"

    SECRET_KEY: str = os.environ.get("JWT_SECRET", "secret")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    DATABASE_URL: str = os.environ.get("DATABASE_URL", "")
    # Convert postgres:// to postgresql+asyncpg:// if necessary for SQLAlchemy
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

    RAZORPAY_KEY_ID: str = os.environ.get("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.environ.get("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_WEBHOOK_SECRET: str = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")

    CORS_ORIGINS: List[str] = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,https://automatic-certify-appointee.ngrok-free.dev,https://0d01-103-251-210-3.ngrok-free.app",
    ).split(",")

    AUTH_BACKEND_URL: str = os.environ.get("AUTH_BACKEND_URL", "")
    AUTH_FRONTEND_URL: str = os.environ.get("AUTH_FRONTEND_URL", "")

    ADMIN_EMAIL: str = os.environ.get("ADMIN_EMAIL", "admin@college.com")
    ADMIN_PASSWORD: str = os.environ.get("ADMIN_PASSWORD", "Admin@123")

    FRONTEND_URL: str = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip(
        ","
    )
    ADMISSION_WEBHOOK_URL: str = os.environ.get(
        "ADMISSION_WEBHOOK_URL",
        "https://d26a-2401-4900-1c17-f926-fc5b-8b97-3bdc-520.ngrok-free.app/api/v1/payments/webhook/payment-success",
    )
    ADMISSION_FRONTEND_URL: str = os.environ.get(
        "ADMISSION_FRONTEND_URL", "https://ec38-103-97-105-133.ngrok-free.app"
    )
    ADMISSION_INTEGRATION_SECRET: str = os.environ.get(
        "ADMISSION_INTEGRATION_SECRET", "SUPER_SECRET_TOKEN"
    )
    SIS_MODULE_URL: str = os.environ.get("SIS_MODULE_URL", "http://localhost:8002")
    SIS_API_KEY: str = os.environ.get("SIS_API_KEY", "College_ERP_Backend_Secure_2026")

    NOTIFICATION_MODULE_URL: str = os.environ.get(
        "NOTIFICATION_MODULE_URL",
        "https://tapering-gradation-quickness.ngrok-free.dev/api/module-notification",
    )
    NOTIFICATION_API_KEY: str = os.environ.get("NOTIFICATION_API_KEY", "FEES_KEY_2026")
    NOTIFICATION_MODULE_NAME: str = os.environ.get(
        "NOTIFICATION_MODULE_NAME", "Fees and Billing"
    )


settings = Settings()

import logging
from datetime import datetime
from typing import List, Optional

import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_notification(
    event_type: str,
    title: str,
    message: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    department: Optional[str] = None,
    recipient_roles: List[str] = ["student"],
    delivery_modes: List[str] = ["email"],
):
    """
    Sends a notification to the central Notification Module.
    Supports both specific user (via recipient_emails) and bulk (via department/roles).
    """
    payload = {
        "api_key": settings.NOTIFICATION_API_KEY,
        "module_name": settings.NOTIFICATION_MODULE_NAME,
        "event_type": event_type,
        "title": title,
        "message": message,
        "delivery_modes": delivery_modes,
        "recipient_roles": recipient_roles,
    }

    if user_email:
        payload["recipient_emails"] = [user_email]

    if department:
        payload["department"] = department

    # Optional metadata
    if user_id:
        payload["user_id"] = user_id

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                settings.NOTIFICATION_MODULE_URL, json=payload, timeout=10.0
            )
            if resp.status_code == 200:
                target = user_email if user_email else department
                logger.info(
                    f"[Notification] Successfully sent {event_type} to {target}"
                )
            else:
                logger.error(
                    f"[Notification] Failed to send {event_type}. Status: {resp.status_code}, Response: {resp.text}"
                )
    except Exception as e:
        logger.error(f"[Notification] Error sending notification: {str(e)}")


async def notify_payment_success(
    user_name: str, amount: float, bill_id: str, user_id: str, user_email: str
):
    await send_notification(
        event_type="Fee Payment",
        title="Payment Successful",
        message=f"Dear {user_name}, your payment of ₹{amount} for Bill ID {bill_id} has been successfully processed. Thank you!",
        user_id=user_id,
        user_email=user_email,
    )


async def notify_due_date_reminder(
    user_name: str, amount: float, due_date: datetime, user_id: str, user_email: str
):
    date_str = due_date.strftime("%d-%m-%Y")
    await send_notification(
        event_type="Fee Reminder",
        title="Payment Reminder",
        message=f"Dear {user_name}, this is a reminder that your fee installment of ₹{amount} is due on {date_str}. Please pay on time to avoid late fees.",
        user_id=user_id,
        user_email=user_email,
    )


async def notify_bill_generated(
    user_name: str,
    total_amount: float,
    installments: int,
    user_id: str,
    user_email: str,
):
    await send_notification(
        event_type="Bill Generated",
        title="Academic Bills Created",
        message=f"Dear {user_name}, your academic bills for the current session have been generated. Total amount: ₹{total_amount} across {installments} installments.",
        user_id=user_id,
        user_email=user_email,
    )


async def notify_refund_initialized(
    user_name: str, amount: float, user_id: str, user_email: str
):
    await send_notification(
        event_type="Refund Initiated",
        title="Refund Request Started",
        message=f"Dear {user_name}, a refund request of ₹{amount} has been initiated for your recent payment. You will be notified once it is processed.",
        user_id=user_id,
        user_email=user_email,
    )


async def notify_refund_completed(
    user_name: str, amount: float, user_id: str, user_email: str
):
    await send_notification(
        event_type="Refund Completed",
        title="Refund Processed",
        message=f"Dear {user_name}, your refund of ₹{amount} has been successfully processed and credited back to your original payment method.",
        user_id=user_id,
        user_email=user_email,
    )


async def notify_payment_failed(
    user_name: str, bill_id: str, user_id: str, user_email: str
):
    await send_notification(
        event_type="Payment Failed",
        title="Payment Attempt Failed",
        message=f"Dear {user_name}, your recent payment attempt for Bill ID {bill_id} has failed. Please try again.",
        user_id=user_id,
        user_email=user_email,
    )


async def notify_late_fee_alert(
    user_name: str, amount: float, user_id: str, user_email: str
):
    await send_notification(
        event_type="Fee Reminder",
        title="Overdue Payment Alert",
        message=f"Dear {user_name}, your payment of ₹{amount} is now overdue. Please settle it immediately.",
        user_id=user_id,
        user_email=user_email,
    )

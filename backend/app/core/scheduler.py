import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.db.session import AsyncSessionLocal
from app.models.bill import Bill
from app.services import notification_service
from sqlalchemy import and_, select

logger = logging.getLogger(__name__)


async def check_due_dates():
    """
    Periodic task to check for upcoming or overdue bills.
    Runs every 24 hours.
    """
    while True:
        try:
            logger.info("[Scheduler] Starting daily due date check...")
            async with AsyncSessionLocal() as db:
                now = datetime.now(timezone.utc)

                # 1. Check for bills due in 7 days, 3 days, and Today
                for days in [7, 3, 0]:
                    target_date = (now + timedelta(days=days)).date()

                    # Query UNPAID bills where due_date matches the target day
                    # (Filtering by date part only)
                    result = await db.execute(
                        select(Bill).where(
                            and_(
                                Bill.status == "UNPAID",
                                Bill.due_date
                                >= datetime.combine(
                                    target_date,
                                    datetime.min.time(),
                                    tzinfo=timezone.utc,
                                ),
                                Bill.due_date
                                <= datetime.combine(
                                    target_date,
                                    datetime.max.time(),
                                    tzinfo=timezone.utc,
                                ),
                            )
                        )
                    )
                    bills = result.scalars().all()

                    for bill in bills:
                        logger.info(
                            f"[Scheduler] Sending DUE_REMINDER for bill {bill.bill_id} (Due in {days} days)"
                        )
                        await notification_service.notify_due_date_reminder(
                            user_name=bill.user_name or "Student",
                            amount=float(bill.amount),
                            due_date=bill.due_date,
                            user_id=bill.user_id,
                            user_email=bill.user_email,
                        )

                # 2. Check for overdue bills (Late Fee Alert) - 1 day past due
                yesterday = (now - timedelta(days=1)).date()
                result_overdue = await db.execute(
                    select(Bill).where(
                        and_(
                            Bill.status == "UNPAID",
                            Bill.due_date
                            >= datetime.combine(
                                yesterday, datetime.min.time(), tzinfo=timezone.utc
                            ),
                            Bill.due_date
                            <= datetime.combine(
                                yesterday, datetime.max.time(), tzinfo=timezone.utc
                            ),
                        )
                    )
                )
                overdue_bills = result_overdue.scalars().all()
                for bill in overdue_bills:
                    logger.info(
                        f"[Scheduler] Sending LATE_FEE_ALERT for bill {bill.bill_id} (1 day overdue)"
                    )
                    await notification_service.notify_late_fee_alert(
                        user_name=bill.user_name or "Student",
                        amount=float(bill.amount),
                        user_id=bill.user_id,
                        user_email=bill.user_email,
                    )

            logger.info("[Scheduler] Daily check completed. Sleeping for 24 hours.")
        except Exception as e:
            logger.error(f"[Scheduler] Error in due date check: {str(e)}")

        # Sleep for 24 hours
        await asyncio.sleep(24 * 3600)


def start_scheduler():
    """
    Wrapper to run the async loop in the background.
    """
    asyncio.create_task(check_due_dates())

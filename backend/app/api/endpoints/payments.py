import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from app.api import deps
from app.core.config import settings
from app.db.session import get_db
from app.models.admin import AdminUser
from app.models.bill import Bill
from app.models.payment import Payment
from app.models.receipt import Receipt
from app.schemas.payment import Payment as PaymentSchema
from app.schemas.payment import VerifyPaymentRequest
from app.services import (audit_service, notification_service,
                          razorpay_service, webhook_service)
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/create-order")
async def create_payment_order(
    bill_id: UUID, user_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Bill).where(Bill.bill_id == bill_id))
    bill = result.scalar_one_or_none()

    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    if bill.status == "PAID":
        raise HTTPException(status_code=400, detail="Bill is already paid")

    if not bill.amount or float(bill.amount) <= 0:
        raise HTTPException(status_code=400, detail="Invalid bill amount")

    amount_paise = int(float(bill.amount) * 100)
    receipt_str = f"rcpt_{str(bill.bill_id)[:20]}"

    import asyncio
    import traceback

    try:
        # Use run_in_executor for the blocking Razorpay call
        loop = asyncio.get_event_loop()
        order = await loop.run_in_executor(
            None,
            lambda: razorpay_service.get_razorpay_client().order.create(
                {
                    "amount": amount_paise,
                    "currency": "INR",
                    "receipt": receipt_str,
                    "payment_capture": 1,
                }
            ),
        )
    except Exception as e:
        logger.error(f"Razorpay order creation failed for bill {bill_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500, detail=f"Payment order creation failed: {str(e)}"
        )

    try:
        payment = Payment(
            bill_id=bill.bill_id,
            user_id=bill.user_id,
            razorpay_order_id=order["id"],
            amount=bill.amount,
            status="PENDING",
        )
        db.add(payment)
        await db.commit()  # Commit here so we can catch any commit-time errors
        await db.refresh(payment)  # Refresh to get created_at
    except Exception as e:
        await db.rollback()
        logger.error(f"Database error while saving payment for bill {bill_id}: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500, detail=f"Failed to save payment record: {str(e)}"
        )

    try:
        await audit_service.log_event(
            "PAYMENT_ORDER_CREATED",
            "SUCCESS",
            f"Created Razorpay order for bill {bill_id}",
            {
                "bill_id": str(bill_id),
                "user_id": user_id,
                "order_id": order["id"],
                "amount": float(amount_paise) / 100,
            },
            db=db,
        )
        await db.commit()  # Commit the audit log too
    except Exception as e:
        logger.warning(f"Failed to log audit event: {e}")
        # Don't fail the whole request if only auditing fails

    return {
        "order": order,
        "payment": {
            "payment_id": str(payment.payment_id),
            "bill_id": str(payment.bill_id),
            "user_id": payment.user_id,
            "razorpay_order_id": payment.razorpay_order_id,
            "amount": float(payment.amount),
            "status": payment.status,
            "created_at": (
                payment.created_at.isoformat() if payment.created_at else None
            ),
        },
        "key_id": settings.RAZORPAY_KEY_ID,
    }


@router.post("/verify")
async def verify_payment(
    req: VerifyPaymentRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Verifying payment for Order: {req.razorpay_order_id}")
    if not razorpay_service.verify_signature(
        req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature
    ):
        logger.error(
            f"Signature verification failed for Order: {req.razorpay_order_id}"
        )

        # Trigger payment failure notification if possible
        # We need the user info, let's try to fetch it from the payment record
        res_pay = await db.execute(
            select(Payment).where(Payment.razorpay_order_id == req.razorpay_order_id)
        )
        pay_rec = res_pay.scalar_one_or_none()
        if pay_rec:
            res_bill = await db.execute(
                select(Bill).where(Bill.bill_id == pay_rec.bill_id)
            )
            bill_rec = res_bill.scalar_one_or_none()
            if bill_rec:
                background_tasks.add_task(
                    notification_service.notify_payment_failed,
                    bill_rec.user_name or "Student",
                    str(bill_rec.bill_id),
                    bill_rec.user_id,
                    bill_rec.user_email,
                )

        raise HTTPException(
            status_code=400, detail="Payment verification failed: Invalid signature"
        )

    logger.info("Signature verified successfully.")

    result = await db.execute(
        select(Payment).where(Payment.razorpay_order_id == req.razorpay_order_id)
    )
    payment = result.scalar_one_or_none()

    if not payment:
        logger.error(f"Payment record not found for Order ID: {req.razorpay_order_id}")
        raise HTTPException(
            status_code=404,
            detail="Payment verification failed: Order record not found",
        )

    logger.info(f"Payment record found: {payment.payment_id}")

    result = await db.execute(select(Bill).where(Bill.bill_id == payment.bill_id))
    bill = result.scalar_one_or_none()

    if bill.status == "PAID":
        logger.warning(f"Bill {bill.bill_id} is already marked as PAID.")
        raise HTTPException(status_code=400, detail="Bill already paid")

    logger.info(f"Updating payment and bill status for bill: {bill.bill_id}")
    payment.razorpay_payment_id = req.razorpay_payment_id
    payment.razorpay_signature = req.razorpay_signature
    payment.status = "SUCCESS"

    # Fetch actual amount from Razorpay (in case of gateway fees/taxes)
    try:
        import asyncio

        loop = asyncio.get_event_loop()
        rzp_payment = await loop.run_in_executor(
            None,
            lambda: razorpay_service.get_razorpay_client().payment.fetch(
                req.razorpay_payment_id
            ),
        )
        actual_amount = float(rzp_payment.get("amount", 0)) / 100.0
        if actual_amount > 0:
            payment.amount = actual_amount
            logger.info(
                f"Updated payment amount to actual captured amount: {actual_amount}"
            )
    except Exception as e:
        logger.error(f"Could not fetch actual payment amount from Razorpay: {e}")

    bill.status = "PAID"
    bill.paid_at = datetime.now(timezone.utc)
    bill.updated_at = datetime.now(timezone.utc)

    # Shifting the next installment's due date for ACADEMIC bills
    if bill.bill_type == "ACADEMIC":
        from dateutil.relativedelta import relativedelta

        result_next = await db.execute(
            select(Bill).where(
                and_(
                    Bill.user_id == bill.user_id,
                    Bill.academic_year == bill.academic_year,
                    Bill.installment_number == bill.installment_number + 1,
                )
            )
        )
        next_bill = result_next.scalar_one_or_none()
        if next_bill:
            next_bill.due_date = datetime.now(timezone.utc) + relativedelta(months=3)
            logger.info(
                f"Updated next installment {next_bill.installment_number} due date to {next_bill.due_date}"
            )

    # Trigger payment success notification
    background_tasks.add_task(
        notification_service.notify_payment_success,
        bill.user_name or "Student",
        float(bill.amount),
        str(bill.bill_id),
        bill.user_id,
        bill.user_email,
    )

    logger.info("Checking for existing receipt...")
    existing_receipt_res = await db.execute(
        select(Receipt).where(Receipt.payment_id == payment.payment_id)
    )
    receipt = existing_receipt_res.scalar_one_or_none()

    if not receipt:
        logger.info("Generating new receipt...")
        receipt_num = f"REC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(payment.payment_id)[:8].upper()}"
        receipt = Receipt(
            payment_id=payment.payment_id,
            bill_id=payment.bill_id,
            user_id=payment.user_id,
            receipt_number=receipt_num,
            amount=payment.amount,
        )
        db.add(receipt)
        await db.flush()  # Ensure receipt gets an ID immediately
        logger.info(f"Receipt generated: {receipt_num}")
    else:
        receipt_num = receipt.receipt_number
        logger.info(f"Receipt already exists: {receipt_num}")

    # Webhook Payloads
    webhook_payload = {
        "event": "payment.success",
        "data": {
            "user_id": str(payment.user_id),
            "bill_id": str(payment.bill_id),
            "payment_id": str(payment.payment_id),
            "receipt_number": receipt_num,
            "amount": float(payment.amount),
            "bill_type": bill.bill_type,
        },
    }

    logger.info("Scheduling background tasks...")

    if bill.bill_type == "BROCHURE":
        background_tasks.add_task(webhook_service.send_payment_webhook, webhook_payload)

    if bill.bill_type == "ACADEMIC":
        # Fix deadlock: Compute summary within the open database transaction synchronously
        # then pass the computed values to the external webhook background task.
        # Compute summary using actual successful payments for total_paid
        paid_payments_res = await db.execute(
            select(Payment)
            .join(Bill, Payment.bill_id == Bill.bill_id)
            .where(
                and_(
                    Bill.user_id == payment.user_id,
                    Bill.bill_type == "ACADEMIC",
                    Payment.status == "SUCCESS",
                )
            )
        )
        total_paid = sum(float(p.amount) for p in paid_payments_res.scalars().all())

        pending_bills_res = await db.execute(
            select(Bill).where(
                and_(
                    Bill.user_id == payment.user_id,
                    Bill.bill_type == "ACADEMIC",
                    Bill.status == "UNPAID",
                )
            )
        )
        total_pending = sum(float(b.amount) for b in pending_bills_res.scalars().all())

        total_fees = total_paid + total_pending

        # Send webhook to Admission Module
        background_tasks.add_task(webhook_service.send_payment_webhook, webhook_payload)

        # Send update to SIS
        background_tasks.add_task(
            webhook_service.send_sis_fee_update,
            str(payment.user_id),
            total_fees,
            total_paid,
            total_pending,
        )

    await audit_service.log_event(
        "PAYMENT_VERIFIED",
        "SUCCESS",
        f"Payment verified for bill {str(payment.bill_id)}",
        {
            "user_id": str(payment.user_id),
            "bill_id": str(payment.bill_id),
            "payment_id": str(payment.payment_id),
            "receipt_number": receipt_num,
            "amount": float(payment.amount),
            "bill_type": bill.bill_type,
        },
        db=db,
    )

    return {
        "message": "Payment verified successfully",
        "receipt": {
            "receipt_id": str(receipt.receipt_id),
            "payment_id": str(receipt.payment_id),
            "bill_id": str(receipt.bill_id),
            "user_id": receipt.user_id,
            "receipt_number": receipt.receipt_number,
            "amount": float(receipt.amount),
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    }


@router.post("/razorpay-webhook")
async def razorpay_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
    raw_body = await request.body()

    if webhook_secret:
        received_signature = request.headers.get("X-Razorpay-Signature", "")
        expected_signature = hmac.new(
            webhook_secret.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected_signature, received_signature):
            logger.warning("[RazorpayWebhook] Invalid signature")
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        event = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_name = event.get("event")
    logger.info(f"[RazorpayWebhook] Received event: {event_name}")

    if event_name != "payment.captured":
        return {"status": "ignored", "event": event_name}

    payment_entity = event.get("payload", {}).get("payment", {}).get("entity", {})
    razorpay_order_id = payment_entity.get("order_id")
    razorpay_payment_id = payment_entity.get("id")

    if not razorpay_order_id or not razorpay_payment_id:
        raise HTTPException(status_code=400, detail="Missing order_id or payment_id")

    result = await db.execute(
        select(Payment).where(Payment.razorpay_order_id == razorpay_order_id)
    )
    payment = result.scalar_one_or_none()

    if not payment:
        logger.warning(
            f"[RazorpayWebhook] No payment record for order {razorpay_order_id}"
        )
        return {"status": "not_found"}

    result = await db.execute(select(Bill).where(Bill.bill_id == payment.bill_id))
    bill = result.scalar_one_or_none()

    if bill.status == "PAID":
        return {"status": "already_paid"}

    # Update payment amount if actual captured amount is available in webhook payload
    actual_amount_paise = payment_entity.get("amount")
    if actual_amount_paise:
        payment.amount = float(actual_amount_paise) / 100.0

    payment.razorpay_payment_id = razorpay_payment_id
    payment.status = "SUCCESS"
    bill.status = "PAID"
    bill.paid_at = datetime.now(timezone.utc)
    bill.updated_at = datetime.now(timezone.utc)

    # Shifting the next installment's due date for ACADEMIC bills
    if bill.bill_type == "ACADEMIC":
        from dateutil.relativedelta import relativedelta

        result_next = await db.execute(
            select(Bill).where(
                and_(
                    Bill.user_id == bill.user_id,
                    Bill.academic_year == bill.academic_year,
                    Bill.installment_number == bill.installment_number + 1,
                )
            )
        )
        next_bill = result_next.scalar_one_or_none()
        if next_bill:
            next_bill.due_date = datetime.now(timezone.utc) + relativedelta(months=3)
            logger.info(
                f"[Webhook] Updated next installment {next_bill.installment_number} due date to {next_bill.due_date}"
            )

    # Trigger payment success notification
    background_tasks.add_task(
        notification_service.notify_payment_success,
        bill.user_name or "Student",
        float(bill.amount),
        str(bill.bill_id),
        bill.user_id,
        bill.user_email,
    )

    receipt_num = f"REC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(payment.payment_id)[:8].upper()}"
    # Check for existing receipt to ensure idempotency
    existing_receipt = await db.execute(
        select(Receipt).where(Receipt.payment_id == payment.payment_id)
    )
    if not existing_receipt.scalar_one_or_none():
        receipt = Receipt(
            payment_id=payment.payment_id,
            bill_id=payment.bill_id,
            user_id=payment.user_id,
            receipt_number=receipt_num,
            amount=payment.amount,
        )
        db.add(receipt)

    # Webhooks
    webhook_payload = {
        "event": "payment.success",
        "data": {
            "user_id": str(payment.user_id),
            "bill_id": str(payment.bill_id),
            "payment_id": str(payment.payment_id),
            "receipt_number": receipt_num,
            "amount": float(payment.amount),
            "bill_type": bill.bill_type,
        },
    }

    if bill.bill_type == "BROCHURE":
        background_tasks.add_task(webhook_service.send_payment_webhook, webhook_payload)

    if bill.bill_type == "ACADEMIC":
        # Compute summary using actual successful payments for total_paid
        paid_payments_res = await db.execute(
            select(Payment)
            .join(Bill, Payment.bill_id == Bill.bill_id)
            .where(
                and_(
                    Bill.user_id == payment.user_id,
                    Bill.bill_type == "ACADEMIC",
                    Payment.status == "SUCCESS",
                )
            )
        )
        total_paid = sum(float(p.amount) for p in paid_payments_res.scalars().all())

        pending_bills_res = await db.execute(
            select(Bill).where(
                and_(
                    Bill.user_id == payment.user_id,
                    Bill.bill_type == "ACADEMIC",
                    Bill.status == "UNPAID",
                )
            )
        )
        total_pending = sum(float(b.amount) for b in pending_bills_res.scalars().all())

        total_fees = total_paid + total_pending

        # Send webhook to Admission Module
        background_tasks.add_task(webhook_service.send_payment_webhook, webhook_payload)

        # Send update to SIS
        background_tasks.add_task(
            webhook_service.send_sis_fee_update,
            str(payment.user_id),
            total_fees,
            total_paid,
            total_pending,
        )

    await audit_service.log_event(
        "RAZORPAY_WEBHOOK_PROCESSED",
        "SUCCESS",
        f"Webhook processed for order {razorpay_order_id}",
        {
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "bill_id": str(payment.bill_id),
            "bill_type": bill.bill_type,
        },
        db=db,
    )

    return {"status": "success"}


@router.get("/", response_model=List[PaymentSchema])
async def list_payments(
    academic_year: Optional[str] = None,
    user_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    admin: AdminUser = Depends(deps.get_current_admin),
):
    # Join with bills to filter by academic_year
    query = select(
        Payment, Bill.program_name, Bill.academic_year, Bill.bill_type
    ).outerjoin(Bill, Payment.bill_id == Bill.bill_id)

    if academic_year:
        query = query.where(Bill.academic_year == academic_year)
    if user_id:
        query = query.where(Payment.user_id == user_id)

    query = query.order_by(Payment.created_at.desc())
    result = await db.execute(query)

    payments = []
    for row in result.all():
        p = row.Payment
        p.program_name = row.program_name
        p.academic_year = row.academic_year
        p.bill_type = row.bill_type
        payments.append(p)

    return payments


@router.get("/user/{user_id}", response_model=List[PaymentSchema])
async def get_user_payments(user_id: str, db: AsyncSession = Depends(get_db)):
    query = (
        select(Payment, Bill.program_name, Bill.academic_year, Bill.bill_type)
        .outerjoin(Bill, Payment.bill_id == Bill.bill_id)
        .where(Payment.user_id == user_id)
        .order_by(Payment.created_at.desc())
    )

    result = await db.execute(query)

    payments = []
    for row in result.all():
        p = row.Payment
        p.program_name = row.program_name
        p.academic_year = row.academic_year
        p.bill_type = row.bill_type
        payments.append(p)

    return payments

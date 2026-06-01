import asyncio
import logging
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from app.db.session import AsyncSessionLocal
from app.models.bill import Bill
from app.models.payment import Payment
from app.models.receipt import Receipt
from sqlalchemy import select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

async def seed_demo_data():
    logger.info("Starting demo database seeding...")
    async with AsyncSessionLocal() as db:
        # Check if we already have bills in the database to prevent duplicate seeding
        existing_bills_result = await db.execute(select(Bill).limit(1))
        if existing_bills_result.scalar():
            logger.info("Database already contains data. Skipping seeding.")
            return

        logger.info("No existing bills found. Seeding sample data...")

        # Sample data definitions
        students = [
            {
                "user_id": "1001",
                "name": "Alice Smith",
                "email": "alice@college.com",
                "program_name": "Computer Science",
                "user_class": "CS-A",
            },
            {
                "user_id": "1002",
                "name": "Bob Jones",
                "email": "bob@college.com",
                "program_name": "Information Technology",
                "user_class": "IT-B",
            },
            {
                "user_id": "1003",
                "name": "Charlie Brown",
                "email": "charlie@college.com",
                "program_name": "Electronics Engineering",
                "user_class": "EE-C",
            },
        ]

        # 1. Alice Smith (user_id: 1001)
        # - An unpaid academic bill
        # - A paid brochure bill with receipt
        alice = students[0]
        
        bill_alice_acad = Bill(
            bill_id=uuid.uuid4(),
            user_id=alice["user_id"],
            academic_year="2025-26",
            user_name=alice["name"],
            user_email=alice["email"],
            program_name=alice["program_name"],
            user_class=alice["user_class"],
            bill_type="ACADEMIC",
            amount=Decimal("50000.00"),
            status="UNPAID",
            installment_number=1,
            total_installments=2,
            due_date=datetime(2026, 8, 31, tzinfo=timezone.utc),
        )
        db.add(bill_alice_acad)

        bill_alice_brochure = Bill(
            bill_id=uuid.uuid4(),
            user_id=alice["user_id"],
            academic_year="2025-26",
            user_name=alice["name"],
            user_email=alice["email"],
            program_name="Brochure",
            user_class=alice["user_class"],
            bill_type="BROCHURE",
            amount=Decimal("200.00"),
            status="PAID",
            paid_at=datetime.now(timezone.utc),
        )
        db.add(bill_alice_brochure)
        await db.flush()

        payment_alice_brochure = Payment(
            payment_id=uuid.uuid4(),
            bill_id=bill_alice_brochure.bill_id,
            user_id=alice["user_id"],
            razorpay_order_id="order_ALICE1001BROCH",
            razorpay_payment_id="pay_ALICE1001BROCH",
            razorpay_signature="sig_ALICE1001BROCH",
            amount=Decimal("200.00"),
            status="SUCCESS",
        )
        db.add(payment_alice_brochure)
        await db.flush()

        receipt_alice_brochure = Receipt(
            receipt_id=uuid.uuid4(),
            payment_id=payment_alice_brochure.payment_id,
            bill_id=bill_alice_brochure.bill_id,
            user_id=alice["user_id"],
            receipt_number="REC-20260531-ALICEBR",
            amount=Decimal("200.00"),
            created_at=datetime.now(timezone.utc),
        )
        db.add(receipt_alice_brochure)

        # 2. Bob Jones (user_id: 1002)
        # - A paid academic bill (1st installment) with receipt
        # - An unpaid academic bill (2nd installment)
        bob = students[1]

        bill_bob_acad1 = Bill(
            bill_id=uuid.uuid4(),
            user_id=bob["user_id"],
            academic_year="2025-26",
            user_name=bob["name"],
            user_email=bob["email"],
            program_name=bob["program_name"],
            user_class=bob["user_class"],
            bill_type="ACADEMIC",
            amount=Decimal("60000.00"),
            status="PAID",
            installment_number=1,
            total_installments=2,
            due_date=datetime(2025, 9, 30, tzinfo=timezone.utc),
            paid_at=datetime(2025, 9, 15, tzinfo=timezone.utc),
        )
        db.add(bill_bob_acad1)

        bill_bob_acad2 = Bill(
            bill_id=uuid.uuid4(),
            user_id=bob["user_id"],
            academic_year="2025-26",
            user_name=bob["name"],
            user_email=bob["email"],
            program_name=bob["program_name"],
            user_class=bob["user_class"],
            bill_type="ACADEMIC",
            amount=Decimal("60000.00"),
            status="UNPAID",
            installment_number=2,
            total_installments=2,
            due_date=datetime(2026, 2, 28, tzinfo=timezone.utc),
        )
        db.add(bill_bob_acad2)
        await db.flush()

        payment_bob_acad1 = Payment(
            payment_id=uuid.uuid4(),
            bill_id=bill_bob_acad1.bill_id,
            user_id=bob["user_id"],
            razorpay_order_id="order_BOB1002ACAD1",
            razorpay_payment_id="pay_BOB1002ACAD1",
            razorpay_signature="sig_BOB1002ACAD1",
            amount=Decimal("60000.00"),
            status="SUCCESS",
            created_at=datetime(2025, 9, 15, tzinfo=timezone.utc),
        )
        db.add(payment_bob_acad1)
        await db.flush()

        receipt_bob_acad1 = Receipt(
            receipt_id=uuid.uuid4(),
            payment_id=payment_bob_acad1.payment_id,
            bill_id=bill_bob_acad1.bill_id,
            user_id=bob["user_id"],
            receipt_number="REC-20250915-BOBACAD",
            amount=Decimal("60000.00"),
            created_at=datetime(2025, 9, 15, tzinfo=timezone.utc),
        )
        db.add(receipt_bob_acad1)

        # 3. Charlie Brown (user_id: 1003)
        # - An unpaid HOSTEL bill
        charlie = students[2]

        bill_charlie_hostel = Bill(
            bill_id=uuid.uuid4(),
            user_id=charlie["user_id"],
            academic_year="2025-26",
            user_name=charlie["name"],
            user_email=charlie["email"],
            program_name="Hostel Accommodation",
            user_class=charlie["user_class"],
            bill_type="HOSTEL",
            amount=Decimal("35000.00"),
            status="UNPAID",
            due_date=datetime(2026, 7, 31, tzinfo=timezone.utc),
        )
        db.add(bill_charlie_hostel)

        await db.commit()
        logger.info("Demo database seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_demo_data())

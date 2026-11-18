
import firebase_config
from firebase_admin import db
from datetime import datetime, timezone
import uuid

TOLL_AMOUNT = 50
SCAN_COOLDOWN_SECONDS = 30


def process_payment(vehicle_id):
    vehicle_ref = db.reference(f"Vehicles/{vehicle_id}")
    transaction_id = str(uuid.uuid4())

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    result = {
        "success": False,
        "reason": ""
    }

    def update_vehicle(vehicle):
        if not vehicle:
            result["reason"] = "Vehicle not registered!"
            return vehicle

        if vehicle.get("status") != "ACTIVE":
            result["reason"] = "Vehicle is inactive!"
            return vehicle

        # Check the previous successful toll scan.
        last_toll = vehicle.get("last_toll_at")

        if last_toll:
            try:
                last_time = datetime.fromisoformat(last_toll)
                elapsed = (now - last_time).total_seconds()

                if elapsed < SCAN_COOLDOWN_SECONDS:
                    result["reason"] = (
                        f"Duplicate scan rejected! Please wait "
                        f"{int(SCAN_COOLDOWN_SECONDS - elapsed)} seconds."
                    )
                    return vehicle

            except (ValueError, TypeError):
                pass

        balance = float(vehicle.get("wallet_balance", 0))

        if balance < TOLL_AMOUNT:
            result["reason"] = "Insufficient wallet balance!"
            return vehicle

        # Deduct toll and save scan information together.
        vehicle["wallet_balance"] = balance - TOLL_AMOUNT
        vehicle["last_toll_at"] = now_iso
        vehicle["last_transaction_id"] = transaction_id

        return vehicle

    try:
        updated_vehicle = vehicle_ref.transaction(update_vehicle)

        # Confirm this transaction actually performed the deduction.
        if not updated_vehicle or updated_vehicle.get(
            "last_transaction_id"
        ) != transaction_id:
            print(result["reason"] or "Payment rejected!")
            return False

        transaction_data = {
            "transaction_id": transaction_id,
            "vehicle_id": vehicle_id,
            "amount": TOLL_AMOUNT,
            "status": "SUCCESS",
            "timestamp": now_iso
        }

        db.reference(
            f"transactions/{transaction_id}"
        ).set(transaction_data)

        print("\nPAYMENT SUCCESSFUL!")
        print("Vehicle:", vehicle_id)
        print("Toll deducted: ₹", TOLL_AMOUNT)
        print(
            "Remaining balance: ₹",
            updated_vehicle["wallet_balance"]
        )
        print("Transaction ID:", transaction_id)

        return True

    except Exception as error:
        print("Payment processing error:", error)
        return False


if __name__ == "__main__":
    process_payment("VEHICLE004")

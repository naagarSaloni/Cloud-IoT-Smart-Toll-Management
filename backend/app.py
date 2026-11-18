
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from firebase_admin import db
from datetime import datetime, timezone
from pathlib import Path
import uuid

import firebase_config
from qr_generator import generate_vehicle_qr
from payment import process_payment


app = FastAPI(title="Smart Toll Management API")


# ==========================================
# CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# HOME
# ==========================================

@app.get("/")
def home():
    return {
        "message": "Smart Toll Management API is running!",
        "status": "success"
    }


# ==========================================
# DASHBOARD STATISTICS
# ==========================================

@app.get("/api/dashboard")
def dashboard():

    vehicles = db.reference("Vehicles").get() or {}
    transactions = db.reference("transactions").get() or {}

    total_vehicles = len(vehicles)

    active_vehicles = sum(
        1 for v in vehicles.values()
        if str(v.get("status", "")).strip().upper() == "ACTIVE"
    )

    successful_tolls = [
        t for t in transactions.values()
        if str(t.get("status", "")).upper() == "SUCCESS"
        and t.get("type", "TOLL").upper() == "TOLL"
    ]

    total_collection = sum(
        float(t.get("amount", 0))
        for t in successful_tolls
    )

    total_transactions = len(transactions)

    return {
        "total_vehicles": total_vehicles,
        "active_vehicles": active_vehicles,
        "total_transactions": total_transactions,
        "total_collection": total_collection
    }


# ==========================================
# VEHICLE MANAGEMENT
# ==========================================

@app.get("/api/vehicles")
def get_vehicles():

    vehicles = db.reference("Vehicles").get() or {}

    result = []

    for vehicle_id, details in vehicles.items():

        result.append({
            "vehicle_id": vehicle_id,
            "owner": str(details.get("owner", "")).strip(),
            "vehicle_number": str(
                details.get("vehicle_number", "")
            ).strip().upper(),
            "wallet_balance": float(
                details.get("wallet_balance", 0)
            ),
            "status": str(
                details.get("status", "UNKNOWN")
            ).strip().upper()
        })

    return result


# ==========================================
# VEHICLE REGISTRATION
# ==========================================

class VehicleRegistration(BaseModel):

    vehicle_id: str = Field(
        min_length=3,
        max_length=30,
        pattern=r"^[A-Za-z0-9_-]+$"
    )

    owner: str = Field(min_length=2, max_length=100)

    vehicle_number: str = Field(
        min_length=5,
        max_length=20
    )

    wallet_balance: float = Field(ge=0)


@app.post("/api/vehicles")
def register_vehicle(vehicle: VehicleRegistration):

    vehicle_ref = db.reference(
        f"Vehicles/{vehicle.vehicle_id}"
    )

    if vehicle_ref.get():
        raise HTTPException(
            status_code=409,
            detail="Vehicle already registered!"
        )

    vehicle_data = {
        "owner": vehicle.owner.strip(),
        "vehicle_number": vehicle.vehicle_number.strip().upper(),
        "wallet_balance": vehicle.wallet_balance,
        "status": "ACTIVE"
    }

    try:
        qr_path = generate_vehicle_qr(vehicle.vehicle_id)
        vehicle_ref.set(vehicle_data)

        return {
            "message": "Vehicle registered successfully!",
            "vehicle_id": vehicle.vehicle_id,
            "vehicle": vehicle_data,
            "qr_download_url": f"/api/vehicles/{vehicle.vehicle_id}/qr"
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Registration failed: {str(error)}"
        )


# ==========================================
# WALLET RECHARGE
# ==========================================

class RechargeRequest(BaseModel):

    amount: float = Field(gt=0, le=1000000)


@app.post("/api/vehicles/{vehicle_id}/recharge")
def recharge_wallet(
    vehicle_id: str,
    request: RechargeRequest
):

    vehicle_ref = db.reference(f"Vehicles/{vehicle_id}")

    if not vehicle_ref.get():
        raise HTTPException(
            status_code=404,
            detail="Vehicle not registered!"
        )

    recharge_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    result = {"balance": None}

    def update_balance(vehicle):

        if not vehicle:
            return vehicle

        current_balance = float(
            vehicle.get("wallet_balance", 0)
        )

        new_balance = current_balance + request.amount

        vehicle["wallet_balance"] = round(new_balance, 2)

        result["balance"] = round(new_balance, 2)

        return vehicle

    try:

        updated_vehicle = vehicle_ref.transaction(update_balance)

        if not updated_vehicle:
            raise HTTPException(
                status_code=404,
                detail="Vehicle not found!"
            )

        new_balance = float(
            updated_vehicle.get("wallet_balance", 0)
        )

        transaction_data = {
            "transaction_id": recharge_id,
            "vehicle_id": vehicle_id,
            "amount": request.amount,
            "type": "RECHARGE",
            "status": "SUCCESS",
            "description": "Admin wallet recharge",
            "timestamp": now
        }

        db.reference(
            f"transactions/{recharge_id}"
        ).set(transaction_data)

        return {
            "success": True,
            "message": "Wallet recharged successfully!",
            "vehicle_id": vehicle_id,
            "recharged_amount": request.amount,
            "wallet_balance": new_balance,
            "transaction_id": recharge_id
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Recharge failed: {str(error)}"
        )


# ==========================================
# FRONTEND QR SCAN AND TOLL PAYMENT
# ==========================================

class ScanRequest(BaseModel):

    vehicle_id: str = Field(
        min_length=3,
        max_length=30,
        pattern=r"^[A-Za-z0-9_-]+$"
    )


@app.post("/api/scan")
def scan_vehicle(request: ScanRequest):

    vehicle_id = request.vehicle_id.strip()

    vehicle = db.reference(
        f"Vehicles/{vehicle_id}"
    ).get()

    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not registered!"
        )

    success = process_payment(vehicle_id)

    updated_vehicle = db.reference(
        f"Vehicles/{vehicle_id}"
    ).get() or {}

    if not success:

        return {
            "success": False,
            "message": "Payment failed or scan rejected.",
            "vehicle_id": vehicle_id,
            "wallet_balance": float(
                updated_vehicle.get("wallet_balance", 0)
            )
        }

    transaction_id = updated_vehicle.get(
        "last_transaction_id"
    )

    return {
        "success": True,
        "message": "Toll payment successful!",
        "vehicle_id": vehicle_id,
        "wallet_balance": float(
            updated_vehicle.get("wallet_balance", 0)
        ),
        "toll_amount": 50,
        "transaction_id": transaction_id
    }


# ==========================================
# QR CODE DOWNLOAD
# ==========================================

@app.get("/api/vehicles/{vehicle_id}/qr")
def download_vehicle_qr(vehicle_id: str):

    vehicle = db.reference(
        f"Vehicles/{vehicle_id}"
    ).get()

    if not vehicle:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found!"
        )

    qr_path = generate_vehicle_qr(vehicle_id)

    return FileResponse(
        path=qr_path,
        media_type="image/png",
        filename=f"{vehicle_id}.png"
    )


# ==========================================
# TRANSACTION HISTORY
# ==========================================

@app.get("/api/transactions")
def get_transactions(
    limit: int = Query(default=50, ge=1, le=500)
):

    transactions = db.reference("transactions").get() or {}

    result = list(transactions.values())

    result.sort(
        key=lambda t: t.get("timestamp", ""),
        reverse=True
    )

    return result[:limit]


# ==========================================
# SYSTEM STATUS
# ==========================================

@app.get("/api/system/status")
def get_system_status():

    system_data = db.reference("System/status").get() or {}

    return {
        "scanner_status": system_data.get(
            "scanner_status", "NOT_STARTED"
        ),
        "last_vehicle": system_data.get(
            "last_vehicle", "None"
        ),
        "last_payment_status": system_data.get(
            "last_payment_status", "WAITING"
        ),
        "last_transaction_id": system_data.get(
            "last_transaction_id", "None"
        ),
        "gate_status": system_data.get(
            "gate_status", "HARDWARE_NOT_CONNECTED"
        ),
        "last_updated": system_data.get(
            "last_updated", ""
        )
    }

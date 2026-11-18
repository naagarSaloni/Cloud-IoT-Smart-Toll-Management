
import cv2
import time
import os
from datetime import datetime, timezone

import firebase_config
from firebase_admin import db
from dotenv import load_dotenv

from payment import process_payment
from arduino_controller import open_gate


load_dotenv()

SYSTEM_REF = db.reference("System/status")

QR_RESET_SECONDS = 0.5

# Keep False until the Arduino is physically connected.
ARDUINO_ENABLED = (
    os.getenv("ARDUINO_ENABLED", "false").strip().lower() == "true"
)


def update_system_status(
    scanner_status=None,
    vehicle=None,
    payment_status=None,
    transaction_id=None,
    gate_status=None
):
    """Update live scanner, payment and gate information in Firebase."""

    updates = {
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

    if scanner_status is not None:
        updates["scanner_status"] = scanner_status

    if vehicle is not None:
        updates["last_vehicle"] = vehicle

    if payment_status is not None:
        updates["last_payment_status"] = payment_status

    if transaction_id is not None:
        updates["last_transaction_id"] = transaction_id

    if gate_status is not None:
        updates["gate_status"] = gate_status

    SYSTEM_REF.update(updates)


def start_qr_scanner():

    camera = cv2.VideoCapture(0)
    detector = cv2.QRCodeDetector()

    if not camera.isOpened():
        print("ERROR: Could not access webcam!")

        update_system_status(
            scanner_status="ERROR",
            gate_status=(
                "HARDWARE_NOT_CONNECTED"
                if not ARDUINO_ENABLED
                else "NOT_CONFIRMED"
            )
        )
        return

    print("\n===================================")
    print("   SMART TOLL QR SCANNER STARTED")
    print("===================================")
    print("Show a registered vehicle QR code.")
    print("Arduino enabled:", ARDUINO_ENABLED)
    print("Press Q to quit.\n")

    status_message = "Waiting for vehicle QR..."
    status_color = (255, 255, 255)

    last_processed_vehicle = None
    last_qr_seen_time = 0

    try:
        update_system_status(
            scanner_status="RUNNING",
            payment_status="WAITING",
            gate_status=(
                "READY"
                if ARDUINO_ENABLED
                else "HARDWARE_NOT_CONNECTED"
            )
        )

        while True:

            success, frame = camera.read()

            if not success:
                print("ERROR: Could not read camera frame.")
                break

            vehicle_id, points, _ = detector.detectAndDecode(frame)
            current_time = time.time()

            # Draw QR boundary.
            if points is not None:
                points = points.astype(int)

                for i in range(len(points[0])):
                    pt1 = tuple(points[0][i])
                    pt2 = tuple(points[0][(i + 1) % len(points[0])])

                    cv2.line(frame, pt1, pt2, (0, 255, 0), 3)

            # Process detected vehicle.
            if vehicle_id:

                vehicle_id = vehicle_id.strip()
                last_qr_seen_time = current_time

                if vehicle_id != last_processed_vehicle:

                    last_processed_vehicle = vehicle_id

                    print("\nQR CODE DETECTED!")
                    print("Vehicle ID:", vehicle_id)

                    status_message = "Processing payment..."
                    status_color = (0, 200, 255)

                    update_system_status(
                        scanner_status="RUNNING",
                        vehicle=vehicle_id,
                        payment_status="PROCESSING",
                        transaction_id="None"
                    )

                    payment_success = process_payment(vehicle_id)

                    if payment_success:

                        vehicle_data = db.reference(
                            f"Vehicles/{vehicle_id}"
                        ).get() or {}

                        transaction_id = vehicle_data.get(
                            "last_transaction_id", "None"
                        )

                        status_message = "PAYMENT SUCCESSFUL"
                        status_color = (0, 220, 0)

                        gate_status = "HARDWARE_NOT_CONNECTED"

                        # Send gate command only after successful payment.
                        if ARDUINO_ENABLED:

                            gate_command_sent = open_gate(transaction_id)

                            if gate_command_sent:
                                gate_status = "COMMAND_SENT"
                                print("Gate opening command sent to Arduino!")
                            else:
                                gate_status = "CONNECTION_ERROR"
                                print(
                                    "Payment succeeded, but Arduino "
                                    "command could not be sent."
                                )

                        else:
                            print(
                                "Arduino is disabled. "
                                "Gate command not sent."
                            )

                        update_system_status(
                            scanner_status="RUNNING",
                            vehicle=vehicle_id,
                            payment_status="SUCCESS",
                            transaction_id=transaction_id,
                            gate_status=gate_status
                        )

                        print("Toll payment completed successfully!")

                    else:

                        status_message = "PAYMENT FAILED - ACCESS DENIED"
                        status_color = (0, 0, 255)

                        update_system_status(
                            scanner_status="RUNNING",
                            vehicle=vehicle_id,
                            payment_status="FAILED",
                            transaction_id="None",
                            gate_status="CLOSED"
                        )

                        print("Payment failed. Gate remains closed.")

            else:

                # Reset after QR disappears.
                if (
                    last_processed_vehicle is not None
                    and current_time - last_qr_seen_time >= QR_RESET_SECONDS
                ):

                    last_processed_vehicle = None
                    status_message = "Waiting for next vehicle..."
                    status_color = (255, 255, 255)

            # Display scanner interface.
            cv2.rectangle(
                frame,
                (0, 0),
                (frame.shape[1], 100),
                (25, 30, 45),
                -1
            )

            cv2.putText(
                frame,
                "SMART TOLL MANAGEMENT SYSTEM",
                (20, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 255, 255),
                2
            )

            cv2.putText(
                frame,
                status_message,
                (20, 75),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                status_color,
                2
            )

            cv2.imshow("Smart Toll QR Scanner", frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                print("\nScanner stopped by user.")
                break

    except KeyboardInterrupt:
        print("\nScanner interrupted.")

    except Exception as error:
        print("Scanner error:", error)

    finally:

        try:
            update_system_status(scanner_status="STOPPED")
        except Exception as error:
            print("Could not update scanner status:", error)

        camera.release()
        cv2.destroyAllWindows()

        print("Camera released. Scanner closed.")


if __name__ == "__main__":
    start_qr_scanner()


import os
import time
import serial
from dotenv import load_dotenv

load_dotenv()

SERIAL_PORT = os.getenv("SERIAL_PORT", "COM3")
BAUD_RATE = int(os.getenv("SERIAL_BAUDRATE", "9600"))


def open_gate(transaction_id):

    try:
        print("Connecting to Arduino...")

        with serial.Serial(
            SERIAL_PORT,
            BAUD_RATE,
            timeout=5
        ) as arduino:

            # Arduino Uno resets when serial connection opens.
            time.sleep(2)

            command = f"OPEN:{transaction_id}\n"

            arduino.write(command.encode("utf-8"))
            arduino.flush()

            print("Gate opening command sent!")
            print("Waiting for Arduino acknowledgement...")

            response = arduino.readline().decode(
                "utf-8",
                errors="ignore"
            ).strip()

            if response == "GATE_OPENED":
                print("Arduino confirmed: Gate opened!")
                return True

            print("Arduino acknowledgement not received.")
            print("Arduino response:", response or "No response")

            return False

    except serial.SerialException as error:
        print("Arduino connection failed:", error)
        return False

    except Exception as error:
        print("Gate controller error:", error)
        return False


if __name__ == "__main__":
    open_gate("TEST001")

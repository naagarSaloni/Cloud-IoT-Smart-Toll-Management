
import qrcode
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
QR_FOLDER = BASE_DIR / "generated_qr"
QR_FOLDER.mkdir(exist_ok=True)

def generate_vehicle_qr(vehicle_id):
    qr = qrcode.make(vehicle_id)

    file_path = QR_FOLDER / f"{vehicle_id}.png"
    qr.save(file_path)

    print(f"QR generated successfully: {file_path}")
    return str(file_path)


if __name__ == "__main__":
    generate_vehicle_qr("VEHICLE001")

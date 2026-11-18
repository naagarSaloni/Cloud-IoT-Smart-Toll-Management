
# Cloud IoT-Based Smart Toll Plaza Management System

An intelligent toll plaza management system that automates vehicle identification, toll collection, wallet management, and gate control using QR codes, cloud technology, and IoT hardware.

## Features

- QR-based vehicle identification
- Automated toll deduction
- Digital vehicle registration
- QR code generation for registered vehicles
- Real-time wallet balance management
- Firebase Realtime Database integration
- Web-based admin dashboard
- Vehicle and transaction management
- Browser-based QR scanning
- Arduino-based automated gate control
- IR sensor integration
- Servo motor gate automation
- LCD status display

## Technology Stack

### Backend
- Python
- FastAPI
- Firebase Realtime Database
- OpenCV
- PySerial

### Frontend
- HTML
- CSS
- JavaScript

### IoT Hardware
- Arduino Uno
- Servo Motor
- IR Sensor
- LCD Display

## Project Architecture

Vehicle QR Code → QR Scanner → FastAPI Backend → Firebase Database → Wallet Validation → Toll Deduction → Arduino Gate Control

## Project Structure

```text
Smart-Toll-Management/
├── backend/
├── dashboard/
├── arduino/
├── generated_qr/
├── README.md
├── .gitignore
└── LICENSE
```

## Installation

1. Clone the repository:

   git clone https://github.com/YOUR-USERNAME/Cloud-IoT-Smart-Toll-Management.git

2. Navigate to the backend:

   cd Cloud-IoT-Smart-Toll-Management/backend

3. Create a virtual environment:

   python -m venv venv

4. Activate it on Windows:

   .\venv\Scripts\activate

5. Install dependencies:

   pip install -r requirements.txt

6. Configure Firebase credentials and environment variables in a local `.env` file.

7. Start the FastAPI server:

   uvicorn app:app --reload

8. Open the dashboard using VS Code Live Server.

## Configuration

Create a `.env` file inside the backend folder containing your Firebase database URL, credentials path, toll amount, and hardware configuration.

Never commit Firebase credentials or private configuration files.

## Project Status

Software dashboard, Firebase integration, vehicle registration, QR generation, wallet management, and QR scanning have been implemented. Physical hardware integration and final end-to-end testing are pending.

## Future Enhancements

- Online payment gateway integration
- Admin authentication and authorization
- Vehicle analytics and reporting
- Multi-lane toll management
- Enhanced cloud monitoring

## Author

YOUR NAME

## License

This project is licensed under the MIT License.

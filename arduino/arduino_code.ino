
#include <Servo.h>

// Hardware pins
const int SERVO_PIN = 9;
const int IR_SENSOR_PIN = 2;

// Servo positions
const int GATE_CLOSED_ANGLE = 0;
const int GATE_OPEN_ANGLE = 90;

// Change to LOW if your IR sensor detects objects with LOW output.
const int IR_DETECTED_STATE = HIGH;

Servo gateServo;

bool gateIsOpen = false;
String receivedCommand = "";

void setup() {

  Serial.begin(9600);

  gateServo.attach(SERVO_PIN);
  gateServo.write(GATE_CLOSED_ANGLE);

  pinMode(IR_SENSOR_PIN, INPUT);

  Serial.println("SMART_TOLL_READY");
}


void openGate(String transactionId) {

  Serial.print("Opening gate for transaction: ");
  Serial.println(transactionId);

  gateServo.write(GATE_OPEN_ANGLE);
  gateIsOpen = true;

  delay(500);

  Serial.println("GATE_OPENED");
}


void closeGate() {

  gateServo.write(GATE_CLOSED_ANGLE);
  gateIsOpen = false;

  Serial.println("GATE_CLOSED");
}


void loop() {

  // Read commands sent by Python.
  while (Serial.available()) {

    char receivedChar = Serial.read();

    if (receivedChar == '\n') {

      receivedCommand.trim();

      if (receivedCommand.startsWith("OPEN:")) {

        String transactionId = receivedCommand.substring(5);

        if (!gateIsOpen) {
          openGate(transactionId);
        } else {
          Serial.println("GATE_ALREADY_OPEN");
        }
      }

      receivedCommand = "";
    }

    else if (receivedChar != '\r') {
      receivedCommand += receivedChar;
    }
  }


  // Detect vehicle passage using IR sensor.
  if (gateIsOpen) {

    if (digitalRead(IR_SENSOR_PIN) == IR_DETECTED_STATE) {

      delay(1000);

      closeGate();
    }
  }

}

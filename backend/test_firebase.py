
import firebase_config
from firebase_admin import db

try:
    test_data = {
        "status": "Connected",
        "project": "Smart Toll Management"
    }

    # Write data
    db.reference("connection_test").set(test_data)

    print("Data written successfully!")

    # Read data
    result = db.reference("connection_test").get()

    print("Data retrieved:", result)

    if result == test_data:
        print("FIREBASE CONNECTION SUCCESSFUL!")
    else:
        print("Data verification failed!")

except Exception as error:
    print("Firebase connection failed:", error)
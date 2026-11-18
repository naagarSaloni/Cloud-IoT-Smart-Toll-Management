
import os
import firebase_admin

from pathlib import Path
from firebase_admin import credentials, db
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("FIREBASE_DATABASE_URL")

CREDENTIALS_PATH = os.getenv(
    "FIREBASE_CREDENTIALS",
    "serviceAccountKey.json"
)

if not DATABASE_URL:
    raise ValueError("Firebase database URL is missing in .env")

if not firebase_admin._apps:

    credential = credentials.Certificate(
        str(BASE_DIR / CREDENTIALS_PATH)
    )

    firebase_admin.initialize_app(
        credential,
        {"databaseURL": DATABASE_URL}
    )

print("Firebase initialized successfully!")

database = db.reference("/")

import os
import json
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URL: str = os.getenv("MONGODB_URL", "")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "examscan")

    # Results DB (marks-sheets service account)
    RESULTS_CREDENTIALS_FILE: str = os.getenv("RESULTS_CREDENTIALS_FILE", "results_credentials.json")
    RESULTS_CREDENTIALS_JSON: str = os.getenv("RESULTS_CREDENTIALS_JSON", "")  # JSON string for Render
    RESULTS_DB_SHEET_ID: str = os.getenv("RESULTS_DB_SHEET_ID", "")

    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    CLOUDINARY_CLOUD_NAME: str = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: str = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: str = os.getenv("CLOUDINARY_API_SECRET", "")
    SCANNER_MODE: str = os.getenv("SCANNER_MODE", "normal")
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

# If RESULTS_CREDENTIALS_JSON env var is set (Render deployment),
# write it to a file so gspread can use it
# Supports both raw JSON and base64-encoded JSON
if settings.RESULTS_CREDENTIALS_JSON:
    creds_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), settings.RESULTS_CREDENTIALS_FILE)
    print(f"Attempting to write credentials to: {creds_path}")
    print(f"RESULTS_CREDENTIALS_JSON length: {len(settings.RESULTS_CREDENTIALS_JSON)}")
    try:
        import base64
        creds_str = settings.RESULTS_CREDENTIALS_JSON.strip()
        creds_data = None
        
        # Try base64 decode first (preferred for Render to avoid escape issues)
        try:
            # Add padding if needed
            padding = 4 - len(creds_str) % 4
            if padding != 4:
                creds_str += '=' * padding
            decoded = base64.b64decode(creds_str).decode('utf-8')
            creds_data = json.loads(decoded)
            print("✓ Decoded base64 credentials successfully")
        except Exception as b64_err:
            print(f"Base64 decode failed: {b64_err}, trying raw JSON...")
            # Fall back to raw JSON
            try:
                creds_data = json.loads(settings.RESULTS_CREDENTIALS_JSON)
                print("✓ Parsed raw JSON credentials")
            except Exception as json_err:
                print(f"Raw JSON parse also failed: {json_err}")
        
        if creds_data:
            with open(creds_path, "w") as f:
                json.dump(creds_data, f)
            print(f"✓ Wrote Google credentials to {creds_path}")
            # Verify file was written
            if os.path.exists(creds_path):
                print(f"✓ Verified credentials file exists: {os.path.getsize(creds_path)} bytes")
        else:
            print("ERROR: Could not parse credentials from env var")
    except Exception as e:
        print(f"ERROR: Could not write credentials file: {e}")
        import traceback
        traceback.print_exc()
else:
    print("No RESULTS_CREDENTIALS_JSON env var set")

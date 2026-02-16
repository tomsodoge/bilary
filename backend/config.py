import os
from pathlib import Path
from dotenv import load_dotenv
from cryptography.fernet import Fernet

# Load environment variables
load_dotenv()

class Settings:
    # Database
    DATABASE_PATH: str = os.getenv("DATABASE_PATH", "./data/invoices.db")
    
    # Storage
    STORAGE_PATH: str = os.getenv("STORAGE_PATH", "./storage/invoices")
    
    # Security
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
    
    # CORS - split by comma and strip whitespace
    CORS_ORIGINS: list = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]
    
    # Email sync
    SYNC_INTERVAL_MINUTES: int = int(os.getenv("SYNC_INTERVAL_MINUTES", "30"))
    
    # IMAP defaults for t-online.de
    DEFAULT_IMAP_SERVER: str = "secureimap.t-online.de"
    DEFAULT_IMAP_PORT: int = 993
    DEFAULT_USE_SSL: bool = True

    # Google OAuth (for "Mit Google anmelden")
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")
    # Backend URL for OAuth redirect_uri (must match Google Cloud Console)
    BACKEND_URL: str = os.getenv("BACKEND_URL", "http://localhost:8000")
    
    # Search keywords for invoice detection (extended for better recall)
    INVOICE_KEYWORDS: list = [
        # German keywords
        "rechnung", "rechnungsnummer", "rechnung nr", "rechnung nr.", "rechnung #",
        "beleg", "zahlung", "betrag", "gesamtbetrag", "zahlungsziel",
        "quittung", "belegnummer", "bestätigung",
        # English keywords
        "invoice", "invoice number", "invoice #", "invoice id", "invoice id:",
        "invoice no", "invoice no.",
        "bill", "bill #", "statement", "statement of account",
        "payment", "amount due", "total", "payment due",
        "receipt", "receipt number", "transaction", "order confirmation",
        # Service-specific
        "harvest", "transaction id",
    ]

    # Patterns that indicate newsletter/spam (excluded unless email has PDF)
    NEWSLETTER_SPAM_KEYWORDS: list = [
        "newsletter", "news letter", "digest", "weekly digest", "daily digest",
        "abmelden", "unsubscribe", "melde dich ab", "update von", "ihr update",
        "wochenrückblick", "monatsrückblick", "roundup", "zusammenfassung der woche",
        "your weekly", "your daily", "top stories", "breaking news",
    ]
    
    def __init__(self):
        # Ensure directories exist
        try:
            Path(self.DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
            Path(self.STORAGE_PATH).mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"Warning: Could not create directories: {e}")
            # Continue anyway - Railway will create them if needed

settings = Settings()

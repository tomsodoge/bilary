from urllib.parse import urlencode, urlparse
import json
from pathlib import Path
import httpx
from fastapi import APIRouter, HTTPException, status, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from database.models import UserCreate, User, ConnectionStatus, AccountInfo
from database.db import db
from services.crypto_service import crypto_service
from services.email_service import email_service
from config import settings
from typing import List

router = APIRouter(prefix="/api/auth", tags=["authentication"])

DEBUG_LOG_PATH = "/Users/tomsodoge/Desktop/bilary/.cursor/debug.log"

# Google OAuth
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"

# Gmail IMAP settings
GMAIL_IMAP_SERVER = "imap.gmail.com"
GMAIL_IMAP_PORT = 993


def _is_gmail(email: str) -> bool:
    return email and ("gmail.com" in email.lower() or "googlemail.com" in email.lower())


@router.post("/connect", response_model=ConnectionStatus)
async def connect_email(user_data: UserCreate):
    """
    Add or update an email account (mailbox). Supports multiple mailboxes.
    Encrypts and stores credentials. Use Gmail App Password for Gmail.
    """
    try:
        # Auto-fill IMAP server for Gmail
        if _is_gmail(user_data.email):
            user_data.imap_server = GMAIL_IMAP_SERVER
            user_data.imap_port = GMAIL_IMAP_PORT
        elif "t-online.de" in user_data.email and not user_data.imap_server:
            user_data.imap_server = settings.DEFAULT_IMAP_SERVER
        
        # Test IMAP connection
        connected = email_service.connect(
            user_data.email,
            user_data.password,
            user_data.imap_server,
            user_data.imap_port
        )
        
        if not connected:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to connect to email server. For Gmail, use an App Password (not your normal password)."
            )
        
        # Encrypt password
        encrypted_password = crypto_service.encrypt(user_data.password)
        
        # Check if this email already exists
        existing_user = await db.fetch_one(
            "SELECT id FROM users WHERE email = ?",
            (user_data.email,)
        )
        
        if existing_user:
            await db.execute(
                """UPDATE users 
                   SET encrypted_password = ?, imap_server = ?, imap_port = ?
                   WHERE email = ?""",
                (encrypted_password, user_data.imap_server, user_data.imap_port, user_data.email)
            )
        else:
            await db.execute(
                """INSERT INTO users (email, encrypted_password, imap_server, imap_port)
                   VALUES (?, ?, ?, ?)""",
                (user_data.email, encrypted_password, user_data.imap_server, user_data.imap_port)
            )
        
        email_service.disconnect()
        
        # Return status with full account list
        accounts = await db.fetch_all(
            "SELECT id, email, imap_server, imap_port, created_at FROM users ORDER BY created_at ASC"
        )
        return ConnectionStatus(
            connected=True,
            email=user_data.email,
            message="Mailbox connected successfully",
            accounts=[AccountInfo(**a) for a in accounts]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error connecting to email: {str(e)}"
        )


@router.get("/google")
async def google_signin(request: Request):
    """Redirect to Google OAuth consent screen."""
    mode = request.query_params.get("mode") or "redirect"

    # region agent log
    try:
        Path(DEBUG_LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
        with open(DEBUG_LOG_PATH, "a") as f:
            f.write(
                json.dumps(
                    {
                        "id": "log_google_signin_entry",
                        "timestamp": __import__("time").time(),
                        "location": "backend/routers/auth.py:google_signin",
                        "message": "google_signin entry",
                        "runId": "pre-fix",
                        "hypothesisId": "H1",
                        "data": {
                            "mode": mode,
                            "has_client_id": bool(settings.GOOGLE_CLIENT_ID),
                            "has_client_secret": bool(settings.GOOGLE_CLIENT_SECRET),
                            "client_host": request.client.host if request.client else None,
                            "origin_header": request.headers.get("origin"),
                            "referer_header": request.headers.get("referer"),
                        },
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # endregion

    # Wenn Google noch nicht konfiguriert ist, sauber zurück ins Frontend leiten
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        # region agent log
        try:
            Path(DEBUG_LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
            with open(DEBUG_LOG_PATH, "a") as f:
                f.write(
                    json.dumps(
                        {
                            "id": "log_google_signin_not_configured",
                            "timestamp": __import__("time").time(),
                            "location": "backend/routers/auth.py:google_signin",
                            "message": "google_signin not configured branch",
                            "runId": "pre-fix",
                            "hypothesisId": "H1",
                            "data": {
                                "mode": mode,
                                "client_id_present": bool(settings.GOOGLE_CLIENT_ID),
                                "client_secret_present": bool(settings.GOOGLE_CLIENT_SECRET),
                            },
                        }
                    )
                    + "\n"
                )
        except Exception:
            pass
        # endregion
        # Im Popup-Modus direkt ein kleines HTML zurückgeben, das das Fenster schließt
        if mode == "popup":
            html = """
            <html>
              <body>
                <script>
                  if (window.opener) {
                    window.opener.postMessage('google-auth-error-not-configured', '*');
                  }
                  window.close();
                </script>
              </body>
            </html>
            """
            return HTMLResponse(content=html)

        return RedirectResponse(
            url=f"{settings.FRONTEND_URL.rstrip('/')}/connect?google=not_configured",
            status_code=status.HTTP_302_FOUND,
        )

    redirect_uri = f"{settings.BACKEND_URL.rstrip('/')}/api/auth/google/callback"
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": f"openid email profile {GMAIL_READ_SCOPE}",
        "access_type": "offline",
        "prompt": "consent",
        # Modus (popup vs redirect) im OAuth-State transportieren
        "state": mode,
    }
    url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    
    # region agent log
    try:
        Path(DEBUG_LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
        with open(DEBUG_LOG_PATH, "a") as f:
            f.write(
                json.dumps(
                    {
                        "id": "log_google_signin_redirect",
                        "timestamp": __import__("time").time(),
                        "location": "backend/routers/auth.py:google_signin",
                        "message": "redirecting to Google OAuth",
                        "runId": "pre-fix",
                        "hypothesisId": "H4",
                        "data": {
                            "redirect_uri": redirect_uri,
                            "google_auth_url": GOOGLE_AUTH_URL,
                            "mode": mode,
                        },
                    }
                )
                + "\n"
            )
    except Exception:
        pass
    # endregion
    
    return RedirectResponse(url=url)


@router.get("/google/callback")
async def google_callback(code: str, state: str = None):
    """
    Exchange OAuth code for tokens and create/update user.
    Called by frontend after redirect from Google (frontend gets ?code=... and sends it here).
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google Sign-In not configured")
    redirect_uri = f"{settings.BACKEND_URL.rstrip('/')}/api/auth/google/callback"
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if token_res.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google token exchange failed",
        )
    token_data = token_res.json()
    refresh_token = token_data.get("refresh_token")
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No access token from Google")

    async with httpx.AsyncClient() as client:
        user_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if user_res.status_code != 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to get Google user info")
    user_info = user_res.json()
    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No email in Google profile")

    # Store placeholder password (required by schema) and encrypted refresh token
    placeholder = crypto_service.encrypt("oauth:google")
    encrypted_refresh = crypto_service.encrypt(refresh_token) if refresh_token else None

    existing = await db.fetch_one("SELECT id FROM users WHERE email = ?", (email,))
    if existing:
        if encrypted_refresh:
            await db.execute(
                """UPDATE users SET encrypted_password = ?, encrypted_refresh_token = ?, imap_server = ?, imap_port = ?
                   WHERE email = ?""",
                (placeholder, encrypted_refresh, GMAIL_IMAP_SERVER, GMAIL_IMAP_PORT, email),
            )
        else:
            await db.execute(
                """UPDATE users SET encrypted_password = ?, imap_server = ?, imap_port = ? WHERE email = ?""",
                (placeholder, GMAIL_IMAP_SERVER, GMAIL_IMAP_PORT, email),
            )
    else:
        await db.execute(
            """INSERT INTO users (email, encrypted_password, imap_server, imap_port, encrypted_refresh_token)
               VALUES (?, ?, ?, ?, ?)""",
            (email, placeholder, GMAIL_IMAP_SERVER, GMAIL_IMAP_PORT, encrypted_refresh),
        )

    # Wenn der Flow im Popup lief, schließe das Fenster und benachrichtige den Opener
    if state == "popup":
        parsed = urlparse(settings.FRONTEND_URL)
        frontend_origin = f"{parsed.scheme}://{parsed.netloc}"
        html = f"""
        <html>
          <body>
            <script>
              if (window.opener) {{
                try {{
                  window.opener.postMessage('google-auth-success', '{frontend_origin}');
                }} catch (e) {{
                  window.opener.postMessage('google-auth-success', '*');
                }}
              }}
              window.close();
            </script>
          </body>
        </html>
        """
        return HTMLResponse(content=html)

    # Redirect back to frontend connect page with success
    return RedirectResponse(url=f"{settings.FRONTEND_URL.rstrip('/')}/connect?google=success")


@router.get("/accounts", response_model=List[AccountInfo])
async def list_accounts():
    """List all connected mailboxes (no password check)."""
    try:
        rows = await db.fetch_all(
            "SELECT id, email, imap_server, imap_port, created_at FROM users ORDER BY created_at ASC"
        )
        return [AccountInfo(**r) for r in rows]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.delete("/accounts/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_account(user_id: int):
    """Remove a connected mailbox. Its invoices remain in the database."""
    try:
        existing = await db.fetch_one("SELECT id FROM users WHERE id = ?", (user_id,))
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        await db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/status", response_model=ConnectionStatus)
async def get_connection_status():
    """
    Check if any mailbox is connected. Returns list of accounts (no password verification).
    """
    try:
        accounts = await db.fetch_all(
            "SELECT id, email, imap_server, imap_port, created_at FROM users ORDER BY created_at ASC"
        )
        
        if not accounts:
            return ConnectionStatus(
                connected=False,
                message="No mailboxes connected"
            )
        
        account_list = [AccountInfo(**a) for a in accounts]
        primary = accounts[0]["email"]
        return ConnectionStatus(
            connected=True,
            email=primary,
            message=f"{len(accounts)} mailbox(es) connected",
            accounts=account_list
        )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking connection status: {str(e)}"
        )

"""
Fetch emails via Gmail API using OAuth2 refresh token.
Used for accounts connected via "Mit Google anmelden".

This module exposes its functions directly; we import the module as
`services.gmail_service` and call its functions. There is intentionally
no `gmail_service` object to import.
"""
import base64
from datetime import datetime
from typing import List, Dict, Optional
import httpx
from config import settings
from services.email_service import email_service

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


def get_access_token(refresh_token: str) -> Optional[str]:
    """Exchange refresh token for access token."""
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        return None
    with httpx.Client() as client:
        r = client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if r.status_code != 200:
        return None
    return r.json().get("access_token")


def search_invoices(
    access_token: str,
    days_back: int = 30,
    year: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    include_all: bool = False,
) -> List[Dict]:
    """
    List messages in range via Gmail API, fetch raw RFC822, and run same
    invoice detection as IMAP path. Returns same structure as email_service.search_invoices.
    """
    from datetime import timedelta

    if year:
        after = f"{year}/01/01"
        before = f"{year + 1}/01/01"
    elif start_date and end_date:
        after = start_date.strftime("%Y/%m/%d")
        before = (end_date + timedelta(days=1)).strftime("%Y/%m/%d")
    else:
        since = datetime.now() - timedelta(days=days_back)
        after = since.strftime("%Y/%m/%d")
        before = (datetime.now() + timedelta(days=1)).strftime("%Y/%m/%d")

    query = f"after:{after} before:{before}"
    headers = {"Authorization": f"Bearer {access_token}"}
    invoices = []

    with httpx.Client() as client:
        # Paginate through message ids
        page_token = None
        while True:
            list_url = f"{GMAIL_API_BASE}/messages"
            params = {"q": query, "maxResults": 100}
            if page_token:
                params["pageToken"] = page_token
            r = client.get(list_url, params=params, headers=headers)
            if r.status_code != 200:
                break
            data = r.json()
            messages = data.get("messages") or []
            for msg_ref in messages:
                msg_id = msg_ref["id"]
                get_r = client.get(
                    f"{GMAIL_API_BASE}/messages/{msg_id}",
                    params={"format": "raw"},
                    headers=headers,
                )
                if get_r.status_code != 200:
                    continue
                raw_b64 = get_r.json().get("raw")
                if not raw_b64:
                    continue
                raw_bytes = base64.urlsafe_b64decode(raw_b64)
                invoice_data = email_service.process_raw_message(raw_bytes, include_all=include_all)
                if invoice_data:
                    invoices.append(invoice_data)
            page_token = data.get("nextPageToken")
            if not page_token:
                break

    return invoices

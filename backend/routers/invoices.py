from fastapi import APIRouter, HTTPException, status, Query
from typing import Optional, List
from datetime import datetime
from database.models import Invoice, InvoiceUpdate, SyncResponse
from database.db import db
from services.crypto_service import crypto_service
from services.email_service import email_service
from services import gmail_service
from services.categorizer import categorizer
from services.pdf_service import pdf_service
from pathlib import Path

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


async def _sync_one_user(user: dict, days_back: int, year: Optional[int], include_all: bool):
    """Sync invoices for a single user (IMAP or Gmail OAuth)."""
    invoice_emails = []
    use_gmail_api = user.get("encrypted_refresh_token")

    if use_gmail_api:
        refresh_token = crypto_service.decrypt(user["encrypted_refresh_token"])
        access_token = gmail_service.get_access_token(refresh_token)
        if not access_token:
            return 0, 0
        invoice_emails = gmail_service.search_invoices(
            access_token,
            days_back=days_back,
            year=year,
            include_all=include_all,
        )
    else:
        decrypted_password = crypto_service.decrypt(user["encrypted_password"])
        if decrypted_password and decrypted_password.startswith("oauth:"):
            return 0, 0  # OAuth user but no refresh token
        connected = email_service.connect(
            user["email"],
            decrypted_password,
            user["imap_server"],
            user["imap_port"],
        )
        if not connected:
            return 0, 0
        invoice_emails = email_service.search_invoices(
            days_back=days_back,
            year=year,
            include_all=include_all,
        )
    # DIAGNOSTIC: Log how many invoice emails were found
    print(f"[SYNC DIAG] User {user['id']} ({user['email']}): Found {len(invoice_emails)} invoice emails from email service")
    
    invoices_added = 0
    duplicates_skipped = 0
    processing_errors = 0
    
    for idx, invoice_data in enumerate(invoice_emails):
        try:
            # DIAGNOSTIC: Log progress every 100 invoices
            if (idx + 1) % 100 == 0:
                print(f"[SYNC DIAG] Processing invoice {idx + 1}/{len(invoice_emails)}: added={invoices_added}, skipped={duplicates_skipped}, errors={processing_errors}")
            
            existing = await db.fetch_one(
                """SELECT id FROM invoices 
                   WHERE user_id = ? AND sender_email = ? AND received_date = ?""",
                (user["id"], invoice_data["sender_email"], invoice_data["received_date"])
            )
            if existing:
                duplicates_skipped += 1
                continue
            
            category = categorizer.categorize(
                invoice_data["subject"],
                invoice_data.get("email_body", "")
            )
            
            # DIAGNOSTIC: Log before insert
            if idx < 5:  # Log first 5 inserts for debugging
                print(f"[SYNC DIAG] Inserting invoice: sender={invoice_data.get('sender_email')}, date={invoice_data.get('received_date')}, subject={invoice_data.get('subject', '')[:50]}")
            
            invoice_id = await db.execute(
                """INSERT INTO invoices 
                   (user_id, sender_email, sender_name, subject, received_date, 
                    file_url, category, is_private)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    user["id"],
                    invoice_data["sender_email"],
                    invoice_data["sender_name"],
                    invoice_data["subject"],
                    invoice_data["received_date"],
                    invoice_data.get("invoice_url"),
                    category,
                    False
                )
            )
            
            # DIAGNOSTIC: Verify insert succeeded
            if idx < 5:
                verify = await db.fetch_one("SELECT id FROM invoices WHERE id = ?", (invoice_id,))
                print(f"[SYNC DIAG] Insert verified: invoice_id={invoice_id}, exists={verify is not None}")
            
            for attachment in invoice_data.get("pdf_attachments", []):
                file_path = email_service.save_attachment(
                    attachment["content"],
                    attachment["filename"],
                    user["id"],
                    invoice_id
                )
                if file_path:
                    await db.execute(
                        "UPDATE invoices SET file_path = ? WHERE id = ?",
                        (file_path, invoice_id)
                    )
                    pdf_text = pdf_service.extract_first_page(file_path)
                    if pdf_text:
                        better_category = categorizer.categorize(
                            invoice_data["subject"],
                            pdf_text[:1000]
                        )
                        if better_category != "Other":
                            await db.execute(
                                "UPDATE invoices SET category = ? WHERE id = ?",
                                (better_category, invoice_id)
                            )
                    await db.execute(
                        """INSERT INTO attachments (invoice_id, filename, file_size, mime_type)
                           VALUES (?, ?, ?, ?)""",
                        (invoice_id, attachment["filename"], len(attachment["content"]), "application/pdf")
                    )
            invoices_added += 1
        except Exception as e:
            processing_errors += 1
            print(f"[SYNC DIAG] ERROR processing invoice {idx + 1}: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            continue
    
    # DIAGNOSTIC: Final summary for this user
    print(f"[SYNC DIAG] User {user['id']} COMPLETE: processed={len(invoice_emails)}, added={invoices_added}, skipped={duplicates_skipped}, errors={processing_errors}")
    
    # DIAGNOSTIC: Verify invoices were actually saved
    saved_count = await db.fetch_one(
        "SELECT COUNT(*) as count FROM invoices WHERE user_id = ?",
        (user["id"],)
    )
    total_saved = saved_count["count"] if saved_count else 0
    print(f"[SYNC DIAG] User {user['id']} total invoices in DB after sync: {total_saved}")
    
    if not use_gmail_api:
        email_service.disconnect()
    return invoices_added, duplicates_skipped


@router.post("/sync", response_model=SyncResponse)
async def sync_invoices(
    days_back: int = Query(30, description="Number of days to search back"),
    year: Optional[int] = Query(None, description="Specific year to sync (e.g., 2025)"),
    include_all: bool = Query(False, description="Include all emails even without keywords/PDFs"),
    user_id: Optional[int] = Query(None, description="Sync only this mailbox; if omitted, sync all")
):
    """
    Sync invoices from connected mailbox(es). If user_id is omitted, syncs all connected mailboxes.
    """
    try:
        if user_id:
            users = await db.fetch_all("SELECT * FROM users WHERE id = ?", (user_id,))
        else:
            users = await db.fetch_all("SELECT * FROM users ORDER BY created_at ASC")
        
        if not users:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No mailboxes connected. Please connect at least one mailbox first."
            )
        
        # DIAGNOSTIC: Check database state before sync
        before_count = await db.fetch_one("SELECT COUNT(*) as count FROM invoices", ())
        before_total = before_count["count"] if before_count else 0
        print(f"[SYNC DIAG] Database state BEFORE sync: {before_total} total invoices")
        
        total_added = 0
        total_skipped = 0
        for user in users:
            added, skipped = await _sync_one_user(dict(user), days_back, year, include_all)
            total_added += added
            total_skipped += skipped
        
        # DIAGNOSTIC: Check database state after sync
        after_count = await db.fetch_one("SELECT COUNT(*) as count FROM invoices", ())
        after_total = after_count["count"] if after_count else 0
        print(f"[SYNC DIAG] Database state AFTER sync: {after_total} total invoices (was {before_total}, added {after_total - before_total})")
        print(f"[SYNC DIAG] Sync reported: added={total_added}, skipped={total_skipped}")
        
        return SyncResponse(
            success=True,
            invoices_found=total_added,
            message=f"Synced {total_added} new invoices from {len(users)} mailbox(es) (skipped {total_skipped} duplicates)"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error syncing invoices: {str(e)}"
        )

@router.get("/", response_model=List[Invoice])
async def list_invoices(
    sender: Optional[str] = None,
    category: Optional[str] = None,
    is_private: Optional[bool] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: Optional[int] = Query(500, description="Max number of invoices to return")
):
    """
    List all invoices with optional filters.
    Limited to 500 invoices by default for performance.
    If no start_date provided, defaults to last 90 days.
    """
    try:
        # #region agent log
        print(f"[API LIST] Filters: sender={sender}, category={category}, is_private={is_private}, start_date={start_date}, end_date={end_date}, limit={limit}")
        # #endregion
        
        # DIAGNOSTIC: Count total invoices in database
        total_count = await db.fetch_one("SELECT COUNT(*) as count FROM invoices", ())
        total_invoices = total_count["count"] if total_count else 0
        print(f"[DIAG] Total invoices in database: {total_invoices}")
        
        # Build query
        query = "SELECT * FROM invoices WHERE 1=1"
        params = []
        
        # Default to last 30 days if no date filters provided
        if not start_date and not end_date:
            from datetime import datetime, timedelta
            default_start = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            query += " AND received_date >= ?"
            params.append(default_start)
            # #region agent log
            print(f"[API LIST] No date filter provided, defaulting to last 30 days from {default_start}")
            # #endregion
            
            # DIAGNOSTIC: Count invoices matching default 30-day filter
            matching_count = await db.fetch_one(
                "SELECT COUNT(*) as count FROM invoices WHERE received_date >= ?",
                (default_start,)
            )
            matching_invoices = matching_count["count"] if matching_count else 0
            print(f"[DIAG] Invoices matching default 30-day filter (>= {default_start}): {matching_invoices}")
            print(f"[DIAG] Invoices excluded by 30-day filter: {total_invoices - matching_invoices}")
        
        if sender:
            query += " AND sender_email = ?"
            params.append(sender)
        
        if category:
            query += " AND category = ?"
            params.append(category)
        
        if is_private is not None:
            query += " AND is_private = ?"
            params.append(1 if is_private else 0)
        
        if start_date:
            query += " AND received_date >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND received_date <= ?"
            params.append(end_date)
        
        query += " ORDER BY received_date DESC"
        
        # Add limit to prevent performance issues
        if limit:
            query += f" LIMIT {limit}"
        
        invoices = await db.fetch_all(query, tuple(params))
        # #region agent log
        print(f"[API] Returning {len(invoices)} invoices (limit={limit})")
        # #endregion
        
        # DIAGNOSTIC: Show date range of returned invoices
        if invoices:
            dates = [inv["received_date"] for inv in invoices if inv.get("received_date")]
            if dates:
                min_date = min(dates)
                max_date = max(dates)
                print(f"[DIAG] Returned invoices date range: {min_date} to {max_date}")
            print(f"[DIAG] Returned invoices count: {len(invoices)}/{limit if limit else 'unlimited'}")
        else:
            print(f"[DIAG] No invoices returned (query matched 0 results)")
        
        return invoices
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching invoices: {str(e)}"
        )

@router.get("/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: int):
    """Get single invoice by ID"""
    try:
        invoice = await db.fetch_one(
            "SELECT * FROM invoices WHERE id = ?",
            (invoice_id,)
        )
        
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invoice not found"
            )
        
        return invoice
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching invoice: {str(e)}"
        )

@router.patch("/{invoice_id}", response_model=Invoice)
async def update_invoice(invoice_id: int, update_data: InvoiceUpdate):
    """Update invoice category or private flag"""
    try:
        # Check if invoice exists
        invoice = await db.fetch_one(
            "SELECT * FROM invoices WHERE id = ?",
            (invoice_id,)
        )
        
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invoice not found"
            )
        
        # Build update query
        updates = []
        params = []
        
        if update_data.category is not None:
            updates.append("category = ?")
            params.append(update_data.category)
        
        if update_data.is_private is not None:
            updates.append("is_private = ?")
            params.append(1 if update_data.is_private else 0)
        
        if updates:
            query = f"UPDATE invoices SET {', '.join(updates)} WHERE id = ?"
            params.append(invoice_id)
            await db.execute(query, tuple(params))
        
        # Fetch and return updated invoice
        updated_invoice = await db.fetch_one(
            "SELECT * FROM invoices WHERE id = ?",
            (invoice_id,)
        )
        
        return updated_invoice
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating invoice: {str(e)}"
        )

@router.delete("/{invoice_id}")
async def delete_invoice(invoice_id: int):
    """Delete invoice and associated files"""
    try:
        # Get invoice
        invoice = await db.fetch_one(
            "SELECT * FROM invoices WHERE id = ?",
            (invoice_id,)
        )
        
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invoice not found"
            )
        
        # Delete file if exists
        if invoice["file_path"]:
            try:
                Path(invoice["file_path"]).unlink(missing_ok=True)
            except Exception as e:
                print(f"Error deleting file: {e}")
        
        # Delete from database (cascade will delete attachments)
        await db.execute("DELETE FROM invoices WHERE id = ?", (invoice_id,))
        
        return {"message": "Invoice deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting invoice: {str(e)}"
        )

@router.get("/senders/list")
async def list_senders():
    """Get list of all unique senders"""
    try:
        senders = await db.fetch_all(
            """SELECT DISTINCT sender_email, sender_name 
               FROM invoices 
               ORDER BY sender_name"""
        )
        return senders
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching senders: {str(e)}"
        )

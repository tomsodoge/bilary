from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
from pathlib import Path
import zipfile
import io
from datetime import datetime
from database.db import db

router = APIRouter(prefix="/api/export", tags=["export"])

@router.get("/zip")
async def export_invoices_zip(
    year: int = Query(..., description="Year to export"),
    month: Optional[int] = Query(None, description="Month to export (1-12), omit for full year"),
    type: str = Query("business", description="Export type: business or private")
):
    """
    Export invoices as ZIP file with organized structure.
    Structure: Month/Company/invoice.pdf
    """
    try:
        # Build query based on parameters
        query = """
            SELECT * FROM invoices 
            WHERE strftime('%Y', received_date) = ?
        """
        params = [str(year)]
        
        if month:
            query += " AND strftime('%m', received_date) = ?"
            params.append(f"{month:02d}")
        
        # Filter by type
        if type == "private":
            query += " AND is_private = 1"
        else:
            query += " AND is_private = 0"
        
        query += " AND file_path IS NOT NULL AND file_path != ''"
        query += " ORDER BY received_date, sender_name"
        
        invoices = await db.fetch_all(query, tuple(params))
        
        if not invoices:
            raise HTTPException(
                status_code=404,
                detail="No invoices found for the specified criteria"
            )
        
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Organize invoices by month and sender
            for invoice in invoices:
                try:
                    # Parse date
                    invoice_date = datetime.fromisoformat(invoice["received_date"].replace("Z", "+00:00"))
                    
                    # Create folder structure: Month/Company/
                    month_folder = invoice_date.strftime("%m-%B")  # e.g., "01-January"
                    company_folder = invoice["sender_name"] or invoice["sender_email"].split('@')[0]
                    
                    # Sanitize folder names
                    company_folder = "".join(c for c in company_folder if c.isalnum() or c in (' ', '-', '_')).strip()
                    
                    # Get filename from path
                    file_path = Path(invoice["file_path"])
                    
                    if file_path.exists():
                        # Create archive path
                        archive_path = f"{month_folder}/{company_folder}/{file_path.name}"
                        
                        # Add file to ZIP
                        zip_file.write(file_path, archive_path)
                    
                except Exception as e:
                    print(f"Error adding invoice {invoice['id']} to ZIP: {e}")
                    continue
        
        # Prepare response
        zip_buffer.seek(0)
        
        # Generate filename
        if month:
            filename = f"invoices-{year}-{month:02d}-{type}.zip"
        else:
            filename = f"invoices-{year}-{type}.zip"
        
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error creating ZIP export: {str(e)}"
        )

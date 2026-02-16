import imaplib
import email
from email.header import decode_header
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import re
from config import settings
from services.crypto_service import crypto_service
from services.pdf_service import pdf_service
from services.categorizer import categorizer

class EmailService:
    """Service for connecting to email via IMAP and extracting invoices"""
    
    def __init__(self):
        self.connection: Optional[imaplib.IMAP4_SSL] = None
        self.email_address: Optional[str] = None
    
    def connect(self, email_address: str, password: str, server: str, port: int = 993) -> bool:
        """
        Connect to IMAP server.
        Returns True if connection successful, False otherwise.
        """
        try:
            self.connection = imaplib.IMAP4_SSL(server, port)
            self.connection.login(email_address, password)
            self.email_address = email_address
            return True
        except Exception as e:
            print(f"IMAP connection error: {e}")
            self.connection = None
            return False
    
    def disconnect(self):
        """Disconnect from IMAP server"""
        if self.connection:
            try:
                self.connection.logout()
            except Exception:
                pass
            self.connection = None
    
    def is_connected(self) -> bool:
        """Check if currently connected"""
        return self.connection is not None
    
    def search_invoices(self, days_back: int = 30, year: Optional[int] = None, 
                       start_date: Optional[datetime] = None, 
                       end_date: Optional[datetime] = None,
                       include_all: bool = False) -> List[Dict]:
        """
        Search for emails containing invoices.
        
        Args:
            days_back: Number of days to search back (default 30)
            year: Specific year to search (e.g., 2025)
            start_date: Custom start date
            end_date: Custom end date
            include_all: If True, includes all emails even without keywords/PDFs
        
        Returns list of invoice dictionaries.
        """
        if not self.connection:
            raise Exception("Not connected to email server")
        
        invoices = []
        
        try:
            # Select inbox
            self.connection.select("INBOX")
            
            # Determine date range
            if year:
                # Search entire year
                since_date = f"01-Jan-{year}"
                before_date = f"01-Jan-{year + 1}"
                search_query = f'SINCE {since_date} BEFORE {before_date}'
                print(f"Searching year {year}: {since_date} to {before_date}")
            elif start_date and end_date:
                # Custom date range
                since_date = start_date.strftime("%d-%b-%Y")
                # Add 1 day to end_date for BEFORE (IMAP BEFORE is exclusive)
                before_date = (end_date + timedelta(days=1)).strftime("%d-%b-%Y")
                search_query = f'SINCE {since_date} BEFORE {before_date}'
                print(f"Searching date range: {since_date} to {before_date}")
            elif start_date:
                # From start_date onwards
                since_date = start_date.strftime("%d-%b-%Y")
                search_query = f'SINCE {since_date}'
                print(f"Searching from: {since_date}")
            else:
                # Default: days_back from now
                since_date = (datetime.now() - timedelta(days=days_back)).strftime("%d-%b-%Y")
                search_query = f'SINCE {since_date}'
                print(f"Searching last {days_back} days from: {since_date}")
            
            # Search for all emails in date range
            status, messages = self.connection.search(None, search_query)
            
            if status != "OK":
                print(f"IMAP search failed with status: {status}")
                return invoices
            
            email_ids = messages[0].split()
            print(f"Found {len(email_ids)} emails in date range")
            
            # Process each email
            processed = 0
            skipped = 0
            for email_id in email_ids:
                try:
                    invoice_data = self._process_email(email_id, include_all=include_all)
                    if invoice_data:
                        invoices.append(invoice_data)
                        processed += 1
                    else:
                        skipped += 1
                except Exception as e:
                    print(f"Error processing email {email_id}: {e}")
                    skipped += 1
                    continue
            
            print(f"Processed: {processed}, Skipped: {skipped}, Total invoices: {len(invoices)}")
            
        except Exception as e:
            print(f"Error searching invoices: {e}")
            import traceback
            traceback.print_exc()
        
        return invoices
    
    def _process_email(self, email_id: bytes, include_all: bool = False) -> Optional[Dict]:
        """Process a single email (IMAP) and extract invoice data."""
        try:
            status, msg_data = self.connection.fetch(email_id, "(RFC822)")
            if status != "OK":
                return None
            message = email.message_from_bytes(msg_data[0][1])
            return self._process_parsed_message(message, include_all)
        except Exception as e:
            print(f"Error processing email: {e}")
            return None

    def process_raw_message(self, raw_bytes: bytes, include_all: bool = False) -> Optional[Dict]:
        """Process raw RFC822 message (e.g. from Gmail API) and extract invoice data."""
        try:
            message = email.message_from_bytes(raw_bytes)
            return self._process_parsed_message(message, include_all)
        except Exception as e:
            print(f"Error processing raw message: {e}")
            return None

    def _process_parsed_message(self, message, include_all: bool = False) -> Optional[Dict]:
        """Extract invoice data from a parsed email.message.Message."""
        try:
            subject = self._decode_header(message["Subject"])
            from_header = self._decode_header(message["From"])
            date_str = message["Date"]
            
            # Parse sender
            sender_email, sender_name = self._parse_sender(from_header)
            
            # Parse date
            received_date = self._parse_date(date_str)
            
            # Check if email contains invoice keywords (check both subject and body)
            subject_lower = subject.lower() if subject else ""
            has_invoice_keyword = any(
                keyword.lower() in subject_lower
                for keyword in settings.INVOICE_KEYWORDS
            )
            
            # Look for attachments
            pdf_attachments = []
            invoice_url = None
            
            if message.is_multipart():
                for part in message.walk():
                    # Check for PDF attachments
                    if part.get_content_type() == "application/pdf":
                        filename = part.get_filename()
                        if filename:
                            pdf_attachments.append({
                                "filename": self._decode_header(filename),
                                "content": part.get_payload(decode=True)
                            })
                    
                    # Check for URLs in text/html parts
                    elif part.get_content_type() in ["text/plain", "text/html"]:
                        try:
                            body = part.get_payload(decode=True).decode()
                            urls = self._extract_invoice_urls(body)
                            if urls and not invoice_url:
                                invoice_url = urls[0]
                        except Exception:
                            pass
            
            # Get email body for analysis
            body_text = self._get_email_body(message)
            body_lower = body_text.lower()
            
            # Check body for invoice keywords if not found in subject
            if not has_invoice_keyword:
                has_invoice_keyword = any(
                    keyword.lower() in body_lower
                    for keyword in settings.INVOICE_KEYWORDS
                )
            
            # Additional invoice indicators
            has_amount = self._has_amount_in_body(body_text)
            has_invoice_number = self._has_invoice_number_pattern(subject, body_text)
            
            # Strong invoice signals: PDF, keywords, amounts, or invoice numbers
            has_strong_invoice_signal = (
                len(pdf_attachments) > 0
                or has_invoice_keyword
                or has_amount
                or has_invoice_number
            )
            
            # Detect newsletter/spam: only exclude if clear newsletter signal AND no invoice indicators
            subject_and_body = f"{subject_lower} {body_lower}"
            spam_keywords = getattr(settings, "NEWSLETTER_SPAM_KEYWORDS", [])
            has_newsletter_keywords = any(
                kw.lower() in subject_and_body
                for kw in spam_keywords
            )
            
            # Check for typical newsletter senders (but allow if there are invoice signals)
            sender_lower = (sender_email or "").lower()
            is_newsletter_sender = (
                "noreply" in sender_lower 
                or "no-reply" in sender_lower 
                or "newsletter" in sender_lower
            )
            
            # Only mark as spam/newsletter if newsletter indicators AND no strong invoice signals
            is_likely_newsletter_or_spam = (
                (has_newsletter_keywords or is_newsletter_sender)
                and not has_strong_invoice_signal
            )
            
            # Decide whether to include: prefer recall (maximize detection)
            # Include if:
            # 1. Has strong invoice signal (PDF, keywords, amounts, invoice numbers), OR
            # 2. include_all is True AND not clearly newsletter/spam
            should_include = (
                has_strong_invoice_signal
                or (include_all and not is_likely_newsletter_or_spam)
            )
            
            if should_include:
                return {
                    "sender_email": sender_email,
                    "sender_name": sender_name,
                    "subject": subject,
                    "received_date": received_date,
                    "pdf_attachments": pdf_attachments,
                    "invoice_url": invoice_url,
                    "email_body": self._get_email_body(message),
                    "has_pdf": len(pdf_attachments) > 0,
                    "has_keyword": has_invoice_keyword
                }
            
            return None
        except Exception as e:
            print(f"Error processing message: {e}")
            return None

    def _decode_header(self, header: str) -> str:
        """Decode email header"""
        if not header:
            return ""
        
        decoded_parts = decode_header(header)
        decoded_string = ""
        
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                decoded_string += part.decode(encoding or "utf-8", errors="ignore")
            else:
                decoded_string += part
        
        return decoded_string
    
    def _parse_sender(self, from_header: str) -> Tuple[str, str]:
        """Parse sender email and name from From header"""
        # Try to extract email and name
        email_pattern = r'[\w\.-]+@[\w\.-]+'
        email_match = re.search(email_pattern, from_header)
        
        if email_match:
            sender_email = email_match.group(0)
            # Extract name (everything before email)
            name_part = from_header.split('<')[0].strip().strip('"')
            sender_name = name_part if name_part else sender_email.split('@')[0]
            return sender_email, sender_name
        
        return from_header, from_header
    
    def _parse_date(self, date_str: str) -> datetime:
        """Parse email date string to datetime"""
        try:
            # Use email.utils to parse date
            from email.utils import parsedate_to_datetime
            return parsedate_to_datetime(date_str)
        except Exception:
            return datetime.now()
    
    def _extract_invoice_urls(self, body: str) -> List[str]:
        """Extract potential invoice URLs from email body"""
        # Look for common invoice URL patterns
        url_pattern = r'https?://[^\s<>"]+(?:invoice|rechnung|bill|payment)[^\s<>"]*'
        urls = re.findall(url_pattern, body, re.IGNORECASE)
        return urls
    
    def _has_amount_in_body(self, body: str) -> bool:
        """Check if email body contains monetary amounts (indicating invoice/bill)"""
        if not body:
            return False
        
        # Patterns for monetary amounts:
        # - € 123.45, €123,45, 123,45 €
        # - $ 123.45, $123.45, 123.45 USD
        # - 123,45 EUR, 123.45 EUR
        amount_patterns = [
            r'€\s*\d+[,.]\d+',  # € 123.45 or €123,45
            r'\d+[,.]\d+\s*€',  # 123,45 €
            r'\$\s*\d+[,.]\d+',  # $ 123.45
            r'\d+[,.]\d+\s*\$',  # 123.45 $
            r'\d+[,.]\d+\s*(EUR|USD|GBP|CHF)',  # 123.45 EUR
            r'(EUR|USD|GBP|CHF)\s*\d+[,.]\d+',  # EUR 123.45
            r'\d+[,.]\d{2}\s*(Euro|Dollar)',  # 123,45 Euro
        ]
        
        for pattern in amount_patterns:
            if re.search(pattern, body, re.IGNORECASE):
                return True
        
        return False
    
    def _has_invoice_number_pattern(self, subject: str, body: str) -> bool:
        """Check if subject or body contains invoice number patterns"""
        text = f"{subject or ''} {body or ''}"
        if not text.strip():
            return False
        
        # Patterns for invoice numbers:
        # - Invoice #12345, Invoice # 12345
        # - Rechnung Nr. 12345, Rechnung Nr 12345
        # - Invoice ID: 12345, Invoice ID 12345
        # - Invoice Number: 12345
        # - Rechnungsnummer: 12345
        invoice_number_patterns = [
            r'invoice\s*#?\s*\d+',  # Invoice #12345 or Invoice 12345
            r'rechnung\s*nr\.?\s*\d+',  # Rechnung Nr. 12345
            r'invoice\s*(id|number):?\s*\d+',  # Invoice ID: 12345
            r'rechnungsnummer:?\s*\d+',  # Rechnungsnummer: 12345
            r'invoice\s*no\.?\s*\d+',  # Invoice No. 12345
            r'bill\s*#?\s*\d+',  # Bill #12345
            r'receipt\s*#?\s*\d+',  # Receipt #12345
        ]
        
        for pattern in invoice_number_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        
        return False
    
    def _get_email_body(self, message) -> str:
        """Extract email body text"""
        body = ""
        
        if message.is_multipart():
            for part in message.walk():
                if part.get_content_type() == "text/plain":
                    try:
                        body = part.get_payload(decode=True).decode()
                        break
                    except Exception:
                        pass
        else:
            try:
                body = message.get_payload(decode=True).decode()
            except Exception:
                pass
        
        return body
    
    def save_attachment(self, attachment_data: bytes, filename: str, user_id: int, invoice_id: int) -> str:
        """Save PDF attachment to storage and return file path"""
        try:
            # Create user-specific directory
            storage_dir = Path(settings.STORAGE_PATH) / str(user_id) / str(invoice_id)
            storage_dir.mkdir(parents=True, exist_ok=True)
            
            # Sanitize filename
            safe_filename = re.sub(r'[^\w\s.-]', '', filename)
            file_path = storage_dir / safe_filename
            
            # Save file
            with open(file_path, 'wb') as f:
                f.write(attachment_data)
            
            return str(file_path)
            
        except Exception as e:
            print(f"Error saving attachment: {e}")
            return ""

# Global email service instance
email_service = EmailService()

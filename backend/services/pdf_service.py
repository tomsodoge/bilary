import pdfplumber
from pathlib import Path
from typing import Optional

class PDFService:
    """Service for extracting text from PDF files"""
    
    def extract_text(self, pdf_path: str) -> str:
        """
        Extract text content from a PDF file.
        Returns the full text or empty string if extraction fails.
        """
        try:
            with pdfplumber.open(pdf_path) as pdf:
                text = ""
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                return text.strip()
        except Exception as e:
            print(f"Error extracting text from PDF {pdf_path}: {e}")
            return ""
    
    def extract_first_page(self, pdf_path: str) -> str:
        """Extract text from first page only (faster for categorization)"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                if pdf.pages:
                    return pdf.pages[0].extract_text() or ""
                return ""
        except Exception as e:
            print(f"Error extracting first page from PDF {pdf_path}: {e}")
            return ""
    
    def get_page_count(self, pdf_path: str) -> int:
        """Get number of pages in PDF"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                return len(pdf.pages)
        except Exception as e:
            print(f"Error getting page count from PDF {pdf_path}: {e}")
            return 0
    
    def is_valid_pdf(self, pdf_path: str) -> bool:
        """Check if file is a valid PDF"""
        try:
            with pdfplumber.open(pdf_path) as pdf:
                return len(pdf.pages) > 0
        except Exception:
            return False

# Global PDF service instance
pdf_service = PDFService()

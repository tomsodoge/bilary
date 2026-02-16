from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    imap_server: str
    imap_port: int = 993

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class InvoiceBase(BaseModel):
    sender_email: str
    sender_name: Optional[str] = None
    subject: Optional[str] = None
    received_date: Optional[datetime] = None
    file_path: Optional[str] = None
    file_url: Optional[str] = None
    category: str = "Other"
    is_private: bool = False

class InvoiceCreate(InvoiceBase):
    user_id: int

class InvoiceUpdate(BaseModel):
    category: Optional[str] = None
    is_private: Optional[bool] = None

class Invoice(InvoiceBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class AttachmentBase(BaseModel):
    filename: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None

class AttachmentCreate(AttachmentBase):
    invoice_id: int

class Attachment(AttachmentBase):
    id: int
    invoice_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ConnectionStatus(BaseModel):
    connected: bool
    email: Optional[str] = None
    message: str
    accounts: Optional[List["AccountInfo"]] = None


class AccountInfo(BaseModel):
    id: int
    email: str
    imap_server: str
    imap_port: int = 993
    created_at: Optional[datetime] = None


# Resolve forward reference for ConnectionStatus.accounts
ConnectionStatus.model_rebuild()

class ExportRequest(BaseModel):
    year: int
    month: Optional[int] = None
    type: str = "business"  # business or private

class SyncResponse(BaseModel):
    success: bool
    invoices_found: int
    message: str

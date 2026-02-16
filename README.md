# Invoice Manager

A full-stack web application for managing email invoices with automatic extraction, categorization, and export features.

## Features

- **Email Integration**: Connect to your email account via IMAP (optimized for t-online.de)
- **Automatic Invoice Detection**: Extracts invoices from emails based on PDFs and keywords
- **Smart Categorization**: Automatically categorizes invoices (Digital Service, Physical Product, Online Course)
- **Invoice Management**: View, filter, and manage invoices by sender, category, date, and type
- **Private/Business Separation**: Mark invoices as private or business
- **Organized Export**: Download invoices as ZIP files organized by month and company
- **Secure Storage**: Email credentials encrypted at rest

## Tech Stack

### Backend
- Python 3.9+ with FastAPI
- SQLite database
- IMAP email integration
- PDF processing with pdfplumber
- Fernet encryption for credentials

### Frontend
- React 18 with TypeScript
- Vite build tool
- React Router for navigation
- Axios for API calls
- Custom CSS (ready for design system integration)

## Prerequisites

- Python 3.9 or higher
- Node.js 18 or higher
- Email account with IMAP access (tested with t-online.de)

## Installation

### 1. Clone or navigate to the project

```bash
cd ontrack-app
```

### 2. Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Create .env file from example
cp .env.example .env

# Generate encryption key (optional, will auto-generate if not set)
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Add the key to .env file as ENCRYPTION_KEY
```

### 3. Frontend Setup

```bash
cd ../frontend

# Install Node dependencies
npm install

# Create .env file (optional)
cp .env.example .env
```

## Running the Application

### Start Backend (Terminal 1)

```bash
cd backend
uvicorn main:app --reload
```

Backend will run at: http://localhost:8000
API documentation at: http://localhost:8000/docs

### Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

Frontend will run at: http://localhost:5173

## Usage

### 1. Connect Email Account
- Navigate to the Connect page
- Enter your email credentials
- For t-online.de accounts, IMAP server is auto-detected
- Your password is encrypted and stored securely

### 2. Sync Invoices
- Click "Sync Invoices" on the dashboard
- The app will search the last 30 days for invoices
- Invoices are automatically categorized

### 3. Manage Invoices
- View invoices grouped by sender
- Filter by sender, category, date, or type (business/private)
- Click category badges to change categorization
- Move invoices between business and private buckets
- Delete unwanted invoices

### 4. Export Invoices
- Navigate to Export page
- Select year, month (optional), and type (business/private)
- Download organized ZIP file with structure:
  ```
  invoices-2024-01.zip
  ├── 01-January/
  │   ├── Amazon/
  │   │   ├── invoice-123.pdf
  │   │   └── invoice-456.pdf
  │   ├── Adobe/
  │   │   └── invoice-789.pdf
  ```

## Configuration

### Backend (.env)
```
DATABASE_PATH=./data/invoices.db
STORAGE_PATH=./storage/invoices
ENCRYPTION_KEY=<your-32-byte-key>
CORS_ORIGINS=http://localhost:5173
SYNC_INTERVAL_MINUTES=30
```

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:8000
```

## Database Schema

### Tables
- **users**: Email credentials and IMAP settings
- **invoices**: Invoice metadata and file paths
- **attachments**: PDF attachment information

## API Endpoints

### Authentication
- `POST /api/auth/connect` - Connect email account
- `GET /api/auth/status` - Check connection status

### Invoices
- `POST /api/invoices/sync` - Sync invoices from email
- `GET /api/invoices` - List invoices (with filters)
- `GET /api/invoices/{id}` - Get single invoice
- `PATCH /api/invoices/{id}` - Update invoice
- `DELETE /api/invoices/{id}` - Delete invoice
- `GET /api/invoices/senders/list` - List unique senders

### Export
- `GET /api/export/zip` - Download ZIP archive

## Security

- Email passwords are encrypted using Fernet (symmetric encryption)
- Credentials stored securely in SQLite database
- No plaintext passwords stored
- CORS configured for frontend-backend communication

## Future Enhancements (Multi-User Support)

The application is architected for easy multi-user expansion:
- Add JWT authentication
- User registration and login
- Per-user invoice isolation (already in database schema)
- User profiles and settings
- Optional migration to PostgreSQL for scalability

## Development

### Backend Development
```bash
cd backend
uvicorn main:app --reload --log-level debug
```

### Frontend Development
```bash
cd frontend
npm run dev
```

### Build for Production
```bash
cd frontend
npm run build
```

## Troubleshooting

### Backend Issues
- Ensure Python 3.9+ is installed: `python3 --version`
- Check all dependencies are installed: `pip list`
- Verify database is initialized: Check `./data/invoices.db` exists
- Check logs for IMAP connection errors

### Frontend Issues
- Ensure Node.js 18+ is installed: `node --version`
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`

### IMAP Connection Issues
- Verify IMAP is enabled in your email settings
- For t-online.de: Use `secureimap.t-online.de` on port 993
- Check if your email provider requires app-specific passwords
- Test credentials manually with an email client

## Support for Other Email Providers

While optimized for t-online.de, the app works with any IMAP-enabled email provider:
- Gmail: `imap.gmail.com` (requires app password)
- Outlook: `outlook.office365.com`
- Yahoo: `imap.mail.yahoo.com`

## License

Private use for invoice management.

## Contributing

This is a personal project. For feature requests or bug reports, please contact the maintainer.

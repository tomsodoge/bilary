# Email Sync Improvements

## Issues Fixed

### 1. Infinite Network Error Loop ✅
**Problem:** The app was making infinite API requests causing browser to freeze
**Root Cause:** `useInvoices` hook was using `JSON.stringify(filters)` as a useEffect dependency, causing infinite re-renders
**Solution:** 
- Split useEffect into two: one for initial mount, one for filter changes
- Use individual filter properties as dependencies instead of stringified object
- Added `hasFetchedInitial` ref to prevent duplicate initial fetches

### 2. Limited Date Range ✅
**Problem:** Sync only went back 30 days, couldn't get 2025 emails
**Solution:** Added flexible date range options:
- Sync last N days (customizable)
- Sync entire year (e.g., 2025, 2024, etc.)
- Backend now supports year-based queries

### 3. Strict Filtering ✅
**Problem:** Only synced emails with PDFs OR invoice keywords in subject
**Solution:** 
- Added "Include All" option to sync all emails in date range
- Now checks keywords in both subject AND body text
- More comprehensive invoice detection

## New Features

### Advanced Sync Options UI

Click "Sync Invoices" button to open the sync options panel with:

#### 1. **Filter Mode**
- **Standard (Default):** Only emails with PDFs or invoice keywords
- **Include All:** All emails in date range (slower but comprehensive)

#### 2. **Last N Days**
- Sync the most recent emails
- Configurable from 1 to 365 days
- Default: 30 days

#### 3. **Specific Year**
- Sync entire year at once
- Dropdown with last 5 years (2026, 2025, 2024, 2023, 2022)
- Perfect for getting all 2025 invoices!

### Backend Improvements

#### Enhanced Search Function
```python
search_invoices(
    days_back: int = 30,      # Search last N days
    year: int = None,          # Search specific year (e.g., 2025)
    start_date: datetime = None,  # Custom start date
    end_date: datetime = None,    # Custom end date
    include_all: bool = False     # Include all emails
)
```

#### Better Logging
- Shows date range being searched
- Reports how many emails found vs processed
- Tracks skipped emails
- Helps diagnose sync issues

#### Improved Detection
- Checks invoice keywords in subject AND body
- Detects PDFs even without keywords
- Records whether each invoice has PDF/keyword for analysis

## How to Use

### Sync 2025 Invoices
1. Open the app at http://localhost:5173
2. Click "Sync Invoices" button
3. Select "Specific Year" tab
4. Choose "2025" from dropdown
5. Optionally enable "Include All" for comprehensive search
6. Click "Sync Year 2025"
7. Wait for sync to complete (may take a few minutes for full year)

### Sync Last 90 Days
1. Click "Sync Invoices"
2. Stay on "Last N Days" tab
3. Change number to 90
4. Click "Sync Last 90 Days"

### Comprehensive Sync (All Emails)
1. Click "Sync Invoices"
2. Enable "All emails in date range" option
3. Choose your date range (days or year)
4. Click sync button
5. Note: This is slower but ensures nothing is missed

## Technical Details

### IMAP Date Query Format
- Backend uses IMAP SINCE/BEFORE commands
- Format: "01-Jan-2025" to "01-Jan-2026" for year 2025
- BEFORE is exclusive, so we add 1 day to end date

### Keyword Detection
Default keywords (configurable in `backend/config.py`):
- "rechnung" (German for invoice)
- "invoice"
- "beleg" (German for receipt)
- "payment"
- "zahlung" (German for payment)
- "receipt"
- "quittung" (German for receipt)
- "confirmation"
- "bestätigung" (German for confirmation)

### Performance Tips
- **Year sync:** Takes 2-5 minutes for full year depending on email volume
- **Include All:** 2-3x slower than standard mode but more thorough
- **Standard mode:** Fast, good for most use cases
- Sync runs in background, you can check terminal for progress logs

## Debugging Sync Issues

If sync isn't finding expected invoices:

1. **Check Backend Logs** (terminal running uvicorn):
   - Shows date range being searched
   - Reports email count: "Found 234 emails in date range"
   - Shows processed vs skipped: "Processed: 45, Skipped: 189"

2. **Try "Include All" Mode:**
   - Disables keyword/PDF filtering
   - Syncs all emails in range
   - Useful to see what's in your inbox

3. **Check IMAP Connection:**
   - Ensure email account is still connected
   - Go to Connect page to reconnect if needed

4. **Verify Date Range:**
   - Check email received dates match your sync range
   - Some emails may have incorrect dates

## API Changes

### New Endpoint Parameters
```
POST /api/invoices/sync?days_back=30&year=2025&include_all=false
```

Query Parameters:
- `days_back` (int): Search last N days (default: 30)
- `year` (int): Search specific year, overrides days_back
- `include_all` (bool): Include all emails, not just invoices (default: false)

### Response Format
```json
{
  "success": true,
  "invoices_found": 45,
  "message": "Successfully synced 45 new invoices"
}
```

## Configuration

Edit `backend/config.py` to customize:
- `INVOICE_KEYWORDS`: Add more keywords to detect
- `SYNC_INTERVAL_MINUTES`: Auto-sync interval (if implemented)
- `DEFAULT_IMAP_SERVER`: Change default email provider

## Future Enhancements

Possible improvements:
- Custom date range picker (specific start/end dates)
- Multiple year selection (2024 + 2025 at once)
- Scheduled auto-sync in background
- Email provider presets (Gmail, Outlook, etc.)
- Advanced filters (sender-specific, attachment size, etc.)
- Progress indicator during sync
- Sync history log

## Summary

**Fixed:** Infinite network errors preventing app from loading
**Added:** Flexible sync options for any date range including full years
**Improved:** Better email detection and comprehensive search modes

You can now sync all your 2025 invoices easily! 🎉

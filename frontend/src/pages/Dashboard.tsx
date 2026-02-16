import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useInvoices } from '../hooks/useInvoices';
import FilterBar from '../components/FilterBar';
import InvoiceList from '../components/InvoiceList';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { status, isConnected } = useAuth();
  const {
    invoices,
    loading,
    error,
    filters,
    setFilters,
    syncInvoices,
    updateInvoice,
    deleteInvoice,
  } = useInvoices();

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncProgress, setSyncProgress] = useState<string>('');
  const [showSyncOptions, setShowSyncOptions] = useState(false);
  const [syncYear, setSyncYear] = useState<number>(new Date().getFullYear());
  const [syncDays, setSyncDays] = useState<number>(30);
  const [includeAll, setIncludeAll] = useState<boolean>(false);


  // Redirect to connect page if not connected
  React.useEffect(() => {
    if (!isConnected && status && !status.connected) {
      navigate('/connect');
    }
  }, [isConnected, status, navigate]);

  const handleSync = async (useYear: boolean = false) => {
    setSyncing(true);
    setSyncMessage('');
    setSyncProgress('Connecting to email server...');
    
    try {
      const options = useYear 
        ? { year: syncYear, includeAll } 
        : { daysBack: syncDays, includeAll };
      
      // Show progress updates
      setSyncProgress(useYear ? `Syncing year ${syncYear}...` : `Syncing last ${syncDays} days...`);
      
      const startTime = Date.now();
      const result = await syncInvoices(options);
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      setSyncMessage(`${result.message} (took ${duration}s)`);
      setSyncProgress('');
      setShowSyncOptions(false);
    } catch (err) {
      setSyncMessage('Failed to sync invoices: ' + (err instanceof Error ? err.message : String(err)));
      setSyncProgress('');
    } finally {
      setSyncing(false);
    }
  };


  return (
    <div className="page-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Invoice Dashboard</h1>
          {status?.accounts && status.accounts.length > 0 && (
            <p className="user-email">
              {status.accounts.length} Postfach(er) verbunden
              {status.accounts.length <= 2
                ? `: ${status.accounts.map((a) => a.email).join(', ')}`
                : ''}
              {' · '}
              <button
                type="button"
                className="link-button"
                onClick={() => navigate('/connect')}
              >
                Postfächer verwalten
              </button>
            </p>
          )}
        </div>
        <div className="header-actions">
          <button
            onClick={() => setShowSyncOptions(!showSyncOptions)}
            className="btn btn-primary"
            disabled={syncing || loading}
            title={syncProgress || undefined}
          >
            {syncing ? (syncProgress || 'Syncing...') : 'Sync Invoices'}
          </button>
          <button
            onClick={() => navigate('/export')}
            className="btn btn-secondary"
            disabled={invoices.length === 0}
          >
            Export
          </button>
        </div>
      </header>

      {showSyncOptions && (
        <div className="sync-options-panel">
          <h3>Sync Options</h3>
          <div className="sync-option-group">
            <label>
              <input
                type="radio"
                name="sync-type"
                checked={!includeAll}
                onChange={() => setIncludeAll(false)}
              />
              Only emails with PDFs or invoice keywords
            </label>
            <label>
              <input
                type="radio"
                name="sync-type"
                checked={includeAll}
                onChange={() => setIncludeAll(true)}
              />
              All emails in date range (slower, more comprehensive)
            </label>
          </div>
          
          <div className="sync-tabs">
            <button 
              className="tab-btn"
              onClick={() => document.getElementById('days-tab')?.click()}
            >
              Last N Days
            </button>
            <button 
              className="tab-btn"
              onClick={() => document.getElementById('year-tab')?.click()}
            >
              Specific Year
            </button>
          </div>

          <div className="sync-tab-content">
            <div id="days-panel">
              <label>Days back:</label>
              <input
                type="number"
                value={syncDays}
                onChange={(e) => setSyncDays(Number(e.target.value))}
                min="1"
                max="365"
              />
              <button
                onClick={() => handleSync(false)}
                className="btn btn-primary"
                disabled={syncing}
              >
                Sync Last {syncDays} Days
              </button>
            </div>

            <div id="year-panel" style={{ marginTop: '1rem' }}>
              <label>Year:</label>
              <select
                value={syncYear}
                onChange={(e) => setSyncYear(Number(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button
                onClick={() => handleSync(true)}
                className="btn btn-primary"
                disabled={syncing}
              >
                Sync Year {syncYear}
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowSyncOptions(false)}
            className="btn btn-secondary"
            style={{ marginTop: '1rem' }}
          >
            Cancel
          </button>
        </div>
      )}

      {(syncMessage || syncProgress) && (
        <div className={syncProgress ? "sync-progress" : "sync-message"}>
          {syncProgress || syncMessage}
          {syncing && syncProgress && (
            <div className="progress-spinner">
              <div className="spinner"></div>
            </div>
          )}
        </div>
      )}

      {/* Postfächer-Bereich: immer anzeigen wenn verbunden, mit Button zum Anbinden */}
      {isConnected && (
        <div className="mailboxes-section">
          <div className="mailboxes-section-header">
            <h2 className="mailboxes-section-title">Postfächer</h2>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/connect')}
            >
              Weiteres Postfach anbinden
            </button>
          </div>
          {status?.accounts && status.accounts.length > 0 ? (
            <ul className="mailboxes-list">
              {status.accounts.map((acc) => (
                <li key={acc.id} className="mailboxes-list-item">
                  <span className="mailbox-email">{acc.email}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mailboxes-fallback">
              {status?.email ? (
                <>1 Postfach verbunden: {status.email}</>
              ) : (
                <>Postfach verbunden</>
              )}
            </p>
          )}
        </div>
      )}

      <div className="current-filter-display">
        <strong>Showing:</strong> 
        {filters.start_date && filters.end_date ? (
          <span> {filters.start_date} to {filters.end_date}</span>
        ) : filters.start_date ? (
          <span> From {filters.start_date}</span>
        ) : filters.end_date ? (
          <span> Until {filters.end_date}</span>
        ) : (
          <span> Last 30 days</span>
        )}
        <span className="invoice-count-badge">({invoices.length} invoices)</span>
        {filters.category && <span> • Category: {filters.category}</span>}
        {filters.sender && <span> • Sender: {filters.sender}</span>}
        {filters.is_private !== undefined && (
          <span> • {filters.is_private ? 'Private' : 'Business'} only</span>
        )}
      </div>

      <FilterBar filters={filters} onFiltersChange={setFilters} />

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-state">Loading invoices...</div>
      ) : (
        <InvoiceList
          invoices={invoices}
          onUpdate={updateInvoice}
          onDelete={deleteInvoice}
        />
      )}
    </div>
  );
};

export default Dashboard;

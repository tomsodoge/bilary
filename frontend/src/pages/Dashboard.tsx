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
  const [syncYear, setSyncYear] = useState<number>(new Date().getFullYear());


  // Redirect to connect page if not connected
  React.useEffect(() => {
    if (!isConnected && status && !status.connected) {
      navigate('/connect');
    }
  }, [isConnected, status, navigate]);

  const handleYearSync = async () => {
    setSyncing(true);
    setSyncMessage('');
    setSyncProgress(`Syncing year ${syncYear}...`);
    
    try {
      const startTime = Date.now();
      const result = await syncInvoices({ year: syncYear, includeAll: false });
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      setSyncMessage(`${result.message} (took ${duration}s)`);
      setSyncProgress('');
    } catch (err) {
      setSyncMessage('Failed to sync: ' + (err instanceof Error ? err.message : String(err)));
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
          <div className="year-sync-group">
            <label htmlFor="sync-year-select" style={{ marginRight: '0.5rem', fontWeight: 500 }}>
              Jahr:
            </label>
            <select
              id="sync-year-select"
              value={syncYear}
              onChange={(e) => setSyncYear(Number(e.target.value))}
              disabled={syncing || loading}
              style={{ marginRight: '0.75rem', padding: '0.5rem', fontSize: '1rem' }}
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <button
              onClick={handleYearSync}
              className="btn btn-primary"
              disabled={syncing || loading}
              title={syncProgress || undefined}
            >
              {syncing ? (syncProgress || 'Syncing...') : `Sync ${syncYear}`}
            </button>
          </div>
          <button
            onClick={() => navigate('/export')}
            className="btn btn-secondary"
            disabled={invoices.length === 0}
          >
            Export
          </button>
        </div>
      </header>

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

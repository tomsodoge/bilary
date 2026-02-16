import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { Invoice } from '../types/invoice';
import InvoiceCard from './InvoiceCard';

interface InvoiceListProps {
  invoices: Invoice[];
  onUpdate: (id: number, data: { category?: string; is_private?: boolean }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

interface GroupedInvoice {
  invoices: Invoice[];
  displayName: string;
  domain: string;
}

/**
 * Extract and normalize domain from email address
 * Examples:
 * - "noreply@wmf.de" -> "wmf.de"
 * - "sonderaktionen@wmf.de" -> "wmf.de"
 * - "user@www.example.com" -> "example.com"
 * - "user@mail.wmf.de" -> "wmf.de"
 */
const extractDomain = (email: string): string => {
  const match = email.match(/@([^@]+)$/);
  if (!match) {
    return email.toLowerCase();
  }
  
  let domain = match[1].toLowerCase();
  
  // Remove www. prefix
  if (domain.startsWith('www.')) {
    domain = domain.substring(4);
  }
  
  // Normalize common subdomains (mail., email., noreply., etc.)
  // Extract root domain (last two parts: example.com)
  const parts = domain.split('.');
  if (parts.length >= 2) {
    // For domains like mail.wmf.de, return wmf.de
    // For domains like noreply@company.co.uk, return company.co.uk
    // Keep last 2-3 parts depending on TLD
    const commonTlds = ['co.uk', 'com.au', 'co.za', 'com.br'];
    const hasMultiPartTld = commonTlds.some(tld => domain.endsWith('.' + tld));
    
    if (hasMultiPartTld && parts.length >= 3) {
      // Keep last 3 parts for multi-part TLDs
      return parts.slice(-3).join('.');
    } else if (parts.length >= 2) {
      // Keep last 2 parts for standard TLDs
      return parts.slice(-2).join('.');
    }
  }
  
  return domain;
};

type SortOrder = 'a-z' | 'z-a';

const InvoiceList: React.FC<InvoiceListProps> = ({ invoices, onUpdate, onDelete }) => {
  const [collapsedSenders, setCollapsedSenders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('a-z');

  const toggleSender = useCallback((sender: string) => {
    setCollapsedSenders((prev) => {
      const next = new Set(prev);
      if (next.has(sender)) next.delete(sender);
      else next.add(sender);
      return next;
    });
  }, []);

  // Filter and group invoices by domain, using most common sender_name as display name
  const groupedInvoices = useMemo(() => {
    // Filter invoices by search query
    const filteredInvoices = invoices.filter((invoice) => {
      if (!searchQuery.trim()) return true;
      
      const query = searchQuery.toLowerCase();
      const senderName = (invoice.sender_name || '').toLowerCase();
      const senderEmail = invoice.sender_email.toLowerCase();
      const subject = (invoice.subject || '').toLowerCase();
      
      return (
        senderName.includes(query) ||
        senderEmail.includes(query) ||
        subject.includes(query)
      );
    });

    const domainGroups = filteredInvoices.reduce((acc, invoice) => {
      const domain = extractDomain(invoice.sender_email);
      if (!acc[domain]) {
        acc[domain] = {
          invoices: [],
          senderNames: new Map<string, number>(),
          domain,
        };
      }
      acc[domain].invoices.push(invoice);
      
      // Track sender_name frequency for display name selection
      const senderName = invoice.sender_name || invoice.sender_email;
      acc[domain].senderNames.set(
        senderName,
        (acc[domain].senderNames.get(senderName) || 0) + 1
      );
      
      return acc;
    }, {} as Record<string, { invoices: Invoice[]; senderNames: Map<string, number>; domain: string }>);

    // Convert to final format with display names
    const result: Record<string, GroupedInvoice> = {};
    for (const [domain, group] of Object.entries(domainGroups)) {
      // Find most common sender_name
      let displayName = domain;
      let maxCount = 0;
      for (const [name, count] of group.senderNames.entries()) {
        if (count > maxCount) {
          maxCount = count;
          displayName = name;
        }
      }
      
      result[domain] = {
        invoices: group.invoices,
        displayName,
        domain,
      };
    }
    
    // Sort groups alphabetically
    const sortedEntries = Object.entries(result).sort(([domainA, groupA], [domainB, groupB]) => {
      const nameA = groupA.displayName.toLowerCase();
      const nameB = groupB.displayName.toLowerCase();
      
      if (sortOrder === 'a-z') {
        return nameA.localeCompare(nameB, 'de', { sensitivity: 'base' });
      } else {
        return nameB.localeCompare(nameA, 'de', { sensitivity: 'base' });
      }
    });
    
    // Convert back to object (maintaining order)
    const sortedResult: Record<string, GroupedInvoice> = {};
    for (const [domain, group] of sortedEntries) {
      sortedResult[domain] = group;
    }
    
    return sortedResult;
  }, [invoices, searchQuery, sortOrder]);

  // Initialize all groups as collapsed by default
  useEffect(() => {
    const allDomains = new Set(Object.keys(groupedInvoices));
    setCollapsedSenders((prev) => {
      // Only update if there are new domains that aren't in the collapsed set
      const hasNewDomains = Array.from(allDomains).some(domain => !prev.has(domain));
      if (hasNewDomains) {
        // Add all domains to collapsed set (merge with existing)
        return new Set([...prev, ...allDomains]);
      }
      return prev;
    });
  }, [groupedInvoices]);

  if (invoices.length === 0) {
    return (
      <div className="empty-state">
        <p>No invoices found. Try syncing your email to fetch invoices.</p>
      </div>
    );
  }

  const hasResults = Object.keys(groupedInvoices).length > 0;

  return (
    <div className="invoice-list">
      {/* Search and Sort Controls */}
      <div className="invoice-list-controls">
        <div className="search-container">
          <input
            type="text"
            placeholder="Suche nach Absender oder Betreff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="sort-container">
          <label htmlFor="sort-order" className="sort-label">Sortierung:</label>
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="sort-select"
          >
            <option value="a-z">A-Z</option>
            <option value="z-a">Z-A</option>
          </select>
        </div>
      </div>

      {!hasResults && searchQuery && (
        <div className="empty-state">
          <p>Keine Rechnungen gefunden für "{searchQuery}"</p>
        </div>
      )}

      {hasResults && Object.entries(groupedInvoices).map(([domain, group]) => {
        const isCollapsed = collapsedSenders.has(domain);
        return (
          <div
            key={domain}
            className={`invoice-group ${isCollapsed ? 'invoice-group--collapsed' : ''}`}
          >
            <button
              type="button"
              className="sender-heading sender-heading--clickable"
              onClick={() => toggleSender(domain)}
              aria-expanded={!isCollapsed}
            >
              <span className="sender-heading-chevron" aria-hidden>
                {isCollapsed ? '▶' : '▼'}
              </span>
              <span className="sender-heading-label">
                {group.displayName}
                <span className="invoice-count">({group.invoices.length})</span>
              </span>
            </button>
            <div className="invoice-group-content">
              <div className="invoice-cards">
                {group.invoices.map((invoice) => (
                  <InvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InvoiceList;

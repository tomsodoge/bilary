import React, { useState } from 'react';
import type { Invoice } from '../types/invoice';
import { CATEGORIES } from '../types/invoice';
import CategoryBadge from './CategoryBadge';

interface InvoiceCardProps {
  invoice: Invoice;
  onUpdate: (id: number, data: { category?: string; is_private?: boolean }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const InvoiceCard: React.FC<InvoiceCardProps> = ({ invoice, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(invoice.category);
  const [loading, setLoading] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleTogglePrivate = async () => {
    setLoading(true);
    try {
      await onUpdate(invoice.id, { is_private: !invoice.is_private });
    } catch (error) {
      console.error('Failed to toggle private:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = async () => {
    if (selectedCategory === invoice.category) {
      setIsEditing(false);
      return;
    }

    setLoading(true);
    try {
      await onUpdate(invoice.id, { category: selectedCategory });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update category:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this invoice?')) {
      return;
    }

    setLoading(true);
    try {
      await onDelete(invoice.id);
    } catch (error) {
      console.error('Failed to delete invoice:', error);
      setLoading(false);
    }
  };

  const openPDF = () => {
    if (invoice.file_path) {
      const filename = invoice.file_path.split('/').pop();
      window.open(`/files/${invoice.user_id}/${invoice.id}/${filename}`, '_blank');
    } else if (invoice.file_url) {
      window.open(invoice.file_url, '_blank');
    }
  };

  return (
    <div className={`invoice-card ${invoice.is_private ? 'private' : 'business'}`}>
      <div className="invoice-header">
        <div className="invoice-sender">
          <h3>{invoice.sender_name || invoice.sender_email}</h3>
          <p className="invoice-email">{invoice.sender_email}</p>
        </div>
        <div className="invoice-date">{formatDate(invoice.received_date)}</div>
      </div>

      {invoice.subject && (
        <div className="invoice-subject">
          <p>{invoice.subject}</p>
        </div>
      )}

      <div className="invoice-meta">
        {isEditing ? (
          <div className="category-edit">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={loading}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button onClick={handleCategoryChange} disabled={loading} className="btn btn-sm">
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setSelectedCategory(invoice.category);
              }}
              disabled={loading}
              className="btn btn-sm btn-secondary"
            >
              Cancel
            </button>
          </div>
        ) : (
          <CategoryBadge category={invoice.category as any} onClick={() => setIsEditing(true)} />
        )}

        <span className={`privacy-badge ${invoice.is_private ? 'private' : 'business'}`}>
          {invoice.is_private ? 'Private' : 'Business'}
        </span>
      </div>

      <div className="invoice-actions">
        {(invoice.file_path || invoice.file_url) && (
          <button onClick={openPDF} className="btn btn-sm" disabled={loading}>
            View PDF
          </button>
        )}
        
        <button
          onClick={handleTogglePrivate}
          className="btn btn-sm btn-secondary"
          disabled={loading}
        >
          Move to {invoice.is_private ? 'Business' : 'Private'}
        </button>
        
        <button
          onClick={handleDelete}
          className="btn btn-sm btn-danger"
          disabled={loading}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default InvoiceCard;

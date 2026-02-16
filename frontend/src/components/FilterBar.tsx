import React, { useState, useEffect } from 'react';
import type { InvoiceFilters } from '../types/invoice';
import { CATEGORIES } from '../types/invoice';
import { invoicesAPI } from '../api/client';

interface FilterBarProps {
  filters: InvoiceFilters;
  onFiltersChange: (filters: InvoiceFilters) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, onFiltersChange }) => {
  const [senders, setSenders] = useState<Array<{ sender_email: string; sender_name: string }>>([]);

  useEffect(() => {
    loadSenders();
  }, []);

  const loadSenders = async () => {
    try {
      const data = await invoicesAPI.getSenders();
      setSenders(data);
    } catch (error) {
      console.error('Failed to load senders:', error);
    }
  };

  const handleFilterChange = (key: keyof InvoiceFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value === '' ? undefined : value,
    });
  };

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <label htmlFor="sender-filter">Sender:</label>
        <select
          id="sender-filter"
          value={filters.sender || ''}
          onChange={(e) => handleFilterChange('sender', e.target.value)}
        >
          <option value="">All Senders</option>
          {senders.map((sender, index) => (
            <option key={`${sender.sender_email}-${index}`} value={sender.sender_email}>
              {sender.sender_name || sender.sender_email}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="category-filter">Category:</label>
        <select
          id="category-filter"
          value={filters.category || ''}
          onChange={(e) => handleFilterChange('category', e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="type-filter">Type:</label>
        <select
          id="type-filter"
          value={filters.is_private === undefined ? '' : filters.is_private ? 'private' : 'business'}
          onChange={(e) => {
            const value = e.target.value;
            handleFilterChange(
              'is_private',
              value === '' ? undefined : value === 'private'
            );
          }}
        >
          <option value="">All</option>
          <option value="business">Business</option>
          <option value="private">Private</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="start-date">From:</label>
        <input
          type="date"
          id="start-date"
          value={filters.start_date || ''}
          onChange={(e) => handleFilterChange('start_date', e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="end-date">To:</label>
        <input
          type="date"
          id="end-date"
          value={filters.end_date || ''}
          onChange={(e) => handleFilterChange('end_date', e.target.value)}
        />
      </div>

      <button
        className="btn btn-secondary"
        onClick={() => onFiltersChange({})}
      >
        Clear Filters
      </button>
      
      <button
        className="btn btn-secondary"
        onClick={() => onFiltersChange({
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        })}
      >
        Show 2025
      </button>
      
      <button
        className="btn btn-secondary"
        onClick={() => onFiltersChange({
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        })}
      >
        Show 2024
      </button>
    </div>
  );
};

export default FilterBar;

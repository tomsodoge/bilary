import React, { useState } from 'react';
import { exportAPI } from '../api/client';
import type { ExportOptions } from '../types/invoice';

interface ExportDialogProps {
  onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ onClose }) => {
  const currentYear = new Date().getFullYear();
  
  const [options, setOptions] = useState<ExportOptions>({
    year: currentYear,
    month: undefined,
    type: 'business',
  });

  const handleExport = () => {
    exportAPI.downloadZip(options);
    onClose();
  };

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export Invoices</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="export-year">Year:</label>
            <select
              id="export-year"
              value={options.year}
              onChange={(e) => setOptions({ ...options, year: parseInt(e.target.value) })}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="export-month">Month (optional):</label>
            <select
              id="export-month"
              value={options.month || ''}
              onChange={(e) =>
                setOptions({
                  ...options,
                  month: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
            >
              <option value="">All Year</option>
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Type:</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="export-type"
                  value="business"
                  checked={options.type === 'business'}
                  onChange={() => setOptions({ ...options, type: 'business' })}
                />
                Business
              </label>
              <label>
                <input
                  type="radio"
                  name="export-type"
                  value="private"
                  checked={options.type === 'private'}
                  onChange={() => setOptions({ ...options, type: 'private' })}
                />
                Private
              </label>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleExport}>
            Download ZIP
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
